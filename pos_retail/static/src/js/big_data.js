odoo.define('pos_retail.big_data', function (require) {
    var models = require('point_of_sale.models');
    var core = require('web.core');
    var _t = core._t;
    var rpc = require('pos.rpc');
    var ParameterDB = require('pos_retail.parameter');
    var session = require('web.session');

    var _super_PosModel = models.PosModel.prototype;
    models.PosModel = models.PosModel.extend({
        initialize: function (session, attributes) {
            var self = this;
            // $.when(this.init_db(session)).then(function () {
            //     for (var i = 0; i < self.models.length; i++) {
            //         self.create_object_store(self.models[i].model)
            //     }
            // })

            this.next_load = 2000;
            this.model_lock = [];
            this.model_unlock = [];
            this.model_ids = session['model_ids'];
            for (var i = 0; i < this.models.length; i++) {
                if (this.models[i].model && this.model_ids[this.models[i].model]) {
                    this.models[i]['max_id'] = this.model_ids[this.models[i].model]['max_id'];
                    this.models[i]['min_id'] = this.model_ids[this.models[i].model]['min_id'];
                    this.model_lock.push(this.models[i]);
                } else {
                    this.model_unlock.push(this.models[i])
                }
            }
            this.models = this.model_unlock;
            this.stock_datas = session.stock_datas;
            this.ParameterDB = new ParameterDB({});
            var config_id = this.ParameterDB.load(session.db + '_config_id');
            if (config_id) {
                var config_model = _.find(this.models, function (model) {
                    return model.model && model.model == "pos.config"
                })
                config_model.domain = [['id', '=', config_id]];
                this.config_id = config_id;
            }
            this.bus_logs = session.bus_logs;
            this.session = session;
            if (this.server_version == 10) {
                var currency_model = _.find(this.models, function (model) {
                    return model.model && model.model == "res.currency"
                })
                currency_model.ids = function (self) {
                    return [session.currency_id]
                }
            }
            return _super_PosModel.initialize.apply(this, arguments);
        },
        init_db: function (session) {
            var def = new $.Deferred();
            var self = this;
            window.indexedDB = window.indexedDB || window.mozIndexedDB ||
                window.webkitIndexedDB || window.msIndexedDB;
            window.IDBTransaction = window.IDBTransaction ||
                window.webkitIDBTransaction || window.msIDBTransaction;
            window.IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange ||
                window.msIDBKeyRange

            if (!window.indexedDB) {
                window.alert("Your browser doesn't support a stable version of IndexedDB.")
            }
            var request = window.indexedDB.open(session.db, 1);

            request.onerror = function (event) {
                console.log("error: ");
                def.reject();
            };
            request.onsuccess = function (event) {
                var indexedDB = request.result;
                console.log("request success: " + indexedDB);
                self.indexedDB = indexedDB;
                def.resolve();

            };
            request.onupgradeneeded = function (event) {
                var indexedDB = event.target.result;
                console.log("request onupgradeneeded: " + indexedDB);
                self.indexedDB = indexedDB;
                def.resolve();
            };
            return def;
        },
        create_object_store: function (storeName) {
            var def = new $.Deferred();
            var request = this.indexedDB.open(this.session.db);
            request.onsuccess = function (e) {
                var database = e.target.result;
                database.close();
                var secondRequest = indexedDB.open(dbName, 1);
                secondRequest.onupgradeneeded = function (e) {
                    var database = e.target.result;
                    var objectStore = database.createObjectStore(storeName, {
                        keyPath: storeName
                    });
                    def.resolve();
                };
                secondRequest.onsuccess = function (e) {
                    e.target.result.close();
                    def.resolve();
                }
            }
            return def;
        },
        read: function (session) {

            var transaction = db.transaction(["employee"]);
            var objectStore = transaction.objectStore("employee");
            var request = objectStore.get("00-03");

            request.onerror = function (event) {
                alert("Unable to retrieve daa from database!");
            };

            request.onsuccess = function (event) {
                // // Do something with the request.result!
                // if(request.result) {
                //    alert("Name: " + request.result.name + ",
                //       Age: " + request.result.age + ", Email: " + request.result.email);
                // } else {
                //    alert("Kenny couldn't be found in your database!");
                // }
            };
        },
        save_parameter_models_load: function () {
            /*
                Method store parameter load models to backend
             */
            var models = {};
            for (var number in this.model_lock) {
                var model = this.model_lock[number];
                models[model['model']] = {
                    fields: model['fields'] || [],
                    domain: model['domain'] || [],
                    context: model['context'] || [],
                };
                if (model['model'] == 'res.partner' || model['model'] == 'product.pricelist.item' || model['model'] == 'product.pricelist') {
                    models[model['model']]['domain'] = []
                }
                if (model['model'] == 'product.pricelist.item') {
                    models[model['model']]['domain'] = []
                }
            }
            rpc.query({
                model: 'pos.cache.database',
                method: 'save_parameter_models_load',
                args:
                    [models]
            
            })
        },
        first_install: function (model_name) {
            var loaded = new $.Deferred();
            var model = _.find(this.model_lock, function (model) {
                return model.model == model_name;
            })
            if (!model) {
                return loaded.resolve();
            }
            var self = this;
            var tmp = {};
            var fields = model.fields;

            function load_data(min_id, max_id) {
                var domain = [['id', '>=', min_id], ['id', '<', max_id]];
                var context = {}
                context['retail'] = true;
                if (model['model'] == 'product.product') {
                    domain.push(['available_in_pos', '=', true]);
                    var price_id = null;
                    if (self.pricelist) {
                        price_id = self.pricelist.id;
                    }
                    var stock_location_id = null;
                    if (self.config.stock_location_id) {
                        stock_location_id = self.config.stock_location_id[0]
                    }
                    context['location'] = stock_location_id;
                    context['pricelist'] = price_id;
                    context['display_default_code'] = false;
                }
                var params = {
                    model: model.model,
                    domain: domain,
                    fields: fields,
                    context: context,
                };
                return session.rpc('/web/dataset/search_read', params, {}).then(function (results) {
                    var results = results['records'] || [];
                    if (!self.database) {
                        self.database = {};
                    }
                    if (!self.database[model['model']]) {
                        self.database[model['model']] = [];
                    }
                    self.database[model['model']] = self.database[model['model']].concat(results);
                    min_id += self.next_load;
                    max_id += self.next_load;
                    if (results.length > 0) {
                        var process = min_id / model['max_id'];
                        if (process > 1) {
                            process = 1
                        }
                        self.chrome.loading_message(_t('Only one time installing: ') + model['model'] + ': ' + (process * 100).toFixed(2) + ' %', process);
                        load_data(min_id, max_id);
                        return $.when(model.loaded(self, results, tmp)).then(function () {
                        }, function (err) {
                            loaded.reject(err);
                        })
                    } else {
                        if (max_id < model['max_id']) {
                            load_data(min_id, max_id);
                        } else {
                            loaded.resolve();
                        }
                    }
                }).fail(function (type, error) {
                    self.chrome.loading_message(_t('Install fail, please try-again'));
                });
            }

            load_data(model['min_id'], model['min_id'] + this.next_load);
            return loaded;
        },
        load_server_data: function () {
            var self = this;
            return _super_PosModel.load_server_data.apply(this, arguments).then(function () {
                var condition = {};
                for (var index_number in self.model_lock) {
                    self.models.push(self.model_lock[index_number]);
                    if (self.model_lock[index_number].condition) {
                        condition[self.model_lock[index_number]['model']] = self.model_lock[index_number].condition(self);
                    } else {
                        condition[self.model_lock[index_number]['model']] = true;
                    }
                }
                self.chrome.loading_message(_t('Please waiting, starting pos session after few minutes'));
                return rpc.query({
                    model: 'pos.database',
                    method: 'load_master_data',
                    args: [condition],
                }).then(function (database) {
                    if (database) {
                        var model_loaded = _.find(self.model_lock, function (model) {
                            return model.model == 'product.pricelist';
                        });
                        if (model_loaded) {
                            var results = database[model_loaded.model];
                            model_loaded.loaded(self, results, {});
                        }
                        for (model_name in database) {
                            var model_loaded = _.find(self.model_lock, function (model) {
                                return model.model == model_name;
                            });
                            if (model_loaded) {
                                var results = database[model_name];
                                if (model_loaded.model == 'product.product') {
                                    for (var i = 0; i < results.length; i++) {
                                        var product = results[i];
                                        if (self.stock_datas[product['id']]) {
                                            product['qty_available'] = self.stock_datas[product['id']]
                                        }
                                    }
                                    self.products = results;
                                }
                                if (model_loaded.model != 'product.pricelist') {
                                    model_loaded.loaded(self, results, {});
                                }
                            }
                        }
                    } else {
                        return $.when(self.first_install('product.pricelist')).then(function () {
                            return $.when(self.first_install('product.pricelist.item')).then(function () {
                                return $.when(self.first_install('product.product')).then(function () {
                                    return $.when(self.first_install('res.partner')).then(function () {
                                        return $.when(self.first_install('account.invoice')).then(function () {
                                            return $.when(self.first_install('account.invoice.line')).then(function () {
                                                return $.when(self.first_install('pos.order')).then(function () {
                                                    return $.when(self.first_install('pos.order.line')).then(function () {
                                                        return $.when(self.first_install('sale.order')).then(function () {
                                                            return $.when(self.first_install('sale.order.line')).then(function () {
                                                                return true;
                                                            })
                                                        })
                                                    })
                                                })
                                            })

                                        })
                                    })
                                })
                            })
                        })
                    }
                }).fail(function (type, error) {
                    return self.pos.query_backend_fail(type, error);
                });
            }).then(function () {                
                self.save_parameter_models_load();
                if (self.config.keyboard_new_order) { // keyboard
                    hotkeys(self.config.keyboard_new_order, function (event, handler) {
                        self.add_new_order();
                    });
                }
                if (self.config.keyboard_remove_order) { // keyboard
                    hotkeys(self.config.keyboard_remove_order, function (event, handler) {
                        var order = self.get_order();
                        if (!order) {
                            return;
                        } else if (!order.is_empty()) {
                            self.gui.show_popup('confirm', {
                                'title': _t('Destroy Current Order ?'),
                                'body': _t('You will lose any data associated with the current order'),
                                confirm: function () {
                                    self.delete_current_order();
                                },
                            });
                        } else {
                            self.delete_current_order();
                        }
                    });
                }
                
                // added by AARSOL
                hotkeys('pageup', function (event, handler) {
                    $(".order-button.select-order.selected").prev().trigger("click");
                });
                hotkeys('pagedown', function (event, handler) {
                    $(".order-button.select-order.selected").next().trigger("click");
                });
                
                hotkeys(self.config.keyboard_global_discount, 'Numpad', function (event, handler) {
                    $(".btn-global-discount").trigger("click");
                    event.preventDefault();
                });
                
                hotkeys(self.config.keyboard_direct_discount, 'Numpad', function (event, handler) {
                    $(".btn-direct-discount").trigger("click");
                    event.preventDefault();
                });
                
                hotkeys(self.config.keyboard_order_signature, 'Numpad', function (event, handler) {
                    $(".btn-order-signature").trigger("click");
                    event.preventDefault();
                });
                
                hotkeys(self.config.keyboard_order_note, 'Numpad', function (event, handler) {
                    $(".btn-order-note").trigger("click");
                    event.preventDefault();
                });
                
                hotkeys(self.config.keyboard_line_note, 'Numpad', function (event, handler) {
                    $(".btn-line-note").trigger("click");
                    event.preventDefault();
                });
                
                hotkeys(self.config.keyboard_reward, 'Numpad', function (event, handler) {
                    $(".btn-reward").trigger("click");
                    event.preventDefault();
                });
                
                hotkeys(self.config.keyboard_kitchen, 'Numpad', function (event, handler) {
                    $(".btn-kitchen").trigger("click");
                    event.preventDefault();
                });
                
                hotkeys(self.config.keyboard_variants, 'Numpad', function (event, handler) {
                    $(".btn-variants").trigger("click");
                    event.preventDefault();
                });
                
                hotkeys(self.config.keyboard_print_user_card, 'Numpad', function (event, handler) {
                    $(".btn-print-user-card").trigger("click");
                    event.preventDefault();
                });
                
                hotkeys(self.config.keyboard_print_last_order, 'Numpad', function (event, handler) {
                    $(".btn-print-lastorder").trigger("click");
                    event.preventDefault();
                });
                
                hotkeys(self.config.keyboard_pos_orders, 'Numpad', function (event, handler) {
                    $(".btn-pos-orders").trigger("click");
                    event.preventDefault();
                });
                
                hotkeys(self.config.keyboard_return_products, 'Numpad', function (event, handler) {
                    $(".btn-return-products").trigger("click");
                    event.preventDefault();
                });
                
                hotkeys(self.config.keyboard_combo, 'Numpad', function (event, handler) {
                    $(".btn-combo").trigger("click");
                    event.preventDefault();
                });
                
                hotkeys(self.config.keyboard_combo_lot, 'Numpad', function (event, handler) {
                    $(".btn-combo-lot").trigger("click");
                    event.preventDefault();
                });
                
                hotkeys(self.config.keyboard_booking, 'Numpad', function (event, handler) {
                    $(".btn-booking").trigger("click");
                    event.preventDefault();
                });
                
                hotkeys(self.config.keyboard_booked, 'Numpad', function (event, handler) {
                    $(".btn-booked").trigger("click");
                    event.preventDefault();
                });
                
                hotkeys(self.config.keyboard_delivery, 'Numpad', function (event, handler) {
                    $(".btn-delivery").trigger("click");
                    event.preventDefault();
                });
                
                hotkeys(self.config.keyboard_promotions, 'Numpad', function (event, handler) {
                    $(".btn-promotions").trigger("click");
                    event.preventDefault();
                });              
               
                hotkeys(self.config.keyboard_products, 'Numpad', function (event, handler) {
                    $(".btn-products").trigger("click");
                    event.preventDefault();
                });
                
                hotkeys(self.config.keyboard_invoices, 'Numpad', function (event, handler) {
                    $(".btn-invoices").trigger("click");
                    event.preventDefault();
                });
                
                hotkeys(self.config.keyboard_purchase_order, 'Numpad', function (event, handler) {
                    $(".btn-create-po").trigger("click");
                    event.preventDefault();
                });
                
                hotkeys(self.config.keyboard_sale_order, 'Numpad', function (event, handler) {
                    $(".btn-create-so").trigger("click");
                    event.preventDefault();
                });
                
                hotkeys(self.config.keyboard_unlock, 'Numpad', function (event, handler) {
                    $(".btn-unlock").trigger("click");
                    event.preventDefault();
                });
                
                hotkeys(self.config.keyboard_voucher, 'Numpad', function (event, handler) {
                    $(".btn-voucher").trigger("click");
                    event.preventDefault();
                });
                
                hotkeys(self.config.keyboard_lock_screen, 'Numpad', function (event, handler) {
                    $(".btn-lock-screen").trigger("click");
                    event.preventDefault();
                });
                
                hotkeys(self.config.keyboard_internal_transfer, 'Numpad', function (event, handler) {
                    $(".btn-internal").trigger("click");
                    event.preventDefault();
                });
                
                hotkeys(self.config.keyboard_lock_session, 'Numpad', function (event, handler) {
                    $(".btn-lock-session").trigger("click");
                    event.preventDefault();
                });
                // upto this
                
                return rpc.query({
                    model: 'pos.config',
                    method: 'search_read',
                    domain: [['user_id', '!=', null]],
                    fields: [],
                }).then(function (configs) {
                    self.config_by_id = {};
                    self.configs = configs;
                    for (var i = 0; i < configs.length; i++) {

                        var config = configs[i];
                        self.config_by_id[config['id']] = config;
                    }
                    ;
                    if (self.config_id) {
                        var config = _.find(configs, function (config) {
                            return config['id'] == self.config_id
                        })
                        if (config) {
                            var user = self.user_by_id[config.user_id[0]]
                            if (user) {
                                self.set_cashier(user);
                            }
                        }
                    }
                });
            })
        }
    });
});
