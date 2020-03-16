"use strict";
odoo.define('pos_retail.screens', function (require) {

    var models = require('point_of_sale.models');
    var screens = require('point_of_sale.screens');
    var core = require('web.core');
    var utils = require('web.utils');
    var round_pr = utils.round_precision;
    var _t = core._t;
    var gui = require('point_of_sale.gui');
    var rpc = require('pos.rpc');
    var qweb = core.qweb;

    var TablesScreenWidget = screens.ScreenWidget.extend({
        template: 'TableScreenWidget',
        init: function (parent, options) {
            this._super(parent, options);
        },
        start: function () {
            var self = this;
            this._super();
            this.pos.bind('update:table-list', function () {
                self.renderElement();
            })
        },
        renderElement: function () {
            var self = this;
            this._super();
            var orders = this.pos.get('orders').models;
            var current_order = this.pos.get('selectedOrder');
            for (var i = 0; i < orders.length; i++) {
                var table = orders[i].table;
                if (table) {
                    var tablewidget = $(qweb.render('Table', {
                        widget: this,
                        table: table,
                    }));
                    tablewidget.data('id', table.id);
                    this.$('.table-items').append(tablewidget);
                    if (current_order) {
                        if (current_order.uid == orders[i].uid) {
                            tablewidget.css('background', 'rgb(110,200,155)');
                        }
                    }
                }
            }
            this.$('.table-item').on('click', function () {
                var table_id = parseInt($(this).data()['id']);
                self.clickTable(table_id);
                $(this).css('background', 'rgb(110,200,155)');
            });
        },
        get_order_by_table: function (table) {
            var orders = this.pos.get('orders').models;
            var order = orders.find(function (order) {
                if (order.table) {
                    return order.table.id == table.id;
                }
            });
            return order;
        },
        clickTable: function (table_id) {
            var self = this;
            var tables = self.pos.tables_by_id;
            var table = tables[table_id];
            if (table) {
                var order_click = this.get_order_by_table(table)
                if (order_click) {
                    this.pos.set('selectedOrder', order_click);
                    order_click.trigger('change', order_click);
                }
            }
            var items = this.$('.table-item');
            for (var i = 0; i < items.length; i++) {
                if (parseInt($(items[i]).data()['id']) != table_id) {
                    $(items[i]).css('background', '#fff');
                }
            }
        }
    });

    screens.ClientListScreenWidget.include({
        start: function () {
            var self = this;
            this._super();
            if (this.pos.config.keyboard_search) { // keyboard
                hotkeys(this.pos.config.keyboard_search, function (event, handler) {
                    var search_box = self.el.querySelector('.searchbox input');
                    if (search_box) {
                        search_box.value = '';
                        search_box.focus();
                    }
                });
            }
            this.pos.bind('update:point-client', function () {
                var partners = self.pos.db.get_partners_sorted(1000);
                self.re_render_list(partners);
            });
            this.pos.bind('sync:partner', function (customer_data) {
                if (customer_data) {
                    var partner_exist = false;
                    for (var i = 0; i < self.pos.partners.length; i++) {
                        var partner = self.pos.partners[i];
                        if (partner['id'] == customer_data['id']) {
                            partner = customer_data;
                            self.pos.db.partner_by_id[customer_data['id']] = null; // set null because odoo cache by id, if have data partner_by_id, odoo will continue loop
                            self.pos.db.add_partners([customer_data]);
                            partner_exist = true;
                        }
                    }
                    if (partner_exist == false) {
                        self.pos.partners.push(customer_data);
                        self.pos.db.add_partners([customer_data]);
                    }
                    var partners = self.pos.db.get_partners_sorted();
                    self.partner_cache = new screens.DomCache();
                    self.render_list(partners);
                }
            });
            
            hotkeys('left', 'Clients', function (event, handler) { 
		    	self.gui.back();
		    });	
        },
        re_render_list: function (partners) {
            var contents = this.$el[0].querySelector('.client-list-contents');
            contents.innerHTML = "";
            for (var i = 0, len = Math.min(partners.length, 1000); i < len; i++) {
                var partner = partners[i];
                var clientline_html = qweb.render('ClientLine', {widget: this, partner: partners[i]});
                var clientline = document.createElement('tbody');
                clientline.innerHTML = clientline_html;
                clientline = clientline.childNodes[1];
                this.partner_cache.cache_node(partner.id, clientline);
                if (partner === this.old_client) {
                    clientline.classList.add('highlight');
                } else {
                    clientline.classList.remove('highlight');
                }
                contents.appendChild(clientline);
            }
        },
        show: function () {
            var self = this;
            this._super();
            var $search_box = $('.clientlist-screen .searchbox >input');
            $search_box.autocomplete({
                source: this.pos.db.partners_autocomplete,
                minLength: this.pos.minLength,
                select: function (event, ui) {
                    if (ui && ui['item'] && ui['item']['value']) {
                        var partner = self.pos.db.partner_by_id[parseInt(ui['item']['value'])];
                        if (partner) {
                            self.pos.get_order().set_client(partner);
                            self.pos.gui.back();
                        }
                        setTimeout(function () {
                            self.clear_search();
                        }, 10);
                    }
                },
                
                // Added by AARSOL		        
                _renderItem: function(table, item) {    
                    return $("<tr class='ui-menu-item'  role='presentation'>") 
                        .data( "item.autocomplete", item )                           
                        .append( "<td style='padding:0 4px;float:left;width:50px;'>"+item.value+"</td>"
                                +"<td style='padding:0 4px;float:left;width:500px;'>"+item.label+"</td>"
                                +"<td style='padding:0 4px;float:right;width:50px;'>"+"20.00"+"</td>" )                                                       
                        .appendTo(table);
                },		        

            });
            this.$('.only_customer').click(function () {
                self.pos.only_customer = !self.pos.only_customer;
                self.pos.only_supplier = !self.pos.only_customer;
                if (self.pos.only_customer) {
                    self.$('.only_customer').addClass('highlight');
                    self.$('.only_supplier').removeClass('highlight');
                } else {
                    self.$('.only_customer').removeClass('highlight');
                    self.$('.only_supplier').addClass('highlight');
                }
                var partners = self.pos.db.get_partners_sorted(1000);
                self.render_list(partners);
            });
            this.$('.only_supplier').click(function () {
                self.pos.only_supplier = !self.pos.only_supplier;
                self.pos.only_customer = !self.pos.only_supplier;
                if (self.pos.only_supplier) {
                    self.$('.only_supplier').addClass('highlight');
                    self.$('.only_customer').removeClass('highlight');
                } else {
                    self.$('.only_supplier').removeClass('highlight');
                    self.$('.only_customer').addClass('highlight');
                }
                var partners = self.pos.db.get_partners_sorted(1000);
                self.render_list(partners);
            });
            
            hotkeys.setScope('Clients');
        },
        hide: function () {
		    this._super();
		    hotkeys.setScope('Numpad');
		},
        render_list: function (partners) {
            if (this.pos.only_customer) {
                var partners = _.filter(partners, function (partner) {
                    return partner['customer'] == true;
                })
                return this._super(partners);
            }
            if (this.pos.only_supplier) {
                var partners = _.filter(partners, function (partner) {
                    return partner['supplier'] == true;
                })
                return this._super(partners);
            }
            return this._super(partners);
        },
    });
		
    screens.NumpadWidget.include({
        renderElement: function () {
            var self = this;
            this._super();
            $('.show_hide_pads').click(function () {
                var order = self.pos.get_order();
                if (!self.pos.hide_pads || self.pos.hide_pads == false) {
                    //$('.show_hide_buttons').click();
                    $('.actionpad').animate({height: 0}, 'slow');
                    $('.numpad').animate({height: 0}, 'slow');
                    
                    $('.set-customer').addClass('oe_hidden');
                    $('.pay').addClass('oe_hidden');
                    $('.no-pay').addClass('oe_hidden');
                    
                    $('.show_hide_pads').toggleClass('fa-caret-down fa-caret-up');
                    // for (var i = 0; i < self.gui.screen_classes.length; i++) {
                    //     var classe = self.gui.screen_classes[i];
                    //     if (classe['name'] && classe['name'] == 'payment') {
                    //         var payment_screen = new classe.widget(self, {});
                    //         payment_screen.appendTo($('.rightpane .content-row'));
                    //         $('.rightpane .quickly_buttons').addClass('oe_hidden');
                    //         $('.rightpane .content-cell').addClass('oe_hidden');
                    //         $('.rightpane .categories').addClass('oe_hidden');
                    //         $('.rightpane .right-content').animate({scrollTop: '0px'}, 0);
                    //         $('.payment-screen .back').remove();
                    //         $('.payment-screen .button_left').css({'left': '0px'});
                    //         $('.payment-screen .button_bottom').css({'left': '200px'});
                    //         $('.rightpane .right-content').animate({scrollTop: '0px'}, 0);
                    //         $('.breadcrumbs').addClass('oe_hidden');
                    //     }
                    // }
                    self.pos.hide_pads = true;
                } else {
                    //$('.show_hide_buttons').click();
                    $('.breadcrumbs').removeClass('oe_hidden');
                    $('.actionpad').animate({height: '29%'}, 'slow');
                    $('.numpad').animate({height: '100%'}, 'slow');
                    $('.set-customer').removeClass('oe_hidden');
                    $('.pay').removeClass('oe_hidden');
                    $('.no-pay').removeClass('oe_hidden');
                    $('.show_hide_pads').toggleClass('fa-caret-down fa-caret-up');
                    
                    // $('.button .back').removeClass('oe_hidden');
                    // $('.rightpane .payment-screen').remove();
                    // $('.rightpane .quickly_buttons').removeClass('oe_hidden');
                    // $('.rightpane .content-cell').removeClass('oe_hidden');
                    // $('.payment-screen .back').removeClass('oe_hidden');
                    // $('.breadcrumbs').removeClass('oe_hidden');
                    // $('.rightpane .categories').removeClass('oe_hidden');
                    self.pos.hide_pads = false;
                }
            });
        },
        start: function () {
            var self = this;
            this._super();
            if (this.pos.config.keyboard_price) {
                hotkeys(this.pos.config.keyboard_price, 'Numpad', function (event, handler) {
                    self.state.changeMode('price');

                });
            }
            if (this.pos.config.keyboard_quantity) {
                hotkeys(this.pos.config.keyboard_quantity, 'Numpad', function (event, handler) {
                    self.state.changeMode('quantity');

                });
            }
            if (this.pos.config.keyboard_discount) {
                hotkeys(this.pos.config.keyboard_discount, 'Numpad', function (event, handler) {
                    self.state.changeMode('discount');
                });
            }                    

            hotkeys('1,2,3,4,5,6,7,8,9,0,_0,_1,_2,_3,_4,_5,_6,_7,_8,_9,_point,backspace', 'Numpad', function (event, handler) {                
                switch(handler.key){
                    case "1": case "_1": $(".aarsol_one").trigger("click"); break;
                    case "2": case "_2": $(".aarsol_two").trigger("click"); break;
                    case "3": case "_3": $(".aarsol_three").trigger("click"); break;
                    case "4": case "_4": $(".aarsol_four").trigger("click"); break;
                    case "5": case "_5": $(".aarsol_five").trigger("click"); break;
                    case "6": case "_6": $(".aarsol_six").trigger("click"); break;
                    case "7": case "_7": $(".aarsol_seven").trigger("click"); break;
                    case "8": case "_8": $(".aarsol_eight").trigger("click"); break;
                    case "9": case "_9": $(".aarsol_none").trigger("click"); break;
                    case "0": case "_0": $(".aarsol_zero").trigger("click"); break;
                    case ".": case "_point": $(".aarsol_dot").trigger("click"); break;
                    case "backspace": $(".aarsol_numpad_backspace").trigger("click"); break;
                }                
            });
            
            
        },
        applyAccessRights: function() {
		    var cashier = this.pos.get('cashier') || this.pos.get_cashier();		   
		    var has_price_control_rights = !this.pos.config.restrict_price_control || cashier.role == 'manager';
		   	    	    
		    this.$el.find('.mode-button[data-mode="price"]')
		        .toggleClass('disabled-mode', !has_price_control_rights)
		        .prop('disabled', !has_price_control_rights);
		        
		    this.$el.find('.mode-button[data-mode="discount"]')
		        .toggleClass('disabled-mode', !has_price_control_rights)
		        .prop('disabled', !has_price_control_rights);
		    	    		    
		    if (!has_price_control_rights && this.state.get('mode')=='price'){
		        this.state.changeMode('quantity');
		    }
		},
    });

    screens.ProductScreenWidget.include({
        init: function () {
            var self = this;
            this._super.apply(this, arguments);
        },
        start: function () {
            var self = this;
            this._super();
            
            // added by AARSOL
            if (this.pos.config.keyboard_search) {
                hotkeys(this.pos.config.keyboard_search, function (event, handler) {
                    var search_box = self.el.querySelector('.rightpane-header .searchbox input');
                    if (search_box) {
                        search_box.value = '';
                        search_box.focus();
                    }
                });
            }
            if (this.pos.config.keyboard_payment) {
                hotkeys(this.pos.config.keyboard_payment, 'Numpad', function (event, handler) {
                    self.$('.pay').click();
                });
            }
            if (this.pos.config.keyboard_add_client) {
                hotkeys(this.pos.config.keyboard_add_client, 'Numpad', function (event, handler) {
                    self.$('.set-customer').click();
                });
            }
            
            hotkeys('up', 'Numpad', function (event, handler) {
                if ($('li.selected').is(':not(:first-child)')){
				                
				    var cur_li = $("li.selected");
				    var pre_li = $("li.selected").prev();
				    if(pre_li){
				        cur_li.removeClass('selected');
				        pre_li.addClass('selected');
				    	$("li.selected").trigger("click");
				    }
				}
				var selectedElement = $(".orderline.selected");
				if(selectedElement){
				    var currentPositionY = selectedElement.position().top;
				    var elementIndex = selectedElement.index();
				    var elementHeight = 55;
				    var scrollTo = elementIndex * 55;
				                
				    $(".order-scroller").scrollTop(scrollTo);
				}
				event.preventDefault() 
            });
            
            hotkeys('down', 'Numpad', function (event, handler) {
                if ($('li.selected').is(':not(:last-child)')){
				                
				    var cur_li = $("li.selected");
				    var next_li = $("li.selected").next();
					cur_li.removeClass('selected');
					next_li.addClass('selected');
					$("li.selected").trigger("click");
				}
				
				var selectedElement = $(".orderline.selected");
				if(selectedElement){
				    var currentPositionY = selectedElement.position().top;
				    var elementIndex = selectedElement.index();
				    var leftPaneHeight = $(".order-scroller").height();
				    var elementHeight = 55;
				    if(currentPositionY + elementHeight > leftPaneHeight){
				        var scrollTo = parseInt(currentPositionY);
				        $(".order-scroller").scrollTop(scrollTo);
				    }
				                
				    /*                        
				        var scrollTo = elementIndex * 55;
				    */				                
		        }
		        event.preventDefault() 
            });
            var action_buttons = this.action_buttons;
            for (var key in action_buttons) {
                action_buttons[key].appendTo(this.$('.button-list'));
            }
            this.$('.control-buttons').addClass('oe_hidden');
        },
        show: function () {
            var self = this;
            this._super();
            

            // Added by AARSOL
			/*
            $('.set-customer').click(function () { 
                self.pos.gui.show_screen('clientlist');
            });
            */			
            // -------------------------------
            // quickly add product
            // quickly add customer
            // quickly payment
            // -------------------------------
            this.$('.add_customer').click(function () { // quickly add customer
                self.pos.gui.show_popup('popup_create_customer', {
                    title: 'Add customer',
                    confirm: function () {
                        var fields = {};
                        $('.partner_input').each(function (idx, el) {
                            fields[el.name] = el.value || false;
                        });
                        if (!fields.name) {
                            return self.pos.gui.show_popup('confirm', {
                                title: 'Error',
                                body: 'A Partner name is required'
                            });
                        }
                        if (this.uploaded_picture) {
                            fields.image = this.uploaded_picture.split(',')[1];
                        }
                        if (fields['partner_type'] == 'customer') {
                            fields['customer'] = true;
                        }
                        if (fields['partner_type'] == 'vendor') {
                            fields['supplier'] = true;
                        }
                        if (fields['partner_type'] == 'customer_and_vendor') {
                            fields['customer'] = true;
                            fields['supplier'] = true;
                        }
                        if (fields['property_product_pricelist']) {
                            fields['property_product_pricelist'] = parseInt(fields['property_product_pricelist'])
                        }
                        return rpc.query({
                            model: 'res.partner',
                            method: 'create',
                            args: [fields]
                        }).then(function (partner_id) {
                            console.log('{partner_id} created : ' + partner_id)
                        }, function (type, err) {
                            if (err.code && err.code == 200 && err.data && err.data.message && err.data.name) {
                                self.pos.gui.show_popup('confirm', {
                                    title: err.data.name,
                                    body: err.data.message,
                                })
                            } else {
                                self.pos.gui.show_popup('confirm', {
                                    title: 'Error',
                                    body: 'Odoo connection fail, could not save'
                                })
                            }
                        });

                    }
                })
            });
            this.$('.add_product').click(function () { // quickly add product
                self.pos.gui.show_popup('popup_create_product', {
                    title: 'Add product',
                    confirm: function () {
                        var fields = {};
                        $('.product_input').each(function (idx, el) {
                            fields[el.name] = el.value || false;
                        });
                        if (!fields.name) {
                            return self.pos.gui.show_popup('confirm', {
                                title: 'Error',
                                body: 'A Product name is required'
                            });
                        }
                        if (this.uploaded_picture) {
                            fields.image = this.uploaded_picture.split(',')[1];
                        }
                        if (fields['pos_categ_id']) {
                            fields['pos_categ_id'] = parseInt(fields['pos_categ_id'])
                        }
                        return rpc.query({
                            model: 'product.product',
                            method: 'create',
                            args: [fields]
                        }).then(function (product_id) {
                            console.log('{product_id} created : ' + product_id)
                        }, function (type, err) {
                            if (err.code && err.code == 200 && err.data && err.data.message && err.data.name) {
                                self.pos.gui.show_popup('confirm', {
                                    title: err.data.name,
                                    body: err.data.message,
                                })
                            } else {
                                self.pos.gui.show_popup('confirm', {
                                    title: 'Error',
                                    body: 'Odoo connection fail, could not save'
                                })
                            }
                        });

                    }
                })
            });
            this.$('.quickly_payment').click(function () { // quickly payment
                if (!self.pos.config.quickly_payment_full_journal_id) {
                    return self.pos.gui.show_popup('confirm', {
                        title: 'Error',
                        body: 'Your pos config not set quickly payment journal'
                    })
                }
                var order = self.pos.get_order();
                if (order.orderlines.length == 0) {
                    return self.pos.gui.show_popup('confirm', {
                        title: 'Error',
                        body: 'Your order empty'
                    })
                }
                var paymentlines = order.get_paymentlines();
                for (var i = 0; i < paymentlines.length; i++) {
                    paymentlines[i].destroy();
                }
                var register = _.find(self.pos.cashregisters, function (register) {
                    return register['journal']['id'] == self.pos.config.quickly_payment_full_journal_id[0];
                });
                if (!register) {
                    return self.pos.gui.show_popup('confirm', {
                        title: 'Error',
                        body: 'Your config not add quickly payment method, please add before use'
                    })
                }
                var amount_due = order.get_due();
                order.add_paymentline(register);
                var selected_paymentline = order.selected_paymentline;
                selected_paymentline.set_amount(amount_due);
                order.initialize_validation_date();
                self.pos.push_order(order);
                self.pos.gui.show_screen('receipt');

            });
            // change view products
            this.$('.product_list').click(function () {
                self.pos.config.product_view = 'list';
                self.product_list_widget = new screens.ProductListWidget(self, {
                    click_product_action: function (product) {
                        self.click_product(product);
                    },
                    product_list: self.pos.db.get_product_by_category(0)
                });
                self.product_list_widget.replace(self.$('.product-list-container'));
                self.product_categories_widget = new screens.ProductCategoriesWidget(self, {
                    product_list_widget: self.product_list_widget,
                });
                self.$('.category-list-scroller').remove();
                self.$('.categories').remove();
                self.product_categories_widget.replace(self.$('.rightpane-header'));
            })
            this.$('.product_box').click(function () {
                self.pos.config.product_view = 'box';
                self.product_list_widget = new screens.ProductListWidget(self, {
                    click_product_action: function (product) {
                        self.click_product(product);
                    },
                    product_list: self.pos.db.get_product_by_category(0)
                });
                self.product_list_widget.replace(self.$('.product-list-container'));
                self.product_categories_widget = new screens.ProductCategoriesWidget(self, {
                    product_list_widget: self.product_list_widget,
                });
                self.$('.category-list-scroller').remove();
                self.$('.categories').remove();
                self.product_categories_widget.replace(self.$('.rightpane-header'));
            });
            this.$('.lock_session').click(function () {
                $('.pos-content').addClass('oe_hidden');
                $('.pos-topheader').addClass('oe_hidden');
                return self.pos.gui.show_popup('popup_lock_session', {
                    title: 'Locked',
                    body: 'Use pos security pin for unlock',
                    confirm: function (pw) {
                        if (!self.pos.user.pos_security_pin) {
                            $('.pos-content').removeClass('oe_hidden');
                            $('.pos-topheader').removeClass('oe_hidden');
                            return self.pos.gui.close_popup();
                        }
                        else if (pw !== self.pos.user.pos_security_pin) {
                            self.pos.gui.show_popup('confirm', {
                                title: 'Warning',
                                body: 'Wrong pos security pin'
                            });
                            return setTimeout(function () {
                                $('.lock_session').click();
                            }, 2000);
                        } else {
                            $('.pos-content').removeClass('oe_hidden');
                            $('.pos-topheader').removeClass('oe_hidden');
                            return self.pos.gui.close_popup();
                        }
                    }
                });
            });
            this.$('.clear_blank_order').click(function () {
                var orders = self.pos.get('orders');
                for (var i = 1; i < orders.models.length; i++) {
                    var order = orders.models[i];
                    if (order.orderlines.models.length == 0) {
                        order.destroy({'reason': 'abandon'});
                    }
                }
            });
            this.$('.daily_report').click(function () {
                self.pos.gui.show_screen('daily_report');
            });
            this.$('.print_receipt').click(function () {
                var order = self.pos.get_order();
                if (!order || order.orderlines.length == 0) {
                    return self.pos.gui.show_popup('confirm', {
                        title: 'Warning',
                        body: 'Your Order blank'
                    });
                }
                if (self.pos.config.lock_order_printed_receipt) {
                    return self.pos.gui.show_popup('confirm', {
                        title: _t('Are you want print receipt?'),
                        body: 'If POS-BOX(printer) is ready config IP, please check receipt at printer, else if POS-BOX and printer not ready will go to Receipt Screen',
                        confirm: function () {
                            var order = self.pos.get_order();
                            if (order) {
                                order['lock'] = true;
                                this.pos.lock_order();
                                this.pos.pos_bus.push_message_to_other_sessions({
                                    data: order.uid,
                                    action: 'lock_order',
                                    bus_id: this.pos.config.bus_id[0],
                                    order_uid: order['uid']
                                });
                                return self.pos.gui.show_screen('receipt_review');
                            }
                        }
                    });
                } else {
                    return self.pos.gui.show_screen('receipt_review');
                }
            });
            var $find_product_box = $('.product-screen .searchbox >input');
            $find_product_box.autocomplete({
                source: this.pos.db.products_autocomplete,
                minLength: this.pos.minLength,
                select: function (event, ui) {
                    if (ui && ui['item'] && ui['item']['value'])
                        var product = self.pos.db.get_product_by_id(ui['item']['value']);
                    setTimeout(function () {
                        $('.product-screen .searchbox >input')[1].value = '';
                    }, 10);
                    if (product) {
                        return self.pos.get_order().add_product(product);
                    }

                },
                
                // added by AARSOL		        
                _renderItem: function(table, item) {    
                    return $("<tr class='ui-menu-item'  role='presentation'>") 
                        .data( "item.autocomplete", item )                           
                        .append( "<td style='padding:0 4px;float:left;width:50px;'>"+item.value+"</td>"
                                +"<td style='padding:0 4px;float:left;width:500px;'>"+item.label+"</td>"
                                +"<td style='padding:0 4px;float:right;width:50px;'>"+"25.00"+"</td>" )                                                       
                        .appendTo(table);
                },		        

            });
            var $find_customer_box = $('.find_customer >input');
            $find_customer_box.autocomplete({
                source: this.pos.db.partners_autocomplete,
                minLength: this.pos.minLength,
                select: function (event, ui) {
                    if (ui && ui['item'] && ui['item']['value']) {
                        var partner = self.pos.db.partner_by_id[parseInt(ui['item']['value'])];
                        if (partner) {
                            self.pos.get_order().set_client(partner);
                            setTimeout(function () {
                                var input = self.el.querySelector('.find_customer input');
                                input.value = '';
                                input.focus();
                            }, 10);

                        }
                    }
                },
                
                // added by AARSOL		        
                renderItem: function(table, item) {    
                    return $("<tr class='ui-menu-item'  role='presentation'>") 
                        .data( "item.autocomplete", item )                           
                        .append( "<td style='padding:0 4px;float:left;width:50px;'>"+item.value+"</td>"
                                +"<td style='padding:0 4px;float:left;width:500px;'>"+item.label+"</td>"
                                +"<td style='padding:0 4px;float:right;width:50px;'>"+"35.00"+"</td>" )                                                       
                        .appendTo(table);
                },		        

            });

        }
    });

    screens.ActionButtonWidget.include({
        highlight: function (highlight) {
            this._super(highlight)
            if (highlight) {
                this.$el.addClass('highlight');
            } else {
                this.$el.removeClass('highlight');
            }
        },
        altlight: function (altlight) {
            this._super(altlight)
            if (altlight) {
                this.$el.addClass('btn-info');
            } else {
                this.$el.removeClass('btn-info');
            }
        }
    });

    screens.ProductListWidget.include({
        init: function (parent, options) {
            var self = this;
            this._super(parent, options);
            // bind action only for v10
            // we are only change price of items display, not loop and change all, lost many memory RAM
            this.pos.bind('product:change_price_list', function (products) {
                try {
                    var $products_element = $('.product .product-img .price-tag');
                    for (var i = 0; i < $products_element.length; i++) {
                        var element = $products_element[i];
                        var product_id = parseInt(element.parentElement.parentElement.dataset.productId);
                        var product = self.pos.db.product_by_id(product_id);
                        if (product) {
                            var product = products[i];
                            var $product_el = $("[data-product-id='" + product['id'] + "'] .price-tag");
                            $product_el.html(self.format_currency(product['price']) + '/' + product['uom_id'][1]);
                        }
                    }
                } catch (e) {
                }
            });
            this.pos.bind('sync:product', function (product_data) { // product list update screen
                // update database products auto complete
                self.pos.db.products_autocomplete = _.filter(self.pos.db.products_autocomplete, function (values) {
                    return values['value'] != product_data['id'];
                })
                var label = "";
                if (product_data['default_code']) {
                    label = '[' + product_data['default_code'] + ']'
                }
                if (product_data['barcode']) {
                    label = '[' + product_data['barcode'] + ']'
                }
                if (product_data['display_name']) {
                    label = '[' + product_data['display_name'] + ']'
                }
                if (product_data['description']) {
                    label = '[' + product_data['description'] + ']'
                }
                self.pos.db.products_autocomplete.push({
                    value: product_data['id'],
                    label: label
                })
                // trigger update data of product and change products screen
                // odoo version 10
                if (self.pos.server_version == 10) {
                    self.pos.db.add_products([product_data]);
                    self.pos.db.product_by_id[product_data['id']] = product_data;
                    self.product_cache.cache_node(product_data['id'], null);
                    var product_node = self.render_product(product_data);
                    product_node.addEventListener('click', self.click_product_handler);
                    var $product_el = $(".product-list " + "[data-product-id='" + product_data['id'] + "']");
                    if ($product_el.length > 0) {
                        $product_el.replaceWith(product_node);
                    }
                }
                // odoo version 11
                if (self.pos.server_version == 11) {
                    self.product_cache = new screens.DomCache();
                    self.pos.db.product_by_category_id = {};
                    self.pos.db.category_search_string = {};
                    self.pos.db.product_by_barcode = {};
                    var products = [];
                    for (var product_id in self.pos.db.product_by_id) {
                        var product = self.pos.db.product_by_id[product_id];
                        product['product_tmpl_id'] = [product['product_tmpl_id'], product['display_name']]
                        if (product['id'] != product_data['id']) {
                            products.push(product);
                        } else {
                            products.push(product_data)
                        }
                    }
                    // check new product add from backend
                    var product_exist = _.filter(products, function (product) {
                        return product['id'] == product_data['id'];
                    });
                    if (product_exist.length == 0) {
                        products.push(product_data)
                    }
                    self.pos.db.add_products(_.map(products, function (product) {
                        product.categ = _.findWhere(self.pos.product_categories, {'id': product.categ_id[0]});
                        return new models.Product({}, product);
                    }));
                    self.product_list = self.pos.db.get_product_by_category(0);
                    self.renderElement();
                }
            });
            this.mouse_down = false;
            this.moved = false;
            this.auto_tooltip;
            this.product_mouse_down = function (e) {
                if (e.which == 1) {
                    $('#info_tooltip').remove();
                    self.right_arrangement = false;
                    self.moved = false;
                    self.mouse_down = true;
                    self.touch_start(this.dataset.productId, e.pageX, e.pageY);
                }
            };
            this.product_mouse_move = function (e) {
                if (self.mouse_down) {
                    self.moved = true;
                }
            };
        },
        touch_start: function (product_id, x, y) {
            var self = this;
            this.auto_tooltip = setTimeout(function () {
                if (self.moved == false) {
                    this.right_arrangement = false;
                    var product = self.pos.db.get_product_by_id(parseInt(product_id));
                    var inner_html = self.generate_html(product);
                    $('.product-list-container').prepend(inner_html);
                    $(".close_button").on("click", function () {
                        $('#info_tooltip').remove();
                    });
                }
            }, 30);
        },
        generate_html: function (product) {
            var self = this;
            var product_tooltip_html = qweb.render('product_tooltip', {
                widget: self,
                product: product,
                field_load_check: self.pos.db.field_load_check
            });
            return product_tooltip_html;
        },
        touch_end: function () {
            if (this.auto_tooltip) {
                clearTimeout(this.auto_tooltip);
            }
        },
        render_product: function (product) {
            if (this.pos.config.product_view == 'box') {
                return this._super(product)
            } else {
                if (this.pos.server_version == 10) {
                    var cached = this.product_cache.get_node(product.id);
                    if (!cached) {
                        var product_html = qweb.render('Product', {
                            widget: this,
                            product: product,
                            image_url: this.get_product_image_url(product),
                        });
                        var product_node = document.createElement('tbody');
                        product_node.innerHTML = product_html;
                        product_node = product_node.childNodes[1];
                        this.product_cache.cache_node(product.id, product_node);
                        return product_node;
                    }
                    return cached;
                }
                if (this.pos.server_version == 11) {
                    var current_pricelist = this._get_active_pricelist();
                    var cache_key = this.calculate_cache_key(product, current_pricelist);
                    var cached = this.product_cache.get_node(cache_key);
                    if (!cached) {
                        var product_html = qweb.render('Product', {
                            widget: this,
                            product: product,
                            pricelist: current_pricelist,
                            image_url: this.get_product_image_url(product),
                        });
                        var product_node = document.createElement('tbody');
                        product_node.innerHTML = product_html;
                        product_node = product_node.childNodes[1];
                        this.product_cache.cache_node(cache_key, product_node);
                        return product_node;
                    }
                    return cached;
                }
            }
        },
        renderElement: function () {
            if (this.pos.config.product_view == 'box') {
                this._super();
            } else {
                var el_str = qweb.render(this.template, {widget: this});
                var el_node = document.createElement('div');
                el_node.innerHTML = el_str;
                el_node = el_node.childNodes[1];

                if (this.el && this.el.parentNode) {
                    this.el.parentNode.replaceChild(el_node, this.el);
                }
                this.el = el_node;
                var list_container = el_node.querySelector('.product-list-contents');
                for (var i = 0, len = this.product_list.length; i < len; i++) {
                    var product_node = this.render_product(this.product_list[i]);
                    product_node.addEventListener('click', this.click_product_handler);
                    list_container.appendChild(product_node);
                }
            }
            if (this.pos.config.tooltip) {
                var caches = this.product_cache;
                for (var cache_key in caches.cache) {
                    var product_node = this.product_cache.get_node(cache_key);
                    product_node.addEventListener('click', this.click_product_handler);
                    product_node.addEventListener('mousedown', this.product_mouse_down);
                    product_node.addEventListener('mousemove', this.product_mouse_move);
                }
                $(".product-list-scroller").scroll(function (event) {
                    $('#info_tooltip').remove();
                });
            }
            
            // For Search
            /*
            var $search_box = $('.product-screen .searchbox.find_product >input');
            $search_box.autocomplete({
            	appendTo: "#productlist",
                source: this.pos.db.products_autocomplete,
                minLength: 2,
                autoFocus: true,                     
                position: {  collision: "flip", at: "right bottom" , my: "right top" },             
                select: function (event, ui) {
                    if (ui && ui['item'] && ui['item']['value'])
                        var product = self.pos.db.get_product_by_id(ui['item']['value']);
                    setTimeout(function () {
                        this.$('.searchbox.find_product input')[0].value = '';
                    }, 10);
                    if (product) {
                        return self.pos.get_order().add_product(product);
                    }

                },
                _renderItem: function(table, item) {    
                    return $("<tr class='ui-menu-item'  role='presentation'>") 
                        .data( "item.autocomplete", item )                           
                        .append( "<td style='padding:0 4px;float:left;width:50px;'>"+item.value+"</td>"
                                +"<td style='padding:0 4px;float:left;width:500px;'>"+item.label+"</td>"
                                +"<td style='padding:0 4px;float:right;width:50px;'>"+"55.00"+"</td>" )                                                       
                        .appendTo(table);
                },
                open: function(){
                    $('.ui-autocomplete').css('width', '1000px'); // HERE
                }
            });
            */

        },
        _get_active_pricelist: function () {
            var current_order = this.pos.get_order();
            var current_pricelist = this.pos.default_pricelist;
            if (current_order && current_order.pricelist) {
                return this._super()
            } else {
                return current_pricelist
            }
        }
    });
    screens.ScreenWidget.include({

        show: function () {
            var self = this;
            this._super();
            $('.pos-logo').replaceWith();
            this.pos.barcode_reader.set_action_callback({ // bind device scan return order
                'order': _.bind(self.barcode_order_return_action, self),
            });
            if (this.pos.config.is_customer_screen) {
                $('.pos .leftpane').css('left', '0px');
                $('.pos .rightpane').css('left', '440px');
                $('.show_hide_buttons').remove()
                $('.quickly_buttons').remove()
                $('.layout-table').replaceWith();
                $('.buttons_pane').replaceWith();
                $('.collapsed').replaceWith();
                var image_url = window.location.origin + '/web/image?model=pos.config.image&field=image&id=';
                var images = self.pos.images;
                for (var i = 0; i < images.length; i++) {
                    images[i]['image_url'] = 'background-image:url(' + image_url + images[i]['id'] + ')';
                }
                this.$('.rightpane').append(qweb.render('customer_screen', {
                    widget: this,
                    images: images,
                }));
                new Swiper('.gallery-top', {
                    spaceBetween: 10,
                    navigation: {
                        nextEl: '.swiper-button-next',
                        prevEl: '.swiper-button-prev',
                    },
                    autoplay: {
                        delay: self.pos.config.delay,
                        disableOnInteraction: false,
                    }
                });
                new Swiper('.gallery-thumbs', {
                    spaceBetween: 10,
                    centeredSlides: true,
                    slidesPerView: 'auto',
                    touchRatio: 0.2,
                    slideToClickedSlide: true,
                    autoplay: {
                        delay: self.pos.config.delay,
                        disableOnInteraction: false,
                    }
                });
            }
        },
        // multi scanner barcode
        // controller of barcode scanner
        // Please dont change this function because
        // 1) we're have multi screen and multi barcode type
        // 2) at each screen we're have difference scan and parse code
        // 3) default of odoo always fixed high priority for scan products
        barcode_product_action: function (code) {
            var current_screen = this.pos.gui.get_current_screen();
            if (current_screen && current_screen == 'return_products') {
                this.scan_return_product(code);
            }
            if (current_screen && current_screen == 'login_page') {
                this.scan_barcode_user(code);
            }
            if (current_screen != 'return_products' && current_screen != 'login_page') {
                return this._super(code)
            }
        },
        barcode_order_return_action: function (datas_code) {
            if (datas_code && datas_code['type']) {
                console.log('{scanner}' + datas_code.type);
            }
            if (datas_code.type == 'order') {
                var order = this.pos.db.order_by_ean13[datas_code['code']]
                var order_lines = this.pos.db.lines_by_order_id[order.id];
                if (!order_lines) {
                    this.barcode_error_action(datas_code);
                    return false;
                } else {
                    this.gui.show_popup('popup_return_pos_order_lines', {
                        order_lines: order_lines,
                        order: order
                    });
                    return true
                }
            }
        }
    });

    screens.ScaleScreenWidget.include({
        _get_active_pricelist: function () {
            var current_order = this.pos.get_order();
            var current_pricelist = this.pos.default_pricelist;
            if (current_order && current_order.pricelist) {
                return this._super()
            } else {
                return current_pricelist
            }
        }
    });
    screens.OrderWidget.include({
        init: function (parent, options) {
            var self = this;
            this.mouse_down = false;
            this.moved = false;
            this.show_summary = true;  // added by AARSOL
            this.auto_tooltip;
            this._super(parent, options);
            this.line_mouse_down_handler = function (event) {
                self.line_mouse_down(this.orderline, event);
            };
            this.line_mouse_move_handler = function (event) {
                self.line_mouse_move(this.orderline, event);
            };
        },
        // if config lock when print receipt
        // we'll lock order
        change_selected_order: function () {
            var res = this._super();
            var order = this.pos.get_order();
           
            if (order && order.lock && this.pos.config.lock_order_printed_receipt  && order.userlocked != this.pos.config.user_id[0] && this.pos.config.staff_level == 'waiter') {
                this.pos.lock_order();
            } else {
                this.pos.unlock_order();
            }
        },
        touch_start: function (product, x, y) {
            var self = this;
            this.auto_tooltip = setTimeout(function () {
                if (!self.moved) {
                    var inner_html = self.gui.screen_instances.products.product_list_widget.generate_html(product);
                    $('.product-screen').prepend(inner_html);
                    $(".close_button").on("click", function () {
                        $('#info_tooltip').remove();
                    });
                }
            }, 30);
        },
        touch_end: function () {
            if (this.auto_tooltip) {
                clearTimeout(this.auto_tooltip);
            }
        },
        line_mouse_down: function (line, event) {
            var self = this;
            if (event.which == 1) {
                $('#info_tooltip').remove();
                self.moved = false;
                self.mouse_down = true;
                self.touch_start(line.product, event.pageX, event.pageY);
            }
        },
        line_mouse_move: function (line, event) {
            var self = this;
            if (self.mouse_down) {
                self.moved = true;
            }

        },
        rerender_orderline: function (order_line) {
            try {
                this._super(order_line)
            } catch (e) {
                return null;
            }
        },
        render_orderline: function (orderline) {
            var self = this;
            var el_node = this._super(orderline);
            if (this.pos.config.tooltip) {
                el_node.addEventListener('mousedown', this.line_mouse_down_handler);
                el_node.addEventListener('mousemove', this.line_mouse_move_handler);
            }
            // -----------------------------
            // Add sale person to line
            // -----------------------------
            var el_add_sale_person = el_node.querySelector('.add_sale_person');
            if (el_add_sale_person) {
                el_add_sale_person.addEventListener('click', (function () {
                    var list = [];
                    for (var i = 0; i < self.pos.bus_locations.length; i++) {
                        var bus = self.pos.bus_locations[i];
                        list.push({
                            'label': bus['user_id'][1] + '/' + bus['name'],
                            'item': bus
                        })
                    }
                    if (list.length > 0) {
                        return self.pos.gui.show_popup('selection', {
                            title: _t('Select sale person'),
                            list: list,
                            confirm: function (bus) {
                                var user_id = bus['user_id'][0];
                                var user = self.pos.user_by_id[user_id];
                                orderline.set_sale_person(user);
                            },
                        });
                    } else {
                        return this.pos.gui.show_popup('confirm', {
                            title: 'Warning',
                            body: 'Go to Retail (menu) / Shop locations / add sale admin'
                        });
                    }

                }.bind(this)));
            }
            // -----------------------------
            // Change unit of measure of line
            // -----------------------------
            var el_change_unit = el_node.querySelector('.change_unit');
            if (el_change_unit) {
                el_change_unit.addEventListener('click', (function () {
                    var order = self.pos.get_order();
                    var selected_orderline = order.selected_orderline;
                    if (order) {
                        if (selected_orderline) {
                            selected_orderline.change_unit();
                        } else {
                            return self.pos.gui.show_popup('confirm', {
                                title: 'Warning',
                                body: 'Please select line',
                                confirm: function () {
                                    return self.gui.close_popup();
                                },
                                cancel: function () {
                                    return self.gui.close_popup();
                                }
                            });
                        }
                    } else {
                        return self.pos.gui.show_popup('confirm', {
                            title: 'Warning',
                            body: 'Order Lines is empty',
                        });
                    }

                }.bind(this)));
            }
            // -----------------------------
            // Change Variant of line
            // -----------------------------
            var el_change_variants = el_node.querySelector('.change_variants');
            if (el_change_variants) {
                el_change_variants.addEventListener('click', (function () {
                    var order = self.pos.get_order();
                    if (order) {
                    	self.gui.show_popup('popup_selection_variants', {
			                title: 'Select Variants',
			                variants: self.pos.variant_by_product_tmpl_id[orderline.product.product_tmpl_id],
			                selected_orderline: orderline
			            })
                    	/*
                        var selected_orderline = order.selected_orderline;
                        if (selected_orderline) {
                            self.gui.show_popup('popup_selection_variants', {
				                title: 'Select Variants',
				                variants: self.pos.variant_by_product_tmpl_id[selected_orderline.product.product_tmpl_id],
				                selected_orderline: selected_orderline
				            })
                        }
                        */
                    }
                }.bind(this)));
            }
            
            // -----------------------------
            // Change Category Variant of line
            // -----------------------------
            var el_change_category_variants = el_node.querySelector('.change_category_variants');
            if (el_change_category_variants) {
                el_change_category_variants.addEventListener('click', (function () {
                    var order = self.pos.get_order();
                    if (order) {                        
                        products = self.pos.db.get_product_by_category(orderline.product.variant_categ_id[0]);
                    	
                    	self.gui.show_popup('popup_selection_category_variants', {
			                title: 'Select Variants - Qty: ' + orderline.quantity,
			                products: products,
			                variant_products: orderline.variant_products,
			                selected_orderline: orderline,
			                quantity: orderline.quantity			                
			            })
                    	/*
                        var selected_orderline = order.selected_orderline;
                        if (selected_orderline) {
                            self.gui.show_popup('popup_selection_variants', {
				                title: 'Select Variants',
				                variants: self.pos.variant_by_product_tmpl_id[selected_orderline.product.product_tmpl_id],
				                selected_orderline: selected_orderline
				            })
                        }
                        */
                    }
                }.bind(this)));
            }
            
            // -----------------------------
            // Change combo of line
            // -----------------------------
            var el_change_combo = el_node.querySelector('.change_combo');
            if (el_change_combo) {
                el_change_combo.addEventListener('click', (function () {
                    var order = self.pos.get_order();
                    if (order) {
                        orderline.change_combo();
                        /*
                        var selected_orderline = order.selected_orderline;
                        if (selected_orderline) {
                            selected_orderline.change_combo();
                        }
                        */
                    }
                }.bind(this)));
            }
            // -----------------------------
            // Add cross sale
            // -----------------------------
            var el_change_cross_selling = el_node.querySelector('.change_cross_selling');
            if (el_change_cross_selling) {
                el_change_cross_selling.addEventListener('click', (function () {
                    var order = self.pos.get_order();
                    if (order) {
                        orderline.change_cross_selling();
                        /*
                        var selected_orderline = order.selected_orderline;
                        if (selected_orderline) {
                            selected_orderline.change_cross_selling();
                        }
                        */
                    }
                }.bind(this)));
            }
            // -----------------------------
            // Add Line note
            // -----------------------------
            var el_change_line_note = el_node.querySelector('.change_line_note');
            if (el_change_line_note) {
                el_change_line_note.addEventListener('click', (function () {
                    var order = self.pos.get_order();
                    if (order) {
                    	this.gui.show_popup('popup_add_order_line_note', {
                            title: _t('Add Note'),
                            value: orderline.get_line_note(),
                            confirm: function (note) {
                                orderline.set_line_note(note);
                            }
                        });
                            
                        /*
                        var selected_orderline = order.selected_orderline;
                        if (selected_orderline) {
                            this.gui.show_popup('popup_add_order_line_note', {
                                title: _t('Add Note'),
                                value: selected_orderline.get_line_note(),
                                confirm: function (note) {
                                    selected_orderline.set_line_note(note);
                                }
                            });
                        }
                        */
                    }
                }.bind(this)));
            }
            // -----------------------------
            // Add tags
            // -----------------------------
            var el_change_tags = el_node.querySelector('.change_tags');
            if (el_change_tags) {
                el_change_tags.addEventListener('click', (function () {
                    var order = self.pos.get_order();
                    if (order) {
                    	return this.gui.show_popup('popup_selection_tags', {
                            selected_orderline: orderline,
                            title: 'Add tags'
                        });
                    	/*
                        var selected_orderline = order.selected_orderline;
                        if (selected_orderline) {
                            return this.gui.show_popup('popup_selection_tags', {
                                selected_orderline: selected_orderline,
                                title: 'Add tags'
                            });
                        }
                        */
                    }
                }.bind(this)));
            }
            // -----------------------------
            // Add discount
            // -----------------------------
            var el_change_tags = el_node.querySelector('.add_discount');
            if (el_change_tags) {
                el_change_tags.addEventListener('click', (function () {
                    var list = [];
                    for (var i = 0; i < self.pos.discounts.length; i++) {
                        var discount = self.pos.discounts[i];
                        list.push({
                            'label': discount.name,
                            'item': discount
                        });
                    }
                    this.pos.gui.show_popup('selection', {
                        title: _t('Select discount'),
                        list: list,
                        confirm: function (discount) {
                            var order = self.pos.get_order();
                            if (order && order.selected_orderline) {
                                order.selected_orderline.set_global_discount(discount);
                            }
                        }
                    });
                }.bind(this)));
            }
            return el_node;
        },
        remove_orderline: function (order_line) {
            try {
                this._super(order_line);
            } catch (ex) {
                console.log('dont worries, client without table select');
            }
        },
        set_value: function (val) {
            var self = this;
            var mode = this.numpad_state.get('mode');
            var order = this.pos.get_order();
            if (mode == 'discount' && this.pos.config.discount_limit && order != undefined && order.get_selected_orderline()) { // limit discount by cashiers
                this.gui.show_popup('aarsolnumber', {      // AARSOL changed from number to aarsolnumber
                    'title': _t('Which percentage of dicount would you apply ?'),
                    'value': self.pos.config.discount_limit_amount,
                    'confirm': function (discount) {
                        if (discount > self.pos.config.discount_limit_amount) {
                            if (self.pos.config.allow_manager_approve_discount) {
                                return this.pos.gui.show_popup('password', {
                                    'title': _t('Discount have limited, need approve of manager. Please input pos security pin of manager'),
                                    confirm: function (password) {
                                        var manager_user_id = self.pos.config.manager_user_id[0];
                                        var manager_user = self.pos.user_by_id[manager_user_id];
                                        if (manager_user) {
                                            if (manager_user['pos_security_pin'] != password) {
                                                self.pos.gui.show_popup('confirm', {
                                                    title: 'Error',
                                                    body: 'Wrong pos security pin'
                                                });
                                            } else {
                                                var list = [];
                                                for (var i = 0; i < self.pos.discounts.length; i++) {
                                                    var discount = self.pos.discounts[i];
                                                    list.push({
                                                        'label': discount.name,
                                                        'item': discount
                                                    });
                                                }
                                                this.gui.show_popup('selection', {
                                                    title: _t('Select discount'),
                                                    list: list,
                                                    confirm: function (discount) {
                                                        var order = self.pos.get_order();
                                                        order.add_global_discount(discount);
                                                    }
                                                });
                                            }
                                        } else {
                                            self.pos.gui.show_popup('confirm', {
                                                title: 'Error',
                                                body: 'Could not find manager user'
                                            });
                                        }
                                    }
                                });
                            } else {
                                self.pos.gui.close_popup();
                                return self.gui.show_popup('confirm', {
                                    title: _t('Warning'),
                                    body: 'You can not set discount bigger than ' + self.pos.config.discount_limit_amount + '. Please contact your pos manager and set bigger than',
                                })
                            }
                        } else {
                            order.get_selected_orderline().set_discount(discount);
                        }
                    }
                });
            } else {
                // --------------------------------
                // validation actions
                // --------------------------------
                var order = this.pos.get_order();
                if (mode == 'quantity' && this.pos.config.validate_discount_change && order && order.get_selected_orderline) {
                    return this.pos.gui.show_popup('password', {
                        confirm: function (value) {
                            if (value != this.pos.user.pos_security_pin) {
                                return this.pos.gui.show_popup('confirm', {
                                    title: 'Wrong',
                                    body: 'Password not correct, please check pos secuirty pin'
                                })
                            } else {
                                order.get_selected_orderline().set_quantity(val);
                            }
                        }
                    })
                }
                if (mode == 'discount' && this.pos.config.validate_discount_change && order && order.get_selected_orderline) {
                    return this.pos.gui.show_popup('password', {
                        confirm: function (value) {
                            if (value != this.pos.user.pos_security_pin) {
                                return this.pos.gui.show_popup('confirm', {
                                    title: 'Wrong',
                                    body: 'Password not correct, please check pos secuirty pin'
                                })
                            } else {
                                order.get_selected_orderline().set_discount(val);
                            }
                        }
                    })
                }
                if (mode == 'price' && this.pos.config.validate_discount_change && order && order.get_selected_orderline) {
                    return this.pos.gui.show_popup('password', {
                        confirm: function (value) {
                            if (value != this.pos.user.pos_security_pin) {
                                return this.pos.gui.show_popup('confirm', {
                                    title: 'Wrong',
                                    body: 'Password not correct, please check pos secuirty pin'
                                })
                            } else {
                                var selected_orderline = order.get_selected_orderline();
                                selected_orderline.price_manually_set = true;
                                selected_orderline.set_unit_price(val);
                            }
                        }
                    })
                }
                this._super(val);
            }
        },
        set_lowlight_order: function (buttons) {
            for (var button_name in buttons) {
                buttons[button_name].highlight(false);
            }
        },
        active_count_booked_orders: function () { // set count booked orders
            var $booked_orders = $('.booked_orders');
            if ($booked_orders) {
                var sale_orders = _.filter(this.pos.db.sale_orders, function (order) {
                    return order['book_order'] == true && (order['state'] == 'draft' || order['state'] == 'sent');
                });
                $booked_orders.text(sale_orders.length);
            }
        },
        active_button_create_sale_order: function (buttons, selected_order) { // active function create sale order
            if (buttons && buttons.button_create_sale_order) {
                if (selected_order && selected_order.get_client()) {
                    buttons.button_create_sale_order.highlight(true);
                } else {
                    buttons.button_create_sale_order.highlight(false);
                }
            }
        },
        active_button_combo: function (buttons, selected_order) { // active button set combo
            if (selected_order.selected_orderline && buttons && buttons.button_combo) {
                var is_combo = selected_order.selected_orderline.is_combo();
                buttons.button_combo.highlight(is_combo);
            }
        },
        active_button_combo_item_add_lot: function (buttons, selected_order) { // active button set combo
            if (selected_order.selected_orderline && buttons && buttons.button_combo_item_add_lot) {
                var has_combo_item_tracking_lot = selected_order.selected_orderline.has_combo_item_tracking_lot();
                buttons.button_combo_item_add_lot.highlight(has_combo_item_tracking_lot);
            }
        },
        active_internal_transfer_button: function (buttons, selected_order) { // active button set combo
            if (buttons && buttons.internal_transfer_button) {
                var active = selected_order.validation_order_can_do_internal_transfer();
                buttons.internal_transfer_button.highlight(active);
            }
        },
        active_button_booking_order: function (buttons, selected_order) { // active button set combo
            if (buttons.button_booking_order && selected_order.get_client()) {
                buttons.button_booking_order.highlight(true);
            }
            if (buttons.button_booking_order && !selected_order.get_client()) {
                buttons.button_booking_order.highlight(false);
            }
        },
        active_button_delivery_order: function (buttons, selected_order) { // active button set combo
            if (buttons.button_delivery_order && selected_order.delivery_address) {
                buttons.button_delivery_order.highlight(true);
            }
            if (buttons.button_delivery_order && !selected_order.delivery_address) {
                buttons.button_delivery_order.highlight(false);
            }
        },
        active_loyalty: function (buttons, selected_order) {
            var $loyalty_element = $(this.el).find('.summary .loyalty-information');
            var lines = selected_order.orderlines.models;
            if (!lines || lines.length == 0) {
                $loyalty_element.addClass('oe_hidden');
            } else {
                var client = selected_order.get_client();
                var $plus_point = this.el.querySelector('.plus_point');
                var $redeem_point = this.el.querySelector('.redeem_point');
                var $remaining_point = this.el.querySelector('.remaining_point');
                var $next_point = this.el.querySelector('.next_point')
                if (client) { // if not set client. We're no need build point
                    var plus_point = selected_order.build_plus_point();
                    plus_point = round_pr(plus_point, this.pos.currency.rounding);
                    var redeem_point = selected_order.build_redeem_point();
                    if ($plus_point) {
                        $plus_point.textContent = plus_point;
                    }
                    if ($redeem_point) {
                        $redeem_point.textContent = redeem_point;
                    }
                    var pos_loyalty_point = client['pos_loyalty_point'];
                    var remaining_point = pos_loyalty_point - redeem_point;
                    var next_point = remaining_point + plus_point;
                    if ($remaining_point) {
                        remaining_point = round_pr(remaining_point, this.pos.currency.rounding);
                        $remaining_point.textContent = remaining_point;
                    }
                    if ($next_point) {
                        next_point = round_pr(next_point, this.pos.currency.rounding);
                        $next_point.textContent = next_point;
                    }
                    selected_order.plus_point = plus_point;
                    selected_order.redeem_point = redeem_point;
                    if (client['pos_loyalty_point'] > redeem_point && buttons && buttons.reward_button) {
                        buttons.reward_button.highlight(true);
                    }
                    else if (client['pos_loyalty_point'] <= redeem_point && buttons && buttons.reward_button) {
                        buttons.reward_button.highlight(false);
                    }
                } else {
                    if ($plus_point && $redeem_point && $remaining_point && $next_point) {
                        $plus_point.textContent = '0';
                        $redeem_point.textContent = '0';
                        $remaining_point.textContent = '0';
                        $next_point.textContent = '0';
                    }
                }
            }
        },
        active_show_delivery_address: function (buttons, selected_order) {
            var $delivery_address = this.el.querySelector('.delivery_address');
            var $delivery_date = this.el.querySelector('.delivery_date');
            if ($delivery_address) {
                $delivery_address.textContent = selected_order['delivery_address'];
            }
            if ($delivery_date) {
                $delivery_date.textContent = selected_order['delivery_date'];
            }
        },
        active_button_create_purchase_order: function (buttons, selected_order) {
            if (buttons.button_create_purchase_order) {
                if (selected_order.orderlines.length > 0 && selected_order.get_client()) {
                    buttons.button_create_purchase_order.highlight(true);
                } else {
                    buttons.button_create_purchase_order.highlight(false);
                }

            }
        },
        active_button_change_unit: function (buttons, selected_order) {
            if (buttons.button_change_unit) {
                if (selected_order.selected_orderline && selected_order.selected_orderline.is_multi_unit_of_measure()) {
                    buttons.button_change_unit.highlight(true);
                } else {
                    buttons.button_change_unit.highlight(false);
                }

            }
        },
        active_promotion: function (buttons, selected_order) {
            if (selected_order.orderlines && selected_order.orderlines.length > 0 && this.pos.config.promotion == true && this.pos.config.promotion_ids.length > 0) {
                var lines = selected_order.orderlines.models;
                var promotion_amount = 0;
                for (var i = 0; i < lines.length; i++) {
                    var line = lines[i]
                    if (line.promotion) {
                        promotion_amount += line.get_price_without_tax()
                    }
                }
                if (selected_order && this.el.querySelector('.promotion_amount')) {
                    this.el.querySelector('.promotion_amount').textContent = this.format_currency(promotion_amount);
                    selected_order.promotion_amount = round_pr(promotion_amount, this.pos.currency.rounding);
                }
                var active_promotion = selected_order.current_order_can_apply_promotion();
                var can_apply = active_promotion['can_apply'];
                if (buttons && buttons.button_promotion) {
                    buttons.button_promotion.highlight(can_apply);
                }
                var promotions_apply = active_promotion['promotions_apply'];
                if (promotions_apply.length) {
                    var promotion_recommend_customer_html = qweb.render('promotion_recommend_customer', {
                        promotions: promotions_apply
                    });
                    $('.promotion_recommend_customer').html(promotion_recommend_customer_html);                    
                } else {
                    $('.promotion_recommend_customer').html("");
                    selected_order.remove_all_promotion_line();
                }
            }
        },
        active_button_set_tags: function (buttons, selected_order) {
            if (buttons.button_set_tags) {
                if (selected_order.selected_orderline && selected_order.selected_orderline.is_has_tags()) {
                    buttons.button_set_tags.highlight(true);
                } else {
                    buttons.button_set_tags.highlight(false);
                }

            }
        },
        active_button_print_voucher: function (buttons, selected_order) {
            if (buttons.button_print_voucher) {
                if (this.pos.config.iface_print_via_proxy) {
                    buttons.button_print_voucher.highlight(true);
                } else {
                    buttons.button_print_voucher.highlight(false);
                }

            }
        },
        active_lock_unlock_order: function (buttons, selected_order) {
            if (buttons.button_lock_unlock_order) {
                if (selected_order['lock']) {
                    buttons.button_lock_unlock_order.highlight(true);
                    buttons.button_lock_unlock_order.$el.html('<div class="button-icon"><i class="fa fa-lock"/></div><div class="button-text">UnLock order</div><span class="key-tag"><t t-esc= "widget.pos.config.keyboard_unlock"/></span>'); // Changed by AARSOL
                } else {
                    buttons.button_lock_unlock_order.highlight(false);
                    buttons.button_lock_unlock_order.$el.html('<div class="button-icon"><i class="fa fa-unlock"/></div><div class="button-text">Lock order</div><span class="key-tag"><t t-esc= "widget.pos.config.keyboard_unlock"/></span>');  // changed by AARSOL
                }
                
                '<div class="button-icon"><i class="fa fa-unlock"/></div><div class="button-text">Lock order</div><span class="key-tag"><t t-esc= "widget.pos.config.keyboard_unlock"/></span>'

            }
        },
        active_button_global_discount: function (buttons, selected_order) {
            if (buttons.button_global_discount) {
                if (selected_order.selected_orderline && this.pos.config.discount_ids) {
                    buttons.button_global_discount.highlight(true);
                } else {
                    buttons.button_global_discount.highlight(false);
                }

            }
        },
        active_button_variants: function (buttons, selected_order) {
            if (buttons.button_add_variants) {
                if (selected_order.selected_orderline && this.pos.variant_by_product_tmpl_id[selected_order.selected_orderline.product.product_tmpl_id]) {
                    buttons.button_add_variants.highlight(true);
                } else {
                    buttons.button_add_variants.highlight(false);
                }

            }
        },
        update_summary: function () {
            this._super();
            var self = this;
            
            // added by AARSOL
	        /*
            $('.show_hide_summary').click(function () {
		        if (self.show_summary) {
                    $('.timeline-summary').addClass('oe_hidden');
                    //$('.timeline-summary').animate({height: 0}, 'slow');
                    //$('.show_hide_summary').addClass('highlight');
                    // $('.pads').slideUp(1000); // hide payment, select customer and numpad layout
                    self.show_summary = false;
                } else {
                    $('.timeline-summary').removeClass('oe_hidden');
                    //$('.timeline-summary').animate({height: '100%'}, 'slow');                   
                    //$('.show_hide_summary').removeClass('highlight');
                    // $('.pads').slideDown(1000); // show payment, select customer and numpad layout
                    self.show_summary = true;
                }
		        
		    });
            
            if (!self.show_summary && !($('.timeline-summary').hasClass('oe_hidden'))) {
            	$('.timeline-summary').addClass('oe_hidden') 
            } 
	        */	
	        
            var selected_order = this.pos.get_order();
            var buttons = this.getParent().action_buttons;
            if (selected_order && buttons) {
                this.active_count_booked_orders();
                this.active_button_create_sale_order(buttons, selected_order);
                this.active_button_combo(buttons, selected_order);
                this.active_button_combo_item_add_lot(buttons, selected_order);
                this.active_internal_transfer_button(buttons, selected_order);
                this.active_button_booking_order(buttons, selected_order);
                this.active_button_delivery_order(buttons, selected_order);
                this.active_loyalty(buttons, selected_order);
                this.active_button_variants(buttons, selected_order);
                this.active_show_delivery_address(buttons, selected_order);
                this.active_button_create_purchase_order(buttons, selected_order);
                this.active_button_change_unit(buttons, selected_order);
                this.active_promotion(buttons, selected_order);
                this.active_button_set_tags(buttons, selected_order);
                this.active_button_print_voucher(buttons);
                this.active_lock_unlock_order(buttons, selected_order);
                this.active_button_global_discount(buttons, selected_order);
                try { // try catch because may be customer not installed pos_restaurant
                    var changes = selected_order.hasChangesToPrint();
                    if (buttons && buttons.button_kitchen_receipt_screen) {
                        buttons.button_kitchen_receipt_screen.highlight(changes);
                    }
                } catch (e) {

                }                
                var $signature = $('.signature');
                if ($signature) {
                    $signature.attr('src', selected_order.get_signature());
                }
                var $note = this.el.querySelector('.order-note');
                if ($note) {
                    $note.textContent = selected_order.get_note();
                }
            }
        }
    });
    var vouchers_screen = screens.ScreenWidget.extend({
        template: 'vouchers_screen',

        init: function (parent, options) {
            this._super(parent, options);
            this.vouchers = options.vouchers;
        },
        show: function () {
            this._super();
            this.vouchers = this.pos.vouchers;
            this.render_vouchers();
            this.handle_auto_print();
        },
        handle_auto_print: function () {
            if (this.should_auto_print()) {
                this.print();
                if (this.should_close_immediately()) {
                    this.click_back();
                }
            } else {
                this.lock_screen(false);
            }
        },
        should_auto_print: function () {
            return this.pos.config.iface_print_auto;
        },
        should_close_immediately: function () {
            return this.pos.config.iface_print_via_proxy;
        },
        lock_screen: function (locked) {
            this.$('.back').addClass('highlight');
        },
        get_voucher_env: function (voucher) {
            var order = this.pos.get_order();
            var datas = order.export_for_printing();
            return {
                widget: this,
                pos: this.pos,
                order: order,
                datas: datas,
                voucher: voucher
            };
        },
        print_web: function () {
            window.print();
        },
        print_xml: function () {
            if (this.vouchers) {
                for (var i = 0; i < this.vouchers.length; i++) {
                    var voucher_xml = qweb.render('voucher_ticket_xml', this.get_voucher_env(this.vouchers[i]));
                    this.pos.proxy.print_receipt(voucher_xml);
                }
            }
        },
        print: function () {
            var self = this;
            if (!this.pos.config.iface_print_via_proxy) {
                this.lock_screen(true);
                setTimeout(function () {
                    self.lock_screen(false);
                }, 1000);

                this.print_web();
            } else {
                this.print_xml();
                this.lock_screen(false);
            }
        },
        click_back: function () {
            this.pos.gui.show_screen('products');
        },
        renderElement: function () {
            var self = this;
            this._super();
            this.$('.back').click(function () {
                self.click_back();
            });
            this.$('.button.print').click(function () {
                self.print();
            });
        },
        render_change: function () {
            this.$('.change-value').html(this.format_currency(this.pos.get_order().get_change()));
        },
        render_vouchers: function () {
            var $voucher_content = this.$('.pos-receipt-container');
            var url_location = window.location.origin + '/report/barcode/EAN13/';
            $voucher_content.empty(); // reset to blank content
            if (this.vouchers) {
                for (var i = 0; i < this.vouchers.length; i++) {
                    this.vouchers[i]['url_barcode'] = url_location + this.vouchers[i]['code'];
                    $voucher_content.append(
                        qweb.render('voucher_ticket_html', this.get_voucher_env(this.vouchers[i]))
                    );
                }
            }
        }
    });
    gui.define_screen({name: 'vouchers_screen', widget: vouchers_screen});

    var invoices_screen = screens.ScreenWidget.extend({ // invoices screen
        template: 'invoices_screen',
        start: function () {
            var self = this;
            this._super();
            this.pos.bind('update:invoice', function () {
                self.render_screen();
            })
        },
        show: function () {
            var self = this;
            this.render_screen();
            this.invoice_selected = null;
            this._super();
            this.$('.invoice-list').delegate('.invoice-line', 'click', function (event) {
                self.invoice_select(event, $(this), parseInt($(this).data('id')));
            });
            this.$('.searchbox .search-invoice').click(function () {
                self.clear_search();
            });
            this.$('.invoices_open').click(function () {
                var invoices = _.filter(self.pos.db.invoices, function (invoice) {
                    return invoice.state == 'open';
                });
                if (invoices) {
                    var contents = self.$('.invoice-details-contents');
                    contents.empty();
                    return self.render_invoice_list(invoices);
                } else {
                    return self.pos.gui.show_popup('confirm', {
                        title: 'Warning',
                        body: 'Your database have not any invoices state at Open'
                    })
                }

            })
            var invoices = [];
            for (var i = 0; i < this.pos.db.invoices.length; i++) {
                var invoice = this.pos.db.invoices[i];
                var partner = this.pos.db.get_partner_by_id(invoice.partner_id[0]);
                if (!partner) {
                    partner = this.pos.db.supplier_by_id[partner.id]
                }
                if (!partner) {
                    continue;
                }
                var label = invoice['number'];
                if (invoice['name']) {
                    label += ', ' + invoice['name'];
                }
                if (partner['display_name']) {
                    label += ', ' + partner['display_name']
                }
                if (partner['email']) {
                    label += ', ' + partner['email']
                }
                if (partner['phone']) {
                    label += ', ' + partner['phone']
                }
                if (partner['mobile']) {
                    label += ', ' + partner['mobile']
                }
                invoices.push({
                    value: invoice['id'],
                    label: label
                })
            }
            var $search_box = $('.clientlist-screen .search-invoice >input');
            $search_box.autocomplete({
                source: invoices,
                minLength: this.pos.minLength,
                select: function (event, ui) {
                    if (ui && ui['item'] && ui['item']['value']) {
                        var invoice = self.pos.db.invoice_by_id[ui['item']['value']];
                        if (invoice) {
                            self.display_invoice_details(invoice);
                        }
                        self.clear_search();

                    }
                },
                
                // added by AARSOL		        
                _renderItem: function(table, item) {    
                    return $("<tr class='ui-menu-item'  role='presentation'>") 
                        .data( "item.autocomplete", item )                           
                        .append( "<td style='padding:0 4px;float:left;width:50px;'>"+item.value+"</td>"
                                +"<td style='padding:0 4px;float:left;width:500px;'>"+item.label+"</td>"
                                +"<td style='padding:0 4px;float:right;width:50px;'>"+"65.00"+"</td>" )                                                       
                        .appendTo(table);
                },		        
            });
        },
        invoice_select: function (event, $invoice, id) {
            var invoice = this.pos.db.get_invoice_by_id(id);
            this.$('.invoice-line').removeClass('highlight');
            $invoice.addClass('highlight');
            this.display_invoice_details(invoice);

        },

        display_invoice_details: function (invoice) {
            this.invoice_selected = invoice;
            var self = this;
            var contents = this.$('.invoice-details-contents');
            contents.empty();
            invoice.link = window.location.origin + "/web#id=" + invoice.id + "&view_type=form&model=account.invoice";
            contents.append($(qweb.render('invoice_detail', {widget: this, invoice: invoice})));
            var account_invoice_lines = this.pos.db.invoice_lines_by_invoice_id[invoice.id];
            if (account_invoice_lines) {
                var line_contents = this.$('.invoice_lines_detail');
                line_contents.empty();
                line_contents.append($(qweb.render('account_invoice_lines', {
                    widget: this,
                    account_invoice_lines: account_invoice_lines
                })));
            }
            this.$('.inv-print-invoice').click(function () { // print invoice
                self.chrome.do_action('account.account_invoices', {
                    additional_context: {
                        active_ids: [self.invoice_selected['id']]
                    }
                })
            });
            this.$('.inv-print-invoice-without-payment').click(function () { // print invoice without payment
                self.chrome.do_action('account.account_invoices_without_payment', {
                    additional_context: {
                        active_ids: [self.invoice_selected['id']]
                    }
                })
            });
            this.$('.inv-send-email').click(function () { // send email invoice to customer

            });

            this.$('.inv-register-payment').click(function () { // register payment invoice
                self.gui.show_popup('popup_invoice_register_payment', {
                    invoice: self.invoice_selected
                })
            });
            this.$('.inv-action_invoice_open').click(function () { // action inv open
                return rpc.query({
                    model: 'account.invoice',
                    method: 'action_invoice_open',
                    args: [self.invoice_selected['id']]
                }).then(function () {
                    self.link = window.location.origin + '/web#id=' + self.invoice_selected['id'] + '&view_type=form&model=account.invoice';
                    return self.gui.show_popup('confirm', {
                        title: 'Done',
                        body: 'Click open new tab review invoice',
                        confirm: function () {
                            window.open(self.link, '_blank');
                        }
                    });
                }).fail(function (type, error) {
                    self.gui.show_popup('confirm', {
                        title: 'ERROR',
                        body: 'Please check log of your odoo, could not process your action',
                    });
                });

            });
            this.$('.inv-add-credit-note').click(function () {
                self.gui.show_popup('popup_account_invoice_refund', {
                    invoice: self.invoice_selected,
                })
            });
            this.$('.inv-cancel').click(function () {
                self.gui.show_popup('popup_account_invoice_cancel', {
                    invoice: self.invoice_selected,
                })

            });
        },
        render_screen: function () {
            this.pos.invoice_selected = null;
            var self = this;
            if (this.pos.db.invoices.length) {
                this.render_invoice_list(this.pos.db.invoices);
            }
            var search_timeout = null;
            if (this.pos.config.iface_vkeyboard && this.chrome.widget.keyboard) {
                this.chrome.widget.keyboard.connect(this.$('.searchbox input'));
            }
            this.$('.search-invoice input').on('keypress', function (event) {
                clearTimeout(search_timeout);
                var query = this.value;
                search_timeout = setTimeout(function () {
                    self.perform_search(query, event.which === 13);
                }, 70);
            });
            this.$('.searchbox .search-clear').click(function () {
                self.clear_search();
            });
            this.$('.back').click(function () {
                self.gui.show_screen('products');
            });
        },
        perform_search: function (query, associate_result) {
            if (query) {
                var invoices = this.pos.db.search_invoice(query);
                this.render_invoice_list(invoices);
            }
        },
        clear_search: function () {
            var contents = this.$('.invoice-details-contents');
            contents.empty();
            var invoices = this.pos.db.invoices;
            this.render_invoice_list(invoices);
            this.$('.searchbox input')[0].value = '';
            this.$('.searchbox input').focus();
        },
        partner_icon_url: function (id) {
            return '/web/image?model=res.partner&id=' + id + '&field=image_small';
        },
        render_invoice_list: function (invoices) {
            var contents = this.$el[0].querySelector('.invoice-list');
            contents.innerHTML = "";
            for (var i = 0, len = Math.min(invoices.length, 1000); i < len; i++) {
                var invoice = invoices[i];
                var invoice_html = qweb.render('invoice_row', {
                    widget: this,
                    invoice: invoice
                });
                invoice = document.createElement('tbody');
                invoice.innerHTML = invoice_html;
                invoice = invoice.childNodes[1];
                contents.appendChild(invoice);
            }
        }
    });
    gui.define_screen({name: 'invoices', widget: invoices_screen});

    // validation payment
    // auto ask need apply promotion
    // auto ask when have customer special discount
    screens.ActionpadWidget.include({
        renderElement: function () {
            var self = this;
            this._super();
            this.$('.pay').click(function () {
                var order = self.pos.get_order();
                order.validate_payment_order();
            });
        }
    });

    var return_products = screens.ScreenWidget.extend({ // return products screen
        template: 'return_products',
        start: function () {
            this.products_return = [];
            this._super();
            this.render_screen();
        },
        show: function () {
            var self = this;
            this._super();
            var $search_box = this.$('.search_return_products >input');
            $search_box.autocomplete({
                source: this.pos.db.products_autocomplete,
                minLength: this.pos.minLength,
                select: function (event, ui) {
                    if (ui && ui['item'] && ui['item']['value']) {
                        var product_selected = self.pos.db.product_by_id[ui['item']['value']];
                        if (product_selected) {
                            self.add_product(product_selected);
                        }
                    }
                },
                
                // added by AARSOL		        
                renderItem: function(table, item) {    
                    return $("<tr class='ui-menu-item'  role='presentation'>") 
                        .data( "item.autocomplete", item )                           
                        .append( "<td style='padding:0 4px;float:left;width:50px;'>"+item.value+"</td>"
                                +"<td style='padding:0 4px;float:left;width:500px;'>"+item.label+"</td>"
                                +"<td style='padding:0 4px;float:right;width:50px;'>"+"75.00"+"</td>" )                                                       
                        .appendTo(table);
                },		       
            });
        },
        scan_return_product: function (datas) {
            var product_selected = this.pos.db.product_by_barcode[datas['code']];
            if (product_selected) {
                this.add_product(product_selected);
                return true;
            } else {
                this.barcode_error_action(datas);
                return false;
            }
        },
        add_product: function (product_selected) { // method add products return
            var self = this;
            if (product_selected) {
                var product_exsit = _.find(this.products_return, function (product) {
                    return product['id'] == product_selected['id']
                });
                var products = _.filter(this.products_return, function (product) {
                    return product['id'] != product_selected['id']
                });
                if (product_exsit) {
                    if (!product_exsit['quantity_return']) {
                        product_exsit['quantity_return'] = 1
                    } else {
                        product_exsit['quantity_return'] += 1
                    }

                } else {
                    product_selected['quantity_return'] = 1;
                    products.push(product_selected);
                    this.products_return = products;
                }
                this.render_products_return();
                setTimeout(function () {
                    self.$('.searchbox input')[0].value = '';
                }, 10);
            }
        },

        render_screen: function () {
            this.pos.invoice_selected = null;
            var self = this;
            this.$('.back').click(function () {
                self.gui.show_screen('products');
            });
            var $confirm_return = this.$('.confirm_return');
            $confirm_return.click(function () {
                if (self.products_return.length <= 0) {
                    return self.pos.gui.show_popup('confirm', {
                        title: 'Warning',
                        body: 'List of lines is blank, please add products'
                    })
                }
                var order = new models.Order({}, {pos: self.pos});                
                order['is_return'] = true;
                self.pos.get('orders').add(order);
                self.pos.set('selectedOrder', order);
                if (order) {                
                    for (var i = 0; i < self.products_return.length; i++) {
                        var product = self.products_return[i];
                        var line = new models.Orderline({}, {pos: self.pos, order: order, product: product});
                        line['is_return'] = true;
                        order.orderlines.add(line);
                        var price_return = product['price_return'] || product['list_price'];
                        line.set_unit_price(price_return);
                        line.set_quantity(-product['quantity_return'], 'keep price when return');
                    }                   
					
					// added by AARSOL
                    self.products_return = [];
                    self.render_products_return();
                                        
                    order.trigger('change', order);
                    
					// Changed by AARSOL
                    return self.gui.show_screen('products');
                    //return self.gui.show_screen('payment');                
                }
            });
        },
        product_icon_url: function (id) {
            return '/web/image?model=product.product&id=' + id + '&field=image_small';
        },
        render_products_return: function () {
            var self = this;
            var contents = this.$el[0].querySelector('tbody');
            contents.innerHTML = "";
            for (var i = 0; i < this.products_return.length; i++) {
                var product = this.products_return[i];
                var product_html = qweb.render('product_return_row', {
                    widget: this,
                    product: product
                });
                product = document.createElement('tbody');
                product.innerHTML = product_html;
                product = product.childNodes[1];
                contents.appendChild(product);
            }
            this.$('.product_row .quantity').on('click', function () {
                var product_id = $(this).parent().parent().data()['id'];
                var product = _.find(self.products_return, function (product) {
                    return product['id'] == product_id;
                });
                self.product_selected = product;
                return self.pos.gui.show_popup('alert_input', {
                    title: _t('Quantity'),
                    body: 'Please input quantity need return',
                    confirm: function (quantity_return) {
                        var quantity_return = parseFloat(quantity_return);
                        self.product_selected['quantity_return'] = quantity_return;
                        self.render_products_return();
                    },
                })
            });
            this.$('.product_row .edit_amount').on('click', function () {
                var product_id = $(this).parent().parent().data()['id'];
                var product = _.find(self.products_return, function (product) {
                    return product['id'] == product_id;
                });
                self.product_selected = product;
                return self.pos.gui.show_popup('alert_input', {
                    title: _t('Amount return'),
                    body: 'Please input amount',
                    confirm: function (price_return) {
                        var price_return = parseFloat(price_return);
                        self.product_selected['price_return'] = price_return;
                        
						//remarked by AARSOL
                        //self.render_products_return();
                    },
                    cancel: function () {

                    }
                })
            });
            this.$('.product_row .remove').on('click', function () {
                var product_id = $(this).parent().parent().data()['id'];
                var products = _.filter(self.products_return, function (product) {
                    return product['id'] !== product_id;
                });
                self.products_return = products;
                self.render_products_return();
            });
        }

    });
    gui.define_screen({name: 'return_products', widget: return_products});

    var daily_report = screens.ScreenWidget.extend({  // daily report screen
        template: 'daily_report',
        start: function () {
            this.user_id = null;
            this.line_selected = [];
            this._super();
        },
        show: function () {
            var self = this;
            if (this.line_selected.length == 0) {
                this.line_selected = this.pos.db.pos_order_lines
            }
            this._super();
            this.$('.search-clear').click();
            this.$('.datetimepicker').datetimepicker({
                format: 'YYYY-MM-DD H:mm:00',
                icons: {
                    time: "fa fa-clock-o",
                    date: "fa fa-calendar",
                    up: "fa fa-chevron-up",
                    down: "fa fa-chevron-down",
                    previous: 'fa fa-chevron-left',
                    next: 'fa fa-chevron-right',
                    today: 'fa fa-screenshot',
                    clear: 'fa fa-trash',
                    close: 'fa fa-remove'
                }
            });
            var users = this.pos.users;
            var users_list = [];
            for (var i = 0; i < users.length; i++) {
                var user = users[i];
                var label = user.name;
                users_list.push({
                    value: user['id'],
                    label: label
                })
            }
            var $search_box = this.$('.search_user >input');
            $search_box.autocomplete({
                source: users_list,
                minLength: this.pos.minLength,
                select: function (event, ui) {
                    if (ui && ui['item'] && ui['item']['value']) {
                        var user_id = ui['item']['value'];
                        var user = self.pos.user_by_id[user_id];
                        self.line_selected = _.filter(self.pos.db.pos_order_lines, function (line) {
                            return line['create_uid'][0] == user_id;
                        });
                        self.$('.search_user input').value = user['display_name'];
                        var start_date = self.$('.start_date').val();
                        var end_date = self.$('.end_date').val();
                        self.$('.pos-receipt-container').empty();
                        if (start_date && end_date) {
                            self.line_selected = _.filter(self.line_selected, function (line) {
                                return line['create_date'] >= start_date && line['create_date'] <= end_date
                            })
                        }
                        self.user_id = user_id;

                        self.render_report();
                        setTimeout(function () {
                            var input = self.el.querySelector('.search_user input');
                            input.value = user['display_name'];
                            input.focus();
                        }, 500);
                    }
                },
				
				// added by AARSOL		        
                _renderItem: function(table, item) {    
                    return $("<tr class='ui-menu-item'  role='presentation'>") 
                        .data( "item.autocomplete", item )                           
                        .append( "<td style='padding:0 4px;float:left;width:50px;'>"+item.value+"</td>"
                                +"<td style='padding:0 4px;float:left;width:500px;'>"+item.label+"</td>"
                                +"<td style='padding:0 4px;float:right;width:50px;'>"+"85.00"+"</td>" )                                                       
                        .appendTo(table);
                },
		        
            });
            var self = this;
            this.line_selected = this.pos.db.pos_order_lines;
            this.$('.back').click(function () {
                self.pos.gui.show_screen('products');

            });
            this.$('.search-clear').click(function () {
                self.user_id = null;
                self.line_selected = self.pos.db.pos_order_lines;
                var $start_date = self.el.querySelector('.start_date');
                $start_date.value = '';
                var $end_date = self.el.querySelector('.end_date');
                $end_date.value = '';
                var $search_user = self.el.querySelector('.search_user input');
                $search_user.value = '';
                self.render_report();
            });
            this.$('.start_date').blur(function () {
                self.line_selected = self.pos.db.pos_order_lines;
                var start_date = self.$(this).val();
                var end_date = self.$('.end_date').val();
                if (end_date) {
                    self.line_selected = _.filter(self.line_selected, function (line) {
                        return line['create_date'] >= start_date && line['create_date'] <= end_date;
                    })
                } else {
                    self.line_selected = _.filter(self.line_selected, function (line) {
                        return line['create_date'] >= start_date;
                    })
                }
                self.render_report();

            });
            this.$('.end_date').blur(function () {
                self.line_selected = self.pos.db.pos_order_lines;
                var start_date = self.$('.start_date').val();
                var end_date = self.$(this).val();
                if (start_date) {
                    self.line_selected = _.filter(self.line_selected, function (line) {
                        return line['create_date'] >= start_date && line['create_date'] <= end_date;
                    })
                } else {
                    self.line_selected = _.filter(self.line_selected, function (line) {
                        return line['end_date'] <= end_date;
                    })
                }
                self.render_report();
            });
            this.render_report();
        },
        product_icon_url: function (id) {
            return '/web/image?model=product.product&id=' + id + '&field=image_small';
        },
        render_report: function (print_xml) {
            var $daily_report = this.$('.pos-receipt-container');
            $daily_report.empty();
            var line_selected = this.line_selected;
            var orderlines_by_user_id = {};
            for (var i = 0; i < line_selected.length; i++) {
                var line = line_selected[i];
                if (!orderlines_by_user_id[line['create_uid'][0]]) {
                    orderlines_by_user_id[line['create_uid'][0]] = [line]
                } else {
                    orderlines_by_user_id[line['create_uid'][0]].push(line)
                }
            }
            var datas = [];
            var user_id;
            for (user_id in orderlines_by_user_id) {
                var user = this.pos.user_by_id[user_id];
                var orderlines = orderlines_by_user_id[user_id];
                var amount_total = 0;
                for (var i = 0; i < orderlines.length; i++) {
                    var line = orderlines[i];
                    amount_total += line['price_unit'] * line['qty']
                }
                if (user) {
                    datas.push({
                        user: user,
                        orderlines: orderlines,
                        amount_total: amount_total
                    })
                }
            }
            if (datas.length) {
                var report_html = qweb.render('daily_report_user_html', {
                    datas: datas,
                    pos: this.pos,
                    widget: this
                });
                $daily_report.html(report_html)
                if (print_xml) {
                    var report_xml = qweb.render('daily_report_user_xml', {
                        datas: datas,
                        pos: this.pos,
                        widget: this
                    });
                    this.pos.proxy.print_receipt(report_xml);
                }
            }
        }

    });
    gui.define_screen({name: 'daily_report', widget: daily_report});

    var kitchen_receipt_screen = screens.ScreenWidget.extend({
        template: 'kitchen_receipt_screen',
        show: function () {
            this._super();
            var self = this;
            this.render_receipt();
        },
        lock_screen: function (locked) {
            this._locked = locked;
            if (locked) {
                this.$('.next').removeClass('highlight');
            } else {
                this.$('.next').addClass('highlight');
            }
        },
        get_receipt_all_printer_render_env: function () {
            var order = this.pos.get_order();
            var printers = this.pos.printers;
            var item_new = [];
            var item_cancelled = [];
            var table = null;
            var floor = null;
            for (var i = 0; i < printers.length; i++) {
                var changes = order.computeChanges(printers[i].config.product_categories_ids);
                table = changes['table'];
                floor = changes['floor'];
                for (var i = 0; i < changes['new'].length; i++) {
                    item_new.push(changes['new'][i]);
                }
                for (var i = 0; i < changes['cancelled'].length; i++) {
                    item_cancelled.push(changes['cancelled'][i]);
                }
            }
            return {
                widget: this,
                table: table,
                floor: floor,
                new_items: item_new,
                cancelled_items: item_cancelled
            }
        },
        get_receipt_filter_by_printer_render_env: function (printer) {
            var order = this.pos.get_order();
            var item_new = [];
            var item_cancelled = [];
            var changes = order.computeChanges(printer.config.product_categories_ids);
            for (var i = 0; i < changes['new'].length; i++) {
                item_new.push(changes['new'][i]);
            }
            for (var i = 0; i < changes['cancelled'].length; i++) {
                item_cancelled.push(changes['cancelled'][i]);
            }
            return {
                widget: this,
                table: changes['table'] || null,
                floor: changes['floor'] || null,
                new_items: item_new,
                cancelled_items: item_cancelled,
                time: changes['time']
            }
        },
        print_web: function () {
            var self = this;
            this.lock_screen(true);
            setTimeout(function () {
                self.lock_screen(false);
            }, 1000);
            window.print();
        },
        click_back: function () {
            this.pos.gui.show_screen('products');
        },
        renderElement: function () {
            var self = this;
            this._super();
            this.$('.back').click(function () {
                self.click_back();
            });
            this.$('.button.print-kitchen-receipt').click(function () {
                self.print_web();
            });
        },
        render_receipt: function () {
            var values = this.get_receipt_all_printer_render_env();
            this.$('.pos-receipt-container').html(qweb.render('kitchen_receipt', values));
            var printers = this.pos.printers;
            for (var i = 0; i < printers.length; i++) {
                var value = this.get_receipt_filter_by_printer_render_env(printers[i]);
                if (value['new_items'].length > 0 || value['cancelled_items'].length > 0) {
                    var receipt = qweb.render('kitchen_receipt_xml', value);
                    printers[i].print(receipt);
                }
                this.pos.get_order().saveChanges();
            }
        }
    });

    gui.define_screen({name: 'kitchen_receipt_screen', widget: kitchen_receipt_screen});

    // login page
    var login_page = screens.ScreenWidget.extend({
        template: 'login_page',
        login: function () {
            var pos_security_pin = this.$('.pos_security_pin').val();
            if (this.pos.user.pos_security_pin == false) {
                return this.gui.show_popup('confirm', {
                    title: 'Warning',
                    body: 'Your account not set pos security pin, Please go to Setting / User and set pos pin',
                });
            }
            if (pos_security_pin == this.pos.user.pos_security_pin) {
                $('.pos-topheader').removeClass('oe_hidden');
                this.$('.pos_security_pin').value = '';
                var default_screen = this.pos.default_screen;
                var startup_screen = this.gui.startup_screen;
                this.gui.set_default_screen(default_screen);
                this.gui.set_startup_screen(startup_screen);
                this.gui.show_screen(default_screen);
            } else {
                return this.gui.show_popup('confirm', {
                    title: 'Wrong',
                    body: 'Wrong pos security pin, please check again'
                });
            }
        },
        
        // added by AARSOL
        start: function() {
        	var self = this;
        	this._super();
        	hotkeys('enter', 'Login', function (event, handler) { 
		    	self.login();
		    });			
        },
        show: function () {
            var self = this;
			$('#password').value = '';   // added by AARSOL
            $('#password').focus();
            this.$('.confirm-login').click(function () {
                self.login()
            });
            this.$('.confirm-logout').click(function () {
                self.gui._close();
            });
            $('.pos-topheader').addClass('oe_hidden');
            this.pos.barcode_reader.set_action_callback({
                'login_security': _.bind(self.scan_barcode_pos_security_pin, self)
            });			
            
            hotkeys.setScope('Login');  // added by AARSOL
            hotkeys.filter = function(event){
			  return true;
			}
			this._super();
        },
		
		// added by AARSOL        
		hide: function(){
	        hotkeys.setScope('Numpad');	
	        this._super();
	    },		
        scan_barcode_pos_security_pin: function (datas) {
            var barcode = datas['code'];
            if (this.pos.user['barcode'] == barcode) {
                $('.pos-topheader').removeClass('oe_hidden');
                this.$('.pos_security_pin').value = '';
                var default_screen = this.pos.default_screen;
                var startup_screen = this.gui.startup_screen;
                this.gui.set_default_screen(default_screen);
                this.gui.set_startup_screen(startup_screen);
                this.gui.show_screen(default_screen);
                return true
            } else {
                this.barcode_error_action(datas);
                return false;
            }
        }
    });
    gui.define_screen({name: 'login_page', widget: login_page});

    var pos_orders_screen = screens.ScreenWidget.extend({ // pos orders screen
        template: 'pos_orders_screen',

        init: function (parent, options) {
            this._super(parent, options);
            this.pos_order_cache = new screens.DomCache();
        },

        show: function () {
            var self = this;
			
			// added by AARSOL         
			this._super();
            this.renderElement();
            
            this.details_visible = false;
            this.order_selected = null;
            this.contents_height = 0;
            
            this.$('.back').click(function () {                
                self.gui.back();                
            });
			
            // upto this
            this.render_screen();
			
            // remarked by AARSOL
            //this._super();  
            //var search_timeout = null;
            //var input = this.el.querySelector('.searchbox input');
            //input.value = '';
            //input.focus();
            this.render_pos_order_list(this.pos.db.orders_store);
			
			//added by AARSOL
            
			if (this.order_selected) {
                this.display_client_details('show', this.order_selected, 0);
            }
			
            this.$('.client-list-contents').delegate('.pos_order_row', 'click', function (event, a) {     	// added a
                self.order_select(event, $(this), parseInt($(this).data('id')), a);							// added a
            });
            var search_timeout = null;

            if (this.pos.config.iface_vkeyboard && this.chrome.widget.keyboard) {
                this.chrome.widget.keyboard.connect(this.$('.searchbox input'));
            }

            this.$('.searchbox input').on('keypress', function (event) {
                clearTimeout(search_timeout);

                var searchbox = this;

                search_timeout = setTimeout(function () {
                    self.perform_search(searchbox.value, event.which === 13);
                }, 70);
            });
            this.$('.searchbox .search-clear').click(function () {
                self.clear_search();
            });
			
			// added by AARSOL
			hotkeys.setScope('Orders');
        },
		
		// added by AARSOL
		start: function () {
            var self = this;
            this._super();
            
            hotkeys('enter', 'Orders', function (event, handler) { 
		    	event.preventDefault();
                if ($('.pos_order_row.highlight').length > 0){
                	var cur_li = $(".pos_order_row.highlight");
                	cur_li.trigger("click",[1]);
                }
                else if ($('.pos_order_row.lowlight').length > 0){
                	var cur_li = $(".pos_order_row.lowlight");
                	cur_li.trigger("click",[1]);
                }
		    });	
		    hotkeys('left', 'Orders', function (event, handler) { 
		    	self.gui.back();
		    });	
		    hotkeys('ctrl+r', 'Orders', function (event, handler) { 
		    	event.preventDefault();
		        self.$('.return_order').trigger("click");		  
		    });
		    hotkeys('ctrl+p', 'Orders', function (event, handler) { 
		    	event.preventDefault();
                self.$('.reprint_order').trigger("click");		  
		    });
		    hotkeys('ctrl+i', 'Orders', function (event, handler) { 
		    	event.preventDefault();
                self.$('.create_invoice').trigger("click");		  
		    });	
		    hotkeys('ctrl+g', 'Orders', function (event, handler) { 
		    	event.preventDefault();
                self.$('.register_amount').trigger("click");		  
		    });		
		    hotkeys('down', 'Orders', function (event, handler) { 
		    	if (self.$('.pos_order_row.highlight').length > 0){
			       if (self.$('.pos_order_row.highlight').is(':not(:last-child)')){					            
			            var cur_li = self.$(".pos_order_row.highlight");
			            var next_li = cur_li.next();
				        next_li.trigger("click",[1] );						        				        
				        event.preventDefault();
			       }
			   } else if (self.$('.pos_order_row.lowlight').length > 0){
			       if (self.$('.pos_order_row.lowlight').is(':not(:last-child)')){					            
			            var cur_li = self.$(".pos_order_row.lowlight");
			            var next_li = cur_li.next();
				        next_li.trigger("click",[1] );						        				        
				        event.preventDefault();
			       }
			   } else{				      
			        var cur_li = self.$(".pos_order_row:first-child");					       
				    cur_li.trigger("click",[1] );						    					      
				    event.preventDefault();
			   }
		    });	
		    hotkeys('up', 'Orders', function (event, handler) { 
		    	if ($('.pos_order_row.highlight').is(':not(:first-child)')){			                
			        var cur_li = $(".pos_order_row.highlight");
			        var pre_li = $(".pos_order_row.highlight").prev();
			        if(pre_li){
			          	pre_li.trigger("click",[1] );			                	    	            
				        event.preventDefault();
			        }
			    } else if ($('.pos_order_row.lowlight').is(':not(:first-child)')){			                
			        var cur_li = $(".pos_order_row.lowlight");
			        var pre_li = $(".pos_order_row.lowlight").prev();
			        if(pre_li){
			           	pre_li.trigger("click",[1] );			                	    	            
				        event.preventDefault();
			        }
			    }				
		    });	  	  	          	  	           
        },
		hide: function(){
	        hotkeys.setScope('Numpad');
	        this._super();	    
	    },
        
        clear_search: function () {
            this.render_pos_order_list(this.pos.db.orders_store);
            this.$('.searchbox input')[0].value = '';
            this.$('.searchbox input').focus();
        },
        perform_search: function (query, associate_result) {
            var orders;
            if (query) {
                orders = this.pos.db.search_order(query);
                if (associate_result && orders.length === 1) {
                    return this.display_pos_order_detail('show', orders[0]);   // added show
                }
                return this.render_pos_order_list(orders);
            } else {
                orders = this.pos.db.orders_store;
                return this.render_pos_order_list(orders);
            }
        },
        render_screen: function () {
            this.pos.quotation_selected = null;
            var self = this;
            //this.$('.back').click(function () {
            //    self.gui.show_screen('products');
            //});
            var $search_box = $('.search-pos-order >input');
            if ($search_box) {
                $search_box.autocomplete({
                    source: this.pos.db.pos_orders_autocomplete,
                    minLength: this.pos.minLength,
                    select: function (event, ui) {
                        if (ui && ui['item'] && ui['item']['value']) {
                            var order = self.pos.db.order_by_id[ui['item']['value']];
                            self.display_pos_order_detail('show', order);  // added show
                            setTimeout(function () {
                                self.clear_search();
                            }, 1000);

                        }
                    },
					
					// added by AARSOL		            
                    _renderItem: function(table, item) {    
                        return $("<tr class='ui-menu-item'  role='presentation'>") 
                            .data( "item.autocomplete", item )                           
                            .append( "<td style='padding:0 4px;float:left;width:50px;'>"+item.value+"</td>"
                                    +"<td style='padding:0 4px;float:left;width:500px;'>"+item.label+"</td>"
                                    +"<td style='padding:0 4px;float:right;width:50px;'>"+"15.00"+"</td>" )                                                       
                            .appendTo(table);
                    },		            
                });
				
				
                $search_box.autocomplete( "instance" )._renderMenu = function(ul, items) {
					 var that = this;
					 //table definitions
					 ul.append("<table><thead><tr><th>ID#</th><th>Name</th><th>Cool&nbsp;Points</th></tr></thead><tbody></tbody></table>");
					 $.each( items, function( index, item ) {
						//that._renderItemData(ul, item );
						that._renderItemData(ul, ul.find("table tbody"), item );
					 });
				};
                
                $search_box.autocomplete( "instance" )._renderItemData = function(ul, table, item) {
					return this._renderItem(table, item).data( "ui-autocomplete-item", item);
				};
				
                $search_box.autocomplete( "instance" )._renderItemData = function(ul, item) {
					return this._renderItem( ul, item ).data( "ui-autocomplete-item", item );
				};
                
            }
        },
        partner_icon_url: function (id) {
            return '/web/image?model=res.partner&id=' + id + '&field=image_small';
        },
        order_select: function (event, $order, id, a) {    // added a
            var order = this.pos.db.order_by_id[id];
			
            // added by AARSOL if-else , and remarked last 4 lines
            this.$('.client-list .lowlight').removeClass('lowlight');
			if ($order.hasClass('highlight')){
	            $order.removeClass('highlight');
	            $order.addClass('lowlight');		        
		        this.display_pos_order_detail('hide',order);
		        //this.order_selected = null;
		        
	        }else{
		        this.$('.client-list .highlight').removeClass('highlight');  // may be .client-line
		        $order.addClass('highlight');		        
		        
		        //var y = event.pageY - $order.parent().offset().top;
		        if(a == 1){
		            var y = ($order.data('index')*40-20)  
		            
		        }else{
		            var y = event.pageY - $order.parent().offset().top;		            
		        }		        
		         
		        this.display_pos_order_detail('show', order, y, a);
		        //this.order_selected = order;
		        
	        } 
		    
            //$('.client-line').removeClass('highlight');
            //$order.addClass('highlight');
            //this.display_pos_order_detail(order);
            //this.order_selected = order;        
		},
        render_pos_order_list: function (orders) {
            var contents = this.$el[0].querySelector('.pos_order_list');
            contents.innerHTML = "";
            for (var i = 0, len = Math.min(orders.length, 1000); i < len; i++) {
                var order = orders[i];
                // remarked below line and if
				//var pos_order_row = this.pos_order_cache.get_node(order.id);
                //if (!pos_order_row) {
                    var pos_order_row_html = qweb.render('pos_order_row', {widget: this, order: order,index: i});  // index added
                    var pos_order_row = document.createElement('tbody');
                    pos_order_row.innerHTML = pos_order_row_html;
                    pos_order_row = pos_order_row.childNodes[1];
                    this.pos_order_cache.cache_node(order.id, pos_order_row);
                //}
                if (order === this.order_selected) {
                    pos_order_row.classList.add('highlight');
                } else {
                    pos_order_row.classList.remove('highlight');
                }
                contents.appendChild(pos_order_row);
            }
        },
        hide_order_selected: function () { // hide when re-print receipt
            var contents = this.$('.pos_detail');
            contents.empty();
            this.order_selected = null;

        },
        // there are so many changes in the following function
        // display_pos_order_detail: function (order) {
        display_pos_order_detail: function (visibility, order, clickpos, a) {  
            var contents = this.$('.pos_detail');
			
			var parent   = this.$('.client-list').parent();     
	        var scroll   = parent.scrollTop();
	        var height   = contents.height();
            contents.empty();
            var self = this;
          if(visibility === 'show'){  
			this.order_selected = order;
            //if (!order) {
            //    return;
            //}
            order['link'] = window.location.origin + "/web#id=" + order.id + "&view_type=form&model=pos.order";
            contents.append($(qweb.render('pos_order_detail', {widget: this, order: order})));
            var lines = this.pos.db.lines_by_order_id[order['id']];
            if (lines) {
                var line_contents = this.$('.lines_detail');
                line_contents.empty();
                line_contents.append($(qweb.render('pos_order_lines', {widget: this, lines: lines})));
            }
            ;
            this.$('.return_order').click(function () {
                var order = self.order_selected;
                var order_lines = self.pos.db.lines_by_order_id[order.id];
                if (!order_lines) {
                    return self.gui.show_popup('confirm', {
                        title: 'Warning',
                        body: 'Order empty lines',
                    });
                } else {
                    return self.gui.show_popup('popup_return_pos_order_lines', {
                        order_lines: order_lines,
                        order: order,
                        orders_screen: true,
                    });
                }
            });
            this.$('.register_amount').click(function () {
                var pos_order = self.order_selected;
                if (pos_order) {
                    self.gui.show_popup('popup_register_payment', {
                        pos_order: pos_order
                    })
                }
            });
            this.$('.create_invoice').click(function () {
                var pos_order = self.order_selected;
                if (pos_order) {
                    return self.gui.show_popup('confirm', {
                        title: 'Create invoice ?',
                        body: 'Are you want create invoice for ' + pos_order['name'] + ' ?',
                        confirm: function () {
                            self.pos.gui.close_popup();
                            return rpc.query({
                                model: 'pos.order',
                                method: 'made_invoice',
                                args:
                                    [[pos_order['id']]],
                                context: {
                                    pos: true
                                }
                            }).then(function (invoice_vals) {
                                self.link = window.location.origin + "/web#id=" + invoice_vals[0]['id'] + "&view_type=form&model=account.invoice";
                                return self.gui.show_popup('confirm', {
                                    title: 'Are you want open invoice?',
                                    body: 'Invoice created',
                                    confirmButtonText: 'Yes',
                                    cancelButtonText: 'Close',
                                    confirm: function () {
                                        window.open(self.link, '_blank');
                                    },
                                    cancel: function () {
                                        self.pos.gui.close_popup();
                                    }
                                });
                            }).fail(function (type, error) {
                                return self.pos.query_backend_fail(type, error);
                            });
                        },
                        cancel: function () {
                            return self.pos.gui.close_popup();
                        }
                    });
                }
            });
            this.$('.reprint_order').click(function () {
                var order = self.order_selected;
                if (!order) {
                    return;
                }
                var json = {
                    'date': self.pos.format_date(order['date_order']),
                    'sequence_number': order['sequence_number'],
                    'name': order.name,
                    'partner_id': order.partner_id.id || null,
                    'lines': [],
                    'amount_total': order.amount_total,
                    'uid': order['uid'],
                    'statement_ids': [],
                    'id': order.id,
                    'ean13': order.ean13
                };
                var lines = self.pos.db.lines_by_order_id[order.id];
                if (lines) {
                    for (var i in lines) {
                        var line = lines[i];
                        json['lines'].push([0, 0, {
                            'price_unit': line.price_unit,
                            'qty': line.qty,
                            'product_id': line.product_id[0],
                            'discount': line.discount,
                            'pack_lot_ids': [],
                            'id': line.id
                        }])
                    }
                } else {
                    var lines = self.pos.db.lines_by_order_id[order['id']];
                    for (var i = 0; i < lines.length; i++) {
                        lines[i][2].qty = -lines[i][2].qty
                    }
                    json.lines = order.lines;
                }
                if (order) {
                    var order_temporary = new models.Order({}, {pos: self.pos, json: json, temporary: true});
                    var orders = self.pos.get('orders');
                    orders.add(order_temporary);
                    self.pos.set('selectedOrder', order_temporary);
                    self.pos.gui.show_screen('receipt');
                    self.hide_order_selected();
                }
            });
            this.$('.action_pos_order_cancel').click(function () {
                var order = self.order_selected;
                self.pos.gui.show_popup('confirm', {
                    title: 'Warning',
                    body: 'Are you sure cancel order ' + order['name'] + ' ?',
                    confirm: function () {
                        return rpc.query({
                            model: 'pos.order',
                            method: 'action_pos_order_cancel',
                            args:
                                [[self.order_selected['id']]],
                            context: {
                                pos: true
                            }
                        }).then(function () {
                            self.display_pos_order_detail('hide', null);   // added hide
                            self.pos.gui.show_popup('confirm', {
                                title: 'Done',
                                body: 'Order just processed to cancel'
                            });
                            var orders = _.filter(self.pos.db.orders_store, function (order) {
                                return order['state'] != 'paid' && order['state'] != 'done' && order['state'] != 'invoiced' && order['state'] != 'cancel'
                            });
                            self.render_pos_order_list(orders);
                            return self.pos.gui.close_popup();
                        }).fail(function (type, error) {
                            return self.pos.query_backend_fail(type, error);
                        })
                    },
                    cancel: function () {
                        return self.pos.gui.close_popup();
                    }
                })
            })
			
			// added
            
			if(this.contents_height == 0)
		        self.contents_height = 	contents.height();
		        	
		    //var new_height   = contents.height();
		    //self.contents_height = new_height;
		    var new_height = self.contents_height;
		        
		    if(!this.details_visible){
		        // resize client list to take into account client details		            
		        parent.height('-=' + new_height);

		        if(clickpos < scroll + new_height + 20 ){   // if selected from the top visible window	20,60,100,140,180....	                		                
		            parent.scrollTop( clickpos - 20 );
		        }else{		                				// if selected from the scrolled window, add contents height to scroll		                
		            parent.scrollTop(scroll + new_height);		               
		        }
		    }else{		        			            
		        if(a == 1)
		            parent.scrollTop(clickpos-20);
		        else
		            parent.scrollTop(scroll);  // check  last 2 vars
		    }
		    this.$('.pos_detail').show();
		    this.details_visible = true;
		    
		  } // end if show
		  
		  else if (visibility === 'hide') {		        
		      
		      parent.height('+=' + self.contents_height);		      
		      //parent.height('100%');		      
		      //contents.css({height:height+'px'});
		      //    contents.animate({height:0},400,function(){
		      //        contents.css({height:''});
		      //    });
		      		        		        
		      if(a == 1)
		          parent.scrollTop(clickpos);
		      else
		          parent.scrollTop(scroll);
		        
		      this.$('.pos_detail').hide();        
		      this.details_visible = false;
		  }
		      
        }
    });
    gui.define_screen({name: 'pos_orders_screen', widget: pos_orders_screen});

    var sale_orders = screens.ScreenWidget.extend({ // sale orders screen, booked orders
        template: 'sale_orders',

        init: function (parent, options) {
            var self = this;
            this._super(parent, options);
            this.sale_orders_cache = new screens.DomCache();
            this.sale_selected = null;
            this.pos.bind('sync:sale_orders', function (sale_id) {
                var current_screen = self.pos.gui.get_current_screen();
                if (current_screen == 'sale_orders' && self.sale_selected && self.sale_selected['id'] == sale_id) {
                    self.show();
                    var sale = self.pos.db.sale_order_by_id[sale_id];
                    self.display_sale_order(sale);
                }
            }, this);
        },

        show: function (options) {
            var sale_selected = this.pos.sale_selected;
            this._super(options);
            var self = this;
            this.$('.back').click(function () {
                self.gui.show_screen('products');
            });
            this.auto_complete_search();
            var search_timeout = null;
            this.render_sale_orders(this.pos.db.sale_orders);
            this.$('.client-list-contents').delegate('.sale_row', 'click', function (event) {
                self.order_select(event, $(this), parseInt($(this).data('id')));
            });
            var search_timeout = null;

            if (this.pos.config.iface_vkeyboard && this.chrome.widget.keyboard) {
                this.chrome.widget.keyboard.connect(this.$('.searchbox input'));
            }

            this.$('.searchbox input').on('keypress', function (event) {
                clearTimeout(search_timeout);
                var searchbox = this;
                search_timeout = setTimeout(function () {
                    self.perform_search(searchbox.value, event.which === 13);
                }, 70);
                var contents = self.$('.sale_order_detail');
                contents.empty();
            });
            this.$('.booked_order_button').click(function () {
                var sale_orders = _.filter(self.pos.db.sale_orders, function (order) {
                    return order['book_order'] == true && (order['state'] == 'draft' || order['state'] == 'sent');
                });
                var contents = self.$('.sale_order_detail');
                contents.empty();
                self.render_sale_orders(sale_orders);

            });
            this.$('.sale_lock_button').click(function () {
                var sale_orders = _.filter(self.pos.db.sale_orders, function (order) {
                    return order['state'] == 'sale' || order['state'] == 'done';
                });
                var contents = self.$('.sale_order_detail');
                contents.empty();
                self.render_sale_orders(sale_orders);
            });
            this.$('.searchbox .search-clear').click(function () {
                var contents = self.$('.sale_order_detail');
                contents.empty();
                self.clear_search();
            });
            if (sale_selected) {
                var sale = self.pos.db.sale_order_by_id[sale_selected['id']];
                self.display_sale_order(sale);
            }
        },
        clear_search: function () {
            var contents = this.$('.sale_order_detail');
            contents.empty();
            this.render_sale_orders(this.pos.db.sale_orders);
            this.$('.searchbox input')[0].value = '';
            this.$('.searchbox input').focus();
        },
        perform_search: function (query, associate_result) {
            var orders;
            if (query) {
                orders = this.pos.db.search_sale_orders(query);
                if (associate_result && orders.length === 1) {
                    return this.display_sale_order(orders[0]);
                }
                return this.render_sale_orders(orders);
            } else {
                sale_orders = this.pos.db.sale_orders;
                return this.render_sale_orders(sale_orders);
            }
        },
        auto_complete_search: function () {
            var self = this;
            var $search_box = $('.search-pos-order >input');
            if ($search_box) {
                $search_box.autocomplete({
                    source: this.pos.db.sale_orders_autocomplete,
                    minLength: this.pos.minLength,
                    select: function (event, ui) {
                        if (ui && ui['item'] && ui['item']['value']) {
                            var order = self.pos.db.sale_order_by_id[ui['item']['value']];
                            self.display_sale_order(order);
                            setTimeout(function () {
                                self.clear_search();
                            }, 1000);
                        }
                    },
					
					// added by AARSOL					
					_renderItem: function(table, item) {    
						 return $("<tr class='ui-menu-item'  role='presentation'>") 
							 .data( "item.autocomplete", item )                           
							 .append( "<td style='padding:0 4px;float:left;width:50px;'>"+item.value+"</td>"
									 +"<td style='padding:0 4px;float:left;width:500px;'>"+item.label+"</td>"
									 +"<td style='padding:0 4px;float:right;width:50px;'>"+"95.00"+"</td>" )                                                       
							 .appendTo(table);
					},					
                });
            }
        },
        partner_icon_url: function (id) {
            return '/web/image?model=res.partner&id=' + id + '&field=image_small';
        },
        order_select: function (event, $order, id) {
            var order = this.pos.db.sale_order_by_id[id];
            this.$('.client-line').removeClass('highlight');
            $order.addClass('highlight');
            this.display_sale_order(order);
        },
        render_sale_orders: function (sales) {
            var contents = this.$el[0].querySelector('.sale_orders_table');
            contents.innerHTML = "";
            for (var i = 0, len = Math.min(sales.length, 1000); i < len; i++) {
                var sale = sales[i];
                var sale_row = this.sale_orders_cache.get_node(sale.id);
                if (!sale_row) {
                    var sale_row_html = qweb.render('sale_row', {widget: this, sale: sale});
                    var sale_row = document.createElement('tbody');
                    sale_row.innerHTML = sale_row_html;
                    sale_row = sale_row.childNodes[1];
                    this.sale_orders_cache.cache_node(sale.id, sale_row);
                }
                if (sale === this.sale_selected) {
                    sale_row.classList.add('highlight');
                } else {
                    sale_row.classList.remove('highlight');
                }
                contents.appendChild(sale_row);
            }
        },
        display_sale_order: function (sale) {
            this.sale_selected = sale;
            var self = this;
            var contents = this.$('.sale_order_detail');
            contents.empty();
            if (!sale) {
                return;
            }
            sale['link'] = window.location.origin + "/web#id=" + sale.id + "&view_type=form&model=sale.order";
            contents.append($(qweb.render('sale_order_detail', {widget: this, sale: sale})));
            var sale_lines = this.pos.db.sale_lines_by_sale_id[sale.id];
            if (sale_lines) {
                var line_contents = this.$('.lines_detail');
                line_contents.empty();
                line_contents.append($(qweb.render('sale_order_lines', {widget: this, lines: sale_lines})));
            }
            this.$('.print_quotation').click(function () {
                self.chrome.do_action('sale.action_report_saleorder', {
                    additional_context: {
                        active_ids: [self.sale_selected['id']]
                    }
                })
            });
            this.$('.action_report_pro_forma_invoice').click(function () {
                self.chrome.do_action('sale.action_report_saleorder', {
                    additional_context: {
                        active_ids: [self.sale_selected['id']]
                    }
                })
            });
            this.$('.action_confirm').click(function () {
                self.pos.gui.close_popup();
                return rpc.query({
                    model: 'sale.order',
                    method: 'action_confirm',
                    args:
                        [[self.sale_selected['id']]],
                    context: {
                        pos: true
                    }
                }).then(function () {
                    self.link = window.location.origin + "/web#id=" + self.sale_selected.id + "&view_type=form&model=sale.order";
                    return self.gui.show_popup('confirm', {
                        title: 'Done',
                        body: self.sale_selected['name'] + ' confirmed',
                        confirm: function () {
                            window.open(self.link, '_blank');
                        },
                        cancel: function () {
                            self.pos.gui.close_popup();
                        }
                    })
                }).fail(function (type, error) {
                    return self.pos.query_backend_fail(type, error);
                })
            });
            this.$('.action_done').click(function () {
                return rpc.query({
                    model: 'sale.order',
                    method: 'action_done',
                    args:
                        [[self.sale_selected['id']]],
                    context: {
                        pos: true
                    }
                }).then(function () {
                    self.link = window.location.origin + "/web#id=" + self.sale_selected.id + "&view_type=form&model=sale.order";
                    return self.gui.show_popup('confirm', {
                        title: 'Done',
                        body: 'Order processed to done, are you want open order ?',
                        confirmButtonText: 'Yes',
                        cancelButtonText: 'Close',
                        confirm: function () {
                            return window.open(self.link, '_blank');
                        },
                    })
                }).fail(function (type, error) {
                    return self.pos.query_backend_fail(type, error);
                })
            });
            this.$('.action_return').click(function () {
                if (self.sale_selected) {
                    self.pos.gui.show_popup('popup_stock_return_picking', {
                        sale: self.sale_selected,
                        title: 'Return sale order',
                        confirm: function () {
                            self.render_sale_orders(self.pos.db.sale_orders);
                        }
                    })
                }

            })
            this.$('.action_validate_picking').click(function () {
                if (self.sale_selected) {
                    return rpc.query({
                        model: 'sale.order',
                        method: 'action_validate_picking',
                        args:
                            [[self.sale_selected['id']]],
                        context: {
                            pos: true
                        }
                    }).then(function (picking_name) {
                        if (picking_name) {
                            self.link = window.location.origin + "/web#id=" + self.sale_selected.id + "&view_type=form&model=sale.order";
                            return self.pos.gui.show_popup('confirm', {
                                title: 'Done',
                                body: 'Order create delivery success, are you want open Picking now ?',
                                confirm: function () {
                                    window.open(self.link, '_blank');
                                },
                                cancel: function () {
                                    self.pos.gui.close_popup();
                                }
                            })
                        } else {
                            self.link = window.location.origin + "/web#id=" + self.sale_selected.id + "&view_type=form&model=sale.order";
                            return self.pos.gui.show_popup('confirm', {
                                title: 'Warning',
                                body: 'Order have 2 picking, please do manual',
                                confirm: function () {
                                    window.open(self.link, '_blank');
                                },
                                cancel: function () {
                                    self.pos.gui.close_popup();
                                }
                            })
                        }
                        return self.pos.gui.close_popup();
                    }).fail(function (type, error) {
                        return self.pos.query_backend_fail(type, error);
                    })
                }
            })
            this.$('.delivery_order').click(function () {
                if (self.sale_selected) {
                    var lines = self.pos.db.sale_lines_by_sale_id[self.sale_selected['id']];
                    var sale_selected = self.sale_selected;
                    if (!lines) {
                        return self.pos.gui.show_popup('confirm', {
                            title: 'Warning',
                            body: 'Sale order is blank lines, could not cover to pos order',
                        })
                    }
                    var order = new models.Order({}, {pos: self.pos, temporary: true});
                    order['name'] = self.sale_selected['name'];
                    order['sale_id'] = sale_selected['id'];
                    order['delivery_address'] = sale_selected['delivery_address'];
                    order['delivery_date'] = sale_selected['delivery_date'];
                    order['delivery_phone'] = sale_selected['delivery_phone'];
                    var partner_id = sale_selected['partner_id'];
                    var partner = self.pos.db.get_partner_by_id(partner_id[0]);
                    if (partner) {
                        order.set_client(partner);
                    } else {
                        return self.pos.gui.show_popup('confirm', {
                            title: 'Warning',
                            body: 'Partner ' + partner_id[1] + ' not available on pos, please update this partner active on POS',
                        })
                    }
                    for (var i = 0; i < lines.length; i++) {
                        var line = lines[i];
                        var product = self.pos.db.get_product_by_id(line.product_id[0])
                        if (!product) {
                            return self.pos.gui.show_popup('confirm', {
                                title: 'Warning',
                                body: 'Product ' + line.product_id[1] + ' not available on pos, please checking to field available on pos for this product',
                            })
                        } else {
                            var new_line = new models.Orderline({}, {pos: self.pos, order: order, product: product});
                            new_line.set_unit_price(line.price_unit)
                            new_line.set_quantity(line.product_uom_qty, 'keep price');
                            order.orderlines.add(new_line);
                        }
                    }
                    if (self.sale_selected['payment_partial_amount'] && self.sale_selected['payment_partial_journal_id']) {
                        var payment_partial_journal_id = self.sale_selected['payment_partial_journal_id'][0];
                        var payment_partial_register = _.find(self.pos.cashregisters, function (cashregister) {
                            return cashregister.journal['id'] == payment_partial_journal_id;
                        });
                        if (payment_partial_register) {
                            var partial_paymentline = new models.Paymentline({}, {
                                order: order,
                                cashregister: payment_partial_register,
                                pos: self.pos
                            });
                            partial_paymentline.set_amount(self.sale_selected['payment_partial_amount']);
                            order.paymentlines.add(partial_paymentline);
                            order['amount_debit'] = order.get_total_with_tax() - self.sale_selected['payment_partial_amount']
                        } else {
                            return self.pos.gui.show_popup('confirm', {
                                title: 'Warning',
                                body: 'POS have not journal ' + self.sale_selected['payment_partial_journal_id'][1],
                            })
                        }
                    }
                    var orders = self.pos.get('orders');
                    orders.add(order);
                    self.pos.set('selectedOrder', order);
                    self.pos.gui.show_screen('receipt');
                }
            })
        }
    });
    gui.define_screen({name: 'sale_orders', widget: sale_orders});

    var products_screen = screens.ScreenWidget.extend({ // products screen
        template: 'products_screen',
        start: function () {
            var self = this;
            this._super();
            this.products = this.pos.products;
            this.product_by_id = {};
            this.product_by_string = "";
            if (this.products) {
                this.save_products(this.products);
            }
            
            // added by AARSOL
            hotkeys('enter', 'Products', function (event, handler) { 
		    	event.preventDefault();
		        if ($('.product_row.highlight').length > 0){
		            var cur_li = $(".product_row.highlight");
		            cur_li.trigger("click",[1]);
		        }
		        else if ($('.product_row.lowlight').length > 0){
		            var cur_li = $(".product_row.lowlight");
		            cur_li.trigger("click",[1]);
		        }
		    });	
		    hotkeys('left,esc', 'Products', function (event, handler) { 
		    	self.gui.back();
		    });	
		    hotkeys('ctrl+n', 'Products', function (event, handler) { 
		    	event.preventDefault();
		        self.$('.new-product').trigger("click");	  
		    });
		    hotkeys('ctrl+s', 'Products', function (event, handler) { 
		    	event.preventDefault();
		        self.$('.client-details-contents').find('.save').trigger("click");		  
		    });
		    hotkeys('ctrl+p', 'Products', function (event, handler) { 
		    	event.preventDefault();
		        self.$('.client-details-contents').find('.print_label').trigger("click");		
		    });	
		   
		    hotkeys('down', 'Products', function (event, handler) { 
		    	 if (self.$('.product_row.highlight').length > 0){
				     if (self.$('.product_row.highlight').is(':not(:last-child)')){					            
					     var cur_li = self.$(".product_row.highlight");
					     var next_li = cur_li.next();
						 next_li.trigger("click",[1] );						        				        
						 event.preventDefault();
					 }
			     } else if (self.$('.product_row.lowlight').length > 0){
					 if (self.$('.product_row.lowlight').is(':not(:last-child)')){					            
					     var cur_li = self.$(".product_row.lowlight");
					     var next_li = cur_li.next();
						 next_li.trigger("click",[1] );						        				        
						 event.preventDefault();
					 }
				 }  else{				      
					 var cur_li = self.$(".product_row:first-child");					       
					 cur_li.trigger("click",[1] );						    					      
					 event.preventDefault();
				 }
		    });	
		    hotkeys('up', 'Products', function (event, handler) { 
		    	if ($('.product_row.highlight').is(':not(:first-child)')){			                
			        var cur_li = $(".product_row.highlight");
			        var pre_li = $(".product_row.highlight").prev();
			        if(pre_li){
			            pre_li.trigger("click",[1] );			                	    	            
			    	    event.preventDefault();
			        }
			    } else if ($('.product_row.lowlight').is(':not(:first-child)')){			                
			        var cur_li = $(".product_row.lowlight");
			        var pre_li = $(".product_row.lowlight").prev();
			        if(pre_li){
			            pre_li.trigger("click",[1] );			                	    	            
			    	    event.preventDefault();
			        }
			    }
		    });	  	  	          	  
        },
        init: function (parent, options) {
            var self = this;
            this._super(parent, options);
            this.product_cache = new screens.DomCache();
            this.pos.bind('sync:product', function (product_data) { // product operation update screen
                var products = _.filter(self.products, function (product) {
                    return product['id'] != product_data['id'];
                });
                products.push(product_data);
                self.product_by_string = "";
                self.save_products(products);
            })
        },
        save_products: function (products) {
            for (var i = 0; i < products.length; i++) {
                var product = products[i];
                this.product_by_id[product['id']] = product;
                this.product_by_string += this.pos.db._product_search_string(product);
            }
        },
        search_products: function (query) {
            try {
                query = query.replace(/[\[\]\(\)\+\*\?\.\-\!\&\^\$\|\~\_\{\}\:\,\\\/]/g, '.');
                query = query.replace(' ', '.+');
                var re = RegExp("([0-9]+):.*?" + query, "gi");
            } catch (e) {
                return [];
            }
            var results = [];
            for (var i = 0; i < 1000; i++) {
                var r = re.exec(this.product_by_string);
                if (r && r[1]) {
                    var id = r[1];
                    if (this.product_by_id[id] !== undefined) {
                        results.push(this.product_by_id[id]);
                    } else {
                        var code = r
                    }
                } else {
                    break;
                }
            }
            return results;
        },
        show: function () {
            var self = this;
            this._super();
            this.renderElement();
            this.details_visible = false;
            this.old_product = null;
			this.contents_height = 0;  // added by AARSOL
            this.$('.back').click(function () {
                self.gui.back();
            });
            this.$('.new-product').click(function () {
                self.display_product_edit('show', {});
            });           
            this.render_list(this.products);
            if (this.old_product) {
                this.display_product_edit('show', this.old_product, 0);
            }
            this.$('.client-list-contents').delegate('.product_row', 'click', function (event, a) {	// added a
                self.product_selected(event, $(this), parseInt($(this).data('id')), a);				// added a
            });
            var search_timeout = null;
            if (this.pos.config.iface_vkeyboard && this.chrome.widget.keyboard) {
                this.chrome.widget.keyboard.connect(this.$('.searchbox input'));
            }
            this.$('.searchbox input').on('keypress', function (event) {
                clearTimeout(search_timeout);
                var query = this.value;
                search_timeout = setTimeout(function () {
                    self.perform_search(query, event.which === 13);
                }, 70);
            });
            this.$('.searchbox .search-product').click(function () {
                self.clear_search();
            });
			
			hotkeys.setScope('Products');
        },        
        hide: function () {
            hotkeys.setScope('Numpad');
			this._super();
        },
        perform_search: function (query, associate_result) {
            var products = this.search_products(query);
            this.render_list(products);
        },
        clear_search: function () {
            this.render_list(this.products);
            $('.search-product input')[0].value = '';
        },
        render_list: function (products) {
            var self = this;
            var contents = this.$el[0].querySelector('.client-list-contents');
            contents.innerHTML = "";
            for (var i = 0, len = Math.min(products.length, 100); i < len; i++) {
                var product = products[i];
                var product_line_html = qweb.render('product_row', {widget: this, product: products[i],index: i});  // index added
                var product_line = document.createElement('tbody');
                product_line.innerHTML = product_line_html;
                product_line = product_line.childNodes[1];
                this.product_cache.cache_node(product.id, product_line);
                if (product === this.old_product) {
                    product_line.classList.add('highlight');
                } else {
                    product_line.classList.remove('highlight');
                }
                contents.appendChild(product_line);
            }           
            var $search_box = $('.clientlist-screen .searchbox >input');
            $search_box.autocomplete({
                source: this.pos.db.products_autocomplete,
                minLength: this.pos.minLength,
                select: function (event, ui) {
                    if (ui && ui['item'] && ui['item']['value']) {
                        var product = self.product_by_id[ui['item']['value']];
                        if (product) {
                            self.display_product_edit('show', product);
                        }                        
                        self.clear_search();                        
                    }
                }
            });
        },
        product_selected: function (event, $line, id, a) {   // added a
            var product = this.product_by_id[id];
            this.$('.product_row .lowlight').removeClass('lowlight');  // added
            if ($line.hasClass('highlight')) {
                $line.removeClass('highlight');
                $line.addClass('lowlight');		  
                this.display_product_edit('hide', product);
            } else {
                this.$('.client-list .highlight').removeClass('highlight');
                $line.addClass('highlight');
                //var y = event.pageY - $line.parent().offset().top;
                if(a == 1){
		            var y = ($line.data('index')*40-20)  		            
		        }else{
		            var y = event.pageY - $line.parent().offset().top;		            
		        }		  
                this.display_product_edit('show', product, y, a);
            }
        },        
		        
        // return url image for widget xml
        product_icon_url: function (id) {
            return '/web/image?model=product.product&id=' + id + '&field=image_small';
        },
        // save product values to backend
        // trigger refesh products screen
        save_product_edit: function (product) {
            var self = this;
            var fields = {};
            this.$('.client-details-contents .detail').each(function (idx, el) {
                fields[el.name] = el.value || false;
            });
            if (!fields.name) {
                return this.pos.gui.show_popup('confirm', {
                    title: 'Error',
                    body: 'A Product name is required'
                });
            }
            if (this.uploaded_picture) {
                fields.image = this.uploaded_picture.split(',')[1];
            }
            fields['list_price'] = parseFloat(fields['list_price']);
            fields['pos_categ_id'] = parseFloat(fields['pos_categ_id']);
            if (fields['id']) {
                rpc.query({
                    model: 'product.product',
                    method: 'write',
                    args: [[parseInt(fields['id'])], fields],
                })
                    .then(function (result) {
                        if (result == true) {
                            self.pos.gui.show_popup('confirm', {
                                title: 'Saved',
                                body: 'Product saved'
                            })
                        }
                    }, function (type, err) {
                        self.pos.gui.show_popup('confirm', {
                            title: 'Error',
                            body: 'Odoo connection fail, could not save'
                        })
                    });
            } else {
                rpc.query({
                    model: 'product.product',
                    method: 'create',
                    args: [fields],
                })
                    .then(function (product_id) {
                        self.$('.client-details-contents').hide();
                        self.pos.gui.show_popup('confirm', {
                            title: 'Saved',
                            body: 'Product saved'
                        })
                    }, function (type, err) {
                        self.pos.gui.show_popup('confirm', {
                            title: 'Error',
                            body: 'Odoo connection fail, could not save'
                        })
                    });
            }
        },
        // resizes an image, keeping the aspect ratio intact,
        // the resize is useful to avoid sending 12Mpixels jpegs
        // over a wireless connection.
        resize_image_to_dataurl: function (img, maxwidth, maxheight, callback) {
            img.onload = function () {
                var canvas = document.createElement('canvas');
                var ctx = canvas.getContext('2d');
                var ratio = 1;

                if (img.width > maxwidth) {
                    ratio = maxwidth / img.width;
                }
                if (img.height * ratio > maxheight) {
                    ratio = maxheight / img.height;
                }
                var width = Math.floor(img.width * ratio);
                var height = Math.floor(img.height * ratio);

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                var dataurl = canvas.toDataURL();
                callback(dataurl);
            };
        },
        // Loads and resizes a File that contains an image.
        // callback gets a dataurl in case of success.
        load_image_file: function (file, callback) {
            var self = this;
            if (!file) {
                return;
            }
            if (file.type && !file.type.match(/image.*/)) {
                return this.pos.gui.show_popup('confirm', {
                    title: 'Error',
                    body: 'Unsupported File Format, Only web-compatible Image formats such as .png or .jpeg are supported',
                });
            }

            var reader = new FileReader();
            reader.onload = function (event) {
                var dataurl = event.target.result;
                var img = new Image();
                img.src = dataurl;
                self.resize_image_to_dataurl(img, 600, 400, callback);
            };
            reader.onerror = function () {
                return self.pos.gui.show_popup('confirm', {
                    title: 'Error',
                    body: 'Could Not Read Image, The provided file could not be read due to an unknown error',
                });
            };
            reader.readAsDataURL(file);
        },            
        display_product_edit: function (visibility, product, clickpos, a) { // display product details to header page   // added a
            var self = this;
            var contents = this.$('.client-details-contents');
            
            var parent   = this.$('.client-list').parent();     // shaid  .client-line
	        var scroll   = parent.scrollTop();
	        var height   = contents.height();
	        
            contents.empty();
            if (visibility == 'show') {
                contents.append($(qweb.render('product_edit', {widget: this, product: product})));
                contents.find('.save').on('click', function (event) {
                    self.save_product_edit(event);
                });
                contents.find('.print_label').on('click', function (event) {
                    var fields = {};
                    $('.client-details-contents .detail').each(function (idx, el) {
                        fields[el.name] = el.value || false;
                    });
                    var product_id = fields['id'];
                    var product = self.pos.db.product_by_id[product_id];
                    if (product && product['barcode']) {
                        var product_label_html = qweb.render('product_label_xml', {
                            product: product
                        });
                        self.pos.proxy.print_receipt(product_label_html);
                        self.pos.gui.show_popup('confirm', {
                            title: 'Printed barcode',
                            body: 'Please get product label at your printer'
                        })
                    } else {
                        self.pos.gui.show_popup('confirm', {
                            title: 'Missing barcode',
                            body: 'Barcode of product not set'
                        })
                    }

                })
                
                // added by AARSOL
                if(this.contents_height == 0)
		            self.contents_height = 	contents.height();  	
		    
		        var new_height = self.contents_height;
		        
		        if(!this.details_visible){
		            // resize client list to take into account client details		            
		            parent.height('-=' + new_height);

		            if(clickpos < scroll + new_height + 20 ){   // if selected from the top visible window	20,60,100,140,180....	                		                
		                parent.scrollTop( clickpos - 20 );
		            }else{		                				// if selected from the scrolled window, add contents height to scroll		                
		                parent.scrollTop(scroll + new_height);		               
		            }
		        }else{		        			            
		            if(a == 1)
		                parent.scrollTop(clickpos-20);
		            else
		                parent.scrollTop(scroll);  // check  last 2 vars
		        }
		        this.$('.client-details-contents').show();
		        this.details_visible = true;
            }
            if (visibility == 'hide') {
                parent.height('+=' + self.contents_height);	
		        if(a == 1)
		            parent.scrollTop(clickpos);
		        else
		            parent.scrollTop(scroll);
		        
		         this.$('.client-details-contents').hide();       
		        this.details_visible = false;
               
            }

            contents.find('input').blur(function () {
                setTimeout(function () {
                    self.$('.window').scrollTop(0);
                }, 0);
            });
            contents.find('.image-uploader').on('change', function (event) {
                self.load_image_file(event.target.files[0], function (res) {
                    if (res) {
                        contents.find('.client-picture img, .client-picture .fa').remove();
                        contents.find('.client-picture').append("<img src='" + res + "'>");
                        contents.find('.detail.picture').remove();
                        self.uploaded_picture = res;
                    }
                });
            });
        },
        // close screen
        close: function () {
            this._super();
        }
    });
    gui.define_screen({name: 'productlist', widget: products_screen});

    screens.ReceiptScreenWidget.include({
        renderElement: function () {
            var self = this;
            this._super();
            this.$('.back_order').click(function () {
                var order = self.pos.get_order();
                if (order) {
                    self.pos.gui.show_screen('products');
                }
            });
        },
        // added by AARSOL    
        start: function () {
            var self = this;
            this._super();
            
            
            hotkeys('enter,right', 'Receipt', function (event, handler) { 
		    	event.preventDefault();
		    	hotkeys.setScope('Numpad');	
		    	if (!self._locked) {
                    self.click_next();
                }
		    });		    
		   
		    hotkeys('esc,left', 'Receipt', function (event, handler) { 
		    	event.preventDefault();
		    	hotkeys.setScope('Numpad');	
		    	self.$(".back_order").trigger("click");
		    }); 
		    
		    hotkeys('p', 'Receipt', function (event, handler) { 
		    	event.preventDefault();
		    	hotkeys.setScope('Numpad');	
		    	$(".print").trigger("click");
		    });                     
        },
        
        // added by AARSOL        
		hide: function(){
	        hotkeys.setScope('Numpad');	
	        this._super();
	    },		
        show: function () {
            this._super();
            hotkeys.setScope('Receipt');	
            try {
                JsBarcode("#barcode", this.pos.get('selectedOrder').ean13, {
                    format: "EAN13",
                    displayValue: true,
                    fontSize: 20
                });
            } catch (error) {
            }
        },
        render_receipt: function () {
            var self = this;
            var order = this.pos.get_order();
            if (this.pos.config.receipt_invoice_number && order.is_to_invoice()) {
                var invoiced = new $.Deferred();
                rpc.query({
                    model: 'pos.order',
                    method: 'search_read',
                    domain: [['ean13', '=', order['ean13']]],
                    fields: ['invoice_id'],
                }).then(function (orders) {
                    invoiced.resolve();
                    if (orders.length > 0) {
                        var invoice_number = orders[0]['invoice_id'][1].split(" ")[0];
                        self.pos.get_order()['invoice_number'] = invoice_number;
                        console.log(invoice_number);
                    }
                    if (self.pos.config.duplicate_receipt && self.pos.config.print_number > 1) {
                        var contents = $('.pos-receipt-container');
                        var i = 1;
                        while (i < self.pos.config.print_number) {
                            contents.append(qweb.render('PosTicket', self.get_receipt_render_env()));
                            i++;
                        }
                    }
                    if (!self.pos.config.duplicate_receipt) {
                        $('.pos-receipt-container').html(qweb.render('PosTicket', self.get_receipt_render_env()));
                    }
                    if (self.pos.config.ticket_font_size) {
                        $('.pos-sale-ticket').css({'font-size': self.pos.config.ticket_font_size})
                    }
                }).fail(function (type, error) {
                    invoiced.reject(error);
                    return self.pos.query_backend_fail(type, error);
                });
                return invoiced;
            } else {
                if (this.pos.config.duplicate_receipt && this.pos.config.print_number > 1) {
                    var contents = $('.pos-receipt-container');
                    var i = 1;
                    while (i < this.pos.config.print_number) {
                        contents.append(qweb.render('PosTicket', this.get_receipt_render_env()));
                        i++;
                    }
                } else {
                    this._super();
                }
                if (this.pos.config.ticket_font_size) {
                    $('.pos-sale-ticket').css({'font-size': this.pos.config.ticket_font_size})
                }
            }
        },
        get_receipt_render_env: function () {
            var data_print = this._super();
            var orderlines_by_category_name = {};
            var order = this.pos.get_order();
            var orderlines = order.orderlines.models;
            var categories = [];
            if (this.pos.config.category_wise_receipt) {
                for (var i = 0; i < orderlines.length; i++) {
                    var line = orderlines[i];
                    var pos_categ_id = line['product']['pos_categ_id']
                    if (pos_categ_id && pos_categ_id.length == 2) {
                        var root_category_id = order.get_root_category_by_category_id(pos_categ_id[0])
                        var category = this.pos.db.category_by_id[root_category_id]
                        var category_name = category['name'];
                        if (!orderlines_by_category_name[category_name]) {
                            orderlines_by_category_name[category_name] = [line];
                            var category_index = _.findIndex(categories, function (category) {
                                return category == category_name;
                            });
                            if (category_index == -1) {
                                categories.push(category_name)
                            }
                        } else {
                            orderlines_by_category_name[category_name].push(line)
                        }

                    } else {
                        if (!orderlines_by_category_name['None']) {
                            orderlines_by_category_name['None'] = [line]
                        } else {
                            orderlines_by_category_name['None'].push(line)
                        }
                        var category_index = _.findIndex(categories, function (category) {
                            return category == 'None';
                        });
                        if (category_index == -1) {
                            categories.push('None')
                        }
                    }
                }
            }
            data_print['orderlines_by_category_name'] = orderlines_by_category_name;
            data_print['categories'] = categories;
            this.pos.last_data_print = data_print;
           
            return data_print
        }
    });

    screens.PaymentScreenWidget.include({
        order_changes: function () {
            this._super();
            this.renderElement();
            var order = this.pos.get_order();
            if (!order) {
                return;
            } else if (order.is_paid()) {
                self.$('.next').addClass('highlight');
            } else {
                self.$('.next').removeClass('highlight');
            }
        },
        click_invoice: function () {
            this._super();
            var order = this.pos.get_order();
            if (order.is_to_invoice()) {
                this.$('.js_invoice').addClass('highlight');
            } else {
                this.$('.js_invoice').removeClass('highlight');
            }
        },
        customer_changed: function () { // when client change, email invoice auto change
            this._super();
            var client = this.pos.get_client();
            var $send_invoice_email = this.$('.send_invoice_email');
            if (client && client.email) {
                if ($send_invoice_email && $send_invoice_email.length) {
                    $send_invoice_email.text(client ? client.email : _t('N/A'));
                }
            } else {
                if ($send_invoice_email && $send_invoice_email.length) {
                    $send_invoice_email.text('Email N/A');
                }
            }
        },
        click_invoice_journal: function (journal_id) { // change invoice journal when create invoice
            var order = this.pos.get_order();
            order['invoice_journal_id'] = journal_id;
            this.$('.journal').removeClass('highlight');
            var $journal_selected = this.$("[journal-id='" + journal_id + "']");
            $journal_selected.addClass('highlight');
        },
        render_invoice_journals: function () { // render invoice journal, no use invoice journal default of pos
            var self = this;
            var methods = $(qweb.render('journal_list', {widget: this}));
            methods.on('click', '.journal', function () {
                self.click_invoice_journal($(this).data('id'));
            });
            return methods;
        },

        renderElement: function () {
            var self = this;
            // Quickly Payment
            if (this.pos.quickly_datas) {
                this.quickly_datas = this.pos.quickly_datas;
            } else {
                this.quickly_datas = []
            }
            this._super();
            if (this.pos.config.invoice_journal_ids && this.pos.config.invoice_journal_ids.length > 0 && this.pos.journals) {
                var methods = this.render_invoice_journals();
                methods.appendTo(this.$('.invoice_journals'));
            }
            var order = this.pos.get_order();
            if (order && this.pos.currency && this.pos.currency_by_id) {// Multi Currency
                order.selected_currency = this.pos.currency_by_id[this.pos.currency.id];
            }
            
            // AARSOL added
            if(order) {          	
            	var orderlines_by_category_name = {};
            			        
		        var orderlines = order.orderlines.models;
		        var categories = [];
		        if (this.pos.config.category_wise_receipt) {
		            for (var i = 0; i < orderlines.length; i++) {
		                var line = orderlines[i];
		                var pos_categ_id = line['product']['pos_categ_id']
		                if (pos_categ_id && pos_categ_id.length == 2) {
		                    var root_category_id = order.get_root_category_by_category_id(pos_categ_id[0])
		                    var category = this.pos.db.category_by_id[root_category_id]
		                    var category_name = category['name'];
		                    if (!orderlines_by_category_name[category_name]) {
		                        orderlines_by_category_name[category_name] = [line];
		                        var category_index = _.findIndex(categories, function (category) {
		                            return category == category_name;
		                        });
		                        if (category_index == -1) {
		                            categories.push(category_name)
		                        }
		                    } else {
		                        orderlines_by_category_name[category_name].push(line)
		                    }

		                } else {
		                    if (!orderlines_by_category_name['None']) {
		                        orderlines_by_category_name['None'] = [line]
		                    } else {
		                        orderlines_by_category_name['None'].push(line)
		                    }
		                    var category_index = _.findIndex(categories, function (category) {
		                        return category == 'None';
		                    });
		                    if (category_index == -1) {
		                        categories.push('None')
		                    }
		                }
		            }
		        }
		                    	
            	this.$('.paymentorderlines-container').html(qweb.render('PosTicket', {
				    widget: this,
				    pos: this.pos,
				    order: order,
				    receipt: order.export_for_printing(),
				    orderlines: order.get_orderlines(),
				    paymentlines: order.get_paymentlines(),
				    orderlines_by_category_name: orderlines_by_category_name,
				    categories: categories,
				    hideheading: true, 
				}));
            }
            
            this.$('.select-currency').on('change', function (e) {
                var currency_id = parseInt($('.select-currency').val());
                var selected_currency = self.pos.currency_by_id[currency_id];
                var company_currency = self.pos.currency_by_id[self.pos.currency['id']];
                // Return action if have not selected currency or company currency is 0
                if (!selected_currency || company_currency['rate'] == 0) {
                    return;
                }
                order.selected_currency = selected_currency;
                var currency_covert_text = company_currency['rate'] / selected_currency['rate'];
                // add current currency rate to payment screen
                var $currency_covert = self.el.querySelector('.currency-covert');
                if ($currency_covert) {
                    $currency_covert.textContent = '1 ' + selected_currency['name'] + ' = ' + currency_covert_text + ' ' + company_currency['name'];
                }
                var selected_paymentline = order.selected_paymentline;
                var default_register = _.find(self.pos.cashregisters, function (register) {
                    return register['journal']['pos_method_type'] == 'default';
                });
                if (selected_paymentline) {
                    selected_paymentline.set_amount("0");
                    self.inputbuffer = "";
                }
                if (!selected_paymentline && default_register) {
                    order.add_paymentline(default_register);
                }
                var due = order.get_due();
                var amount_full_paid = due * selected_currency['rate'] / company_currency['rate'];
                var due_currency = amount_full_paid;
                var $currency_paid_full = self.el.querySelector('.currency-paid-full');
                if ($currency_paid_full) {
                    $currency_paid_full.textContent = due_currency;
                }
                self.add_currency_to_payment_line();
                self.render_paymentlines();
            });
            this.$('.update-rate').on('click', function (e) {
                var currency_id = parseInt($('.select-currency').val());
                var selected_currency = self.pos.currency_by_id[currency_id];
                self.selected_currency = selected_currency;
                if (selected_currency) {
                    self.hide();
                    self.gui.show_popup('textarea', {
                        title: _t('Input Rate'),
                        value: self.selected_currency['rate'],
                        confirm: function (rate) {
                            var selected_currency = self.selected_currency;
                            selected_currency['rate'] = parseFloat(rate);
                            self.show();
                            self.renderElement();
                            var params = {
                                name: new Date(),
                                currency_id: self.selected_currency['id'],
                                rate: parseFloat(rate),
                            };
                            return rpc.query({
                                model: 'res.currency.rate',
                                method: 'create',
                                args:
                                    [params],
                                context: {}
                            }).then(function (rate_id) {
                                return self.pos.gui.show_popup('confirm', {
                                    title: 'Success',
                                    body: 'Update rate done'
                                })
                            }).then(function () {
                                return self.gui.close_popup();
                            }).fail(function (type, error) {
                                self.pos.query_backend_fail(type, error);
                            });
                        },
                        cancel: function () {
                            self.show();
                            self.renderElement();
                        }
                    });
                }
            });
            this.$('.add_note').click(function () { // Button add Note
                var order = self.pos.get_order();
                if (order) {
                    self.hide();
                    self.gui.show_popup('textarea', {
                        title: _t('Add Order Note'),
                        value: order.get_note(),
                        confirm: function (note) {
                            order.set_note(note);
                            order.trigger('change', order);
                            self.show();
                            self.renderElement();
                        },
                        cancel: function () {
                            self.show();
                            self.renderElement();
                        }
                    });
                }
            });
            this.$('.signature_order').click(function () { // Signature on Order
                var order = self.pos.get_order();
                self.hide();
                self.gui.show_popup('popup_order_signature', {
                    order: order,
                    confirm: function (rate) {
                        self.show();
                    },
                    cancel: function () {
                        self.show();
                    }
                });

            });
            this.$('.paid_full').click(function () { // payment full
                var order = self.pos.get_order();
                var selected_paymentline = order.selected_paymentline;
                var register = _.find(self.pos.cashregisters, function (register) {
                    return register['journal']['pos_method_type'] == 'default';
                });
                var amount_due = order.get_due();
                if (register) {
                    if (!selected_paymentline) {
                        order.add_paymentline(register);
                        selected_paymentline = order.selected_paymentline;
                    }
                    selected_paymentline.set_amount(amount_due);
                    self.order_changes();
                    self.render_paymentlines();
                    self.$('.paymentline.selected .edit').text(self.format_currency_no_symbol(amount_due));
                }
            });
            this.$('.paid_partial').click(function () { // partial payment
                var order = self.pos.get_order();
                order.partial_payment = true;
                self.pos.push_order(order);
                self.gui.show_screen('receipt');
            });
            this.$('.add_credit').click(function () { // set change amount to credit
                self.click_add_credit();
            });
            this.$('.add_team').click(function () { // set change amount to credit
                self.hide();
                var list = [];
                for (var i = 0; i < self.pos.bus_locations.length; i++) {
                    var bus = self.pos.bus_locations[i];
                    list.push({
                        'label': bus['user_id'][1] + '/' + bus['name'],
                        'item': bus
                    })
                }
                return self.gui.show_popup('selection', {
                    title: _t('Select sale lead'),
                    list: list,
                    confirm: function (bus) {
                        var user_id = bus['user_id'][0];
                        var user = self.pos.user_by_id[user_id];
                        var order = self.pos.get_order();
                        if (user && order) {
                            self.pos.db.set_cashier(user);
                            self.pos.bus_location = bus;
                            order.trigger('change');
                        }
                        self.show();
                        self.renderElement();
                    },
                    cancel: function () {
                        self.show();
                        self.renderElement();
                    }
                });
            });
            this.$('.input_voucher').click(function () { // input manual voucher
                self.hide();
                return self.pos.gui.show_popup('alert_input', {
                    title: _t('Voucher code ?'),
                    confirm: function (code) {
                        self.show();
                        self.renderElement();
                        if (!code) {
                            return false;
                        } else {
                            return rpc.query({
                                model: 'pos.voucher',
                                method: 'get_voucher_by_code',
                                args: [code],
                            }).then(function (voucher) {
                                if (voucher == -1) {
                                    return self.gui.show_popup('confirm', {
                                        title: 'Wrong',
                                        body: 'Code used before or code have not exist or code expired date',
                                    });
                                } else {
                                    var current_order = self.pos.get('selectedOrder');
                                    current_order.voucher_id = voucher.id;
                                    var voucher_register = _.find(self.pos.cashregisters, function (cashregister) {
                                        return cashregister.journal['pos_method_type'] == 'voucher';
                                    });
                                    if (voucher_register) {
                                        if (voucher['customer_id'] && voucher['customer_id'][0]) {
                                            var client = self.pos.db.get_partner_by_id(voucher['customer_id'][0]);
                                            if (client) {
                                                current_order.set_client(client)
                                            }
                                        }
                                        var amount = 0;
                                        if (voucher['apply_type'] == 'fixed_amount') {
                                            amount = voucher.value;
                                        } else {
                                            amount = current_order.get_total_with_tax() / 100 * voucher.value;
                                        }
                                        // remove old paymentline have journal is voucher
                                        var paymentlines = current_order.paymentlines;
                                        for (var i = 0; i < paymentlines.models.length; i++) {
                                            var payment_line = paymentlines.models[i];
                                            if (payment_line.cashregister.journal['pos_method_type'] == 'voucher') {
                                                payment_line.destroy();
                                            }
                                        }
                                        // add new payment with this voucher just scanned
                                        var voucher_paymentline = new models.Paymentline({}, {
                                            order: current_order,
                                            cashregister: voucher_register,
                                            pos: self.pos
                                        });
                                        voucher_paymentline.set_amount(amount);
                                        current_order.paymentlines.add(voucher_paymentline);
                                        current_order.trigger('change', current_order)
                                        self.render_paymentlines();
                                        self.$('.paymentline.selected .edit').text(self.format_currency_no_symbol(amount));
                                        return true;
                                    } else {
                                        return self.pos.gui.show_popup('confirm', {
                                            title: 'Warning',
                                            body: 'Could not add payment line because your system have not create journal have type voucher or journal voucher not add to your pos config',
                                        });
                                    }

                                }
                            }).fail(function (type, error) {
                                return self.pos.query_backend_fail(type, error);
                            });
                        }
                    },
                    cancel: function () {
                        self.show();
                        self.renderElement();
                    }
                });
            });
            this.$('.add_wallet').click(function () { // add change amount to wallet card
                self.hide();
                var order = self.pos.get_order();
                var change = order.get_change();
                var wallet_register = _.find(self.pos.cashregisters, function (cashregister) {
                    return cashregister.journal['pos_method_type'] == 'wallet';
                });
                if (!change || change == 0) {
                    return self.pos.gui.show_popup('confirm', {
                        title: _t('Warning'),
                        body: _t('Order change empty'),
                        cancel: function () {
                            self.show();
                            self.renderElement();
                            self.order_changes();
                            return self.pos.gui.close_popup();
                        },
                        confirm: function () {
                            self.show();
                            self.renderElement();
                            self.order_changes();
                            return self.pos.gui.close_popup();
                        }
                    });
                }
                if (!wallet_register) {
                    return self.pos.gui.show_popup('confirm', {
                        title: _t('Warning'),
                        body: 'Wallet journal is missing inside your system',
                        cancel: function () {
                            self.show();
                            self.renderElement();
                            return self.pos.gui.close_popup();
                        },
                        confirm: function () {
                            self.show();
                            self.renderElement();
                            return self.pos.gui.close_popup();
                        }
                    });
                }
                if (order.finalized == false) {
                    self.gui.show_popup('number', {
                        'title': _t('Add to customer wallet'),
                        'value': change,
                        'confirm': function (value) {
                            if (value <= order.get_change()) {
                                var wallet_paymentline = new models.Paymentline({}, {
                                    order: order,
                                    cashregister: wallet_register,
                                    pos: self.pos
                                });
                                wallet_paymentline.set_amount(-value);
                                order.paymentlines.add(wallet_paymentline);
                                order.trigger('change', order);
                            }
                            self.show();
                            self.renderElement();
                            self.order_changes();
                        },
                        cancel: function () {
                            self.show();
                            self.renderElement();
                        }
                    });
                }
            });
            this.$('.quickly-payment').click(function () { // Quickly Payment
                self.pos.cashregisters = self.pos.cashregisters.sort(function (a, b) {
                    return a.id - b.id;
                });
                var quickly_payment_id = parseInt($(this).data('id'));
                var quickly_payment = self.pos.quickly_payment_by_id[quickly_payment_id];
                var order = self.pos.get_order();
                var paymentlines = order.get_paymentlines();
                var open_paymentline = false;
                for (var i = 0; i < paymentlines.length; i++) {
                    if (!paymentlines[i].paid) {
                        open_paymentline = true;
                    }
                }
                if (self.pos.cashregisters.length == 0) {
                    return;
                }
                if (!open_paymentline) {
                    var register_random = _.find(self.pos.cashregisters, function (register) {
                        return register['journal']['pos_method_type'] == 'default';
                    });
                    if (register_random) {
                        order.add_paymentline(register_random);
                    } else {
                        return;
                    }
                }
                if (quickly_payment && order.selected_paymentline) {
                    var money = quickly_payment['amount'] + order.selected_paymentline['amount']
                    order.selected_paymentline.set_amount(money);
                    self.order_changes();
                    self.render_paymentlines();
                    self.$('.paymentline.selected .edit').text(self.format_currency_no_symbol(money));
                }
            });
            this.$('.send_invoice_email').click(function () { // input email send invoice
                var order = self.pos.get_order();
                var client = order.get_client();
                if (client) {
                    if (client.email) {
                        var email_invoice = order.is_email_invoice();
                        order.set_email_invoice(!email_invoice);
                        if (order.is_email_invoice()) {
                            self.$('.send_invoice_email').addClass('highlight');
                            if (!order.to_invoice) {
                                self.$('.js_invoice').click();
                            }
                        } else {
                            self.$('.send_invoice_email').removeClass('highlight');
                            if (order.to_invoice) {
                                self.$('.js_invoice').click();
                            }
                        }
                    } else {
                        self.pos.gui.show_screen('clientlist');
                        return self.pos.gui.show_popup('confirm', {
                            title: 'Warning',
                            body: 'Customer email is blank, please update'
                        })
                    }

                } else {
                    self.pos.gui.show_screen('clientlist');
                    return self.pos.gui.show_popup('confirm', {
                        title: 'Warning',
                        body: 'Please select client the first'
                    })
                }
            });
            this.$('.js_auto_register_payment').click(function () { // input email send invoice
                var order = self.pos.get_order();
                var client = order.get_client();
                if (client) {
                    var auto_register_payment = order.is_auto_register_payment();
                    order.set_auto_register_payment(!auto_register_payment);
                    if (order.is_auto_register_payment()) {
                        self.$('.js_auto_register_payment').addClass('highlight');
                        if (!order.to_invoice) {
                            self.$('.js_invoice').click();
                        }
                    } else {
                        self.$('.js_auto_register_payment').removeClass('highlight');
                        if (order.to_invoice) {
                            self.$('.js_invoice').click();
                        }
                    }
                } else {
                    self.pos.gui.show_screen('clientlist');
                    return self.pos.gui.show_popup('confirm', {
                        title: 'Warning',
                        body: 'Please select client the first'
                    })
                }
            });
        },
        click_add_credit: function () {
            var order = this.pos.get_order();
            order.set_to_add_credit(!order.is_add_credit());
            var add_credit = order.is_add_credit();
            if (add_credit) {
                this.$('.add_credit').addClass('highlight');
            } else {
                this.$('.add_credit').removeClass('highlight');
            }
        },
        add_currency_to_payment_line: function (line) {
            var order = this.pos.get_order();
            line = order.selected_paymentline;
            line.selected_currency = order.selected_currency;
        },
        render_paymentlines: function () {
            this._super();
            var order = this.pos.get_order();
            if (!order) {
                return;
            }
            var client = order.get_client();
            var wallet_register = _.find(this.pos.cashregisters, function (cashregister) { // Show || Hide Wallet method
                return cashregister.journal.pos_method_type == 'wallet';
            });
            if (wallet_register) {
                // if change amount > 0 or client wallet > 0, display payment method
                // else disable
                var change = order.get_change();
                var journal_id = wallet_register.journal.id;
                var $journal_element = $("[data-id='" + journal_id + "']");
                if (client && client['wallet'] > 0) {
                    $journal_element.removeClass('oe_hidden');
                    $journal_element.html('<span class="wallet">[Wallet card] ' + this.format_currency(client.wallet) + '</span>');
                } else {
                    $journal_element.addClass('oe_hidden');
                }
            }
            var credit_register = _.find(this.pos.cashregisters, function (cashregister) { // Show || Hide credit method
                return cashregister.journal['pos_method_type'] == 'credit';
            });
            if (credit_register) {
                if (!client || client.balance <= 0) {
                    var credit_journal_content = $("[data-id='" + credit_register.journal.id + "']");
                    credit_journal_content.addClass('oe_hidden');
                } else {
                    var credit_journal_content = $("[data-id='" + credit_register.journal.id + "']");
                    credit_journal_content.removeClass('oe_hidden');
                    credit_journal_content.html('<span >[Credit card] ' + this.format_currency(client.balance) + '</span>');
                }
            }
            // Show || Hide Return method
            // find return journal inside this pos
            // if current order is not return order, hide journal
            var cash_register = _.find(this.pos.cashregisters, function (cashregister) {
                return cashregister.journal['pos_method_type'] == 'return';
            });
            if (cash_register && order) {
                var return_order_journal_id = cash_register.journal.id;
                var return_order_journal_content = $("[data-id='" + return_order_journal_id + "']");
                if (!order['is_return']) {
                    return_order_journal_content.addClass('oe_hidden');
                } else {
                    return_order_journal_content.removeClass('oe_hidden');
                }
            }
            // Show || Hide Voucher method
            // find voucher journal inside this pos
            // and hide this voucher element, because if display may be made seller confuse
            var voucher_journal = _.find(this.pos.cashregisters, function (cashregister) {
                return cashregister.journal['pos_method_type'] == 'voucher';
            });
            if (voucher_journal) {
                var voucher_journal_id = voucher_journal.journal.id;
                var voucher_journal_content = $("[data-id='" + voucher_journal_id + "']");
                voucher_journal_content.addClass('oe_hidden');
            }
        },
        // Active device scan barcode voucher
        show: function () {
            var self = this;
            this._super();
            
            // added by AARSOL            
            hotkeys.setScope('Payment');
            
            this.pos.barcode_reader.set_action_callback({
                'voucher': _.bind(self.barcode_voucher_action, self),
            });
        },
        
        // added by AARSOL    
        start: function () {
            var self = this;
            this._super();
            
            hotkeys('enter', 'Payment', function (event, handler) { 
		    	self.validate_order();
		    });
		    hotkeys('d', 'Payment', function (event, handler) { 
		    	$("tr.paymentline.selected").find("td.delete-button").trigger("click");
		    });
		    hotkeys('esc,left', 'Payment', function (event, handler) { 
		    	hotkeys.setScope('Numpad');	
		    	self.click_back();
		    });	  		  	  
            hotkeys('1,2,3,4,5,6,7,8,9,0,_0,_1,_2,_3,_4,_5,_6,_7,_8,_9,_point,backspace,del,_plus,_minus', 'Payment' ,function (event, handler) {                
                switch(handler.key){
	                case "1": case "_1": key='1'; break;
	                case "2": case "_2": key='2'; break;
	                case "3": case "_3": key='3'; break;
	                case "4": case "_4": key='4'; break;
	                case "5": case "_5": key='5'; break;
	                case "6": case "_6": key='6'; break;
	                case "7": case "_7": key='7'; break;
	                case "8": case "_8": key='8'; break;
	                case "9": case "_9": key='9'; break;
	                case "0": case "_0": key='0'; break;
	                case ".": case "_point": key='.'; break;
	                case "backspace": key = 'BACKSPACE'; break;
	                case "del": key = 'CLEAR'; break;
	                case "_plus": key = '+'; break;
	                case "_minus": key = '-'; break;
	            }
	            if(!$(".paymentline").hasClass("selected")){     // payment methods using numbers (1 to 9)
	                payment_key = key - 1;
        	        $(".paymentmethods").children().eq(payment_key).trigger('click');
	            } else {
	                self.payment_input(key);
			    }
			    event.preventDefault();
            });
        },
        
        // added by AARSOL        
		hide: function(){
	        hotkeys.setScope('Numpad');	
	        this._super();
	    },		
        // scan voucher viva device
        barcode_voucher_action: function (datas) {
            var self = this;
            this.datas_code = datas;
            rpc.query({
                model: 'pos.voucher',
                method: 'get_voucher_by_code',
                args: [datas['code']],
            }).then(function (voucher) {
                if (voucher == -1) {
                    self.barcode_error_action(self.datas_code);
                    return false;
                } else {
                    var current_order = self.pos.get('selectedOrder');
                    current_order.voucher_id = voucher.id;
                    var voucher_register = _.find(self.pos.cashregisters, function (cashregister) {
                        return cashregister.journal['pos_method_type'] == 'voucher';
                    });
                    if (voucher_register) {
                        if (voucher['customer_id'] && voucher['customer_id'][0]) {
                            var client = self.pos.db.get_partner_by_id(voucher['customer_id'][0]);
                            if (client) {
                                current_order.set_client(client)
                            }
                        }
                        var amount = 0;
                        if (voucher['apply_type'] == 'fixed_amount') {
                            amount = voucher.value;
                        } else {
                            amount = current_order.get_total_with_tax() / 100 * voucher.value;
                        }
                        // remove old paymentline have journal is voucher
                        var paymentlines = current_order.paymentlines;
                        for (var i = 0; i < paymentlines.models.length; i++) {
                            var payment_line = paymentlines.models[i];
                            if (payment_line.cashregister.journal['pos_method_type'] == 'voucher') {
                                payment_line.destroy();
                            }
                        }
                        // add new payment with this voucher just scanned
                        var voucher_paymentline = new models.Paymentline({}, {
                            order: current_order,
                            cashregister: voucher_register,
                            pos: self.pos
                        });
                        voucher_paymentline.set_amount(amount);
                        current_order.paymentlines.add(voucher_paymentline);
                        current_order.trigger('change', current_order)
                        self.render_paymentlines();
                        self.$('.paymentline.selected .edit').text(self.format_currency_no_symbol(amount));
                    } else {
                        self.gui.show_popup('notify_popup', {
                            title: 'ERROR',
                            from: 'top',
                            align: 'center',
                            body: 'Please create 1 Journal Method with POS method type is Voucher, add to pos config, close session and re-start session.',
                            color: 'danger',
                            timer: 1000
                        });
                        return;
                    }

                }
            }).fail(function (type, error) {
                return self.pos.query_backend_fail(type, error);
            });
            return true;
        }
        ,
        click_paymentmethods: function (id) {
            // id : id of journal
            var self = this;
            this._super(id);
            var order = this.pos.get_order();
            var selected_paymentline = order.selected_paymentline;
            var client = order.get_client();

            // if credit, wallet: require choice client the first
            if (selected_paymentline && selected_paymentline.cashregister && selected_paymentline.cashregister.journal['pos_method_type'] && (selected_paymentline.cashregister.journal['pos_method_type'] == 'wallet' || selected_paymentline.cashregister.journal['pos_method_type'] == 'credit') && !client) {
                return setTimeout(function () {
                    self.pos.gui.show_screen('clientlist');
                }, 30);
            }
            // method wallet
            var wallet_register_selected = _.find(this.pos.cashregisters, function (register) {
                return register.journal['pos_method_type'] == 'wallet' || register.journal['id'];
            });
            if (client && wallet_register_selected && selected_paymentline) {
                var change = order.get_change();
                selected_paymentline.set_amount(change);
            }
        },
        validate_order: function (force_validation) {
            var self = this;
            hotkeys.setScope('Numpad');	
            var order = this.pos.get_order();
            var wallet = 0;
            var use_wallet = false;
            var credit = 0;
            var use_credit = false;
            var payments_lines = order.paymentlines.models;
            var client = this.pos.get_order().get_client();
            if (client) {
                for (var i = 0; i < payments_lines.length; i++) {
                    var payment_line = payments_lines[i];
                    if (payment_line.cashregister.journal['pos_method_type'] && payment_line.cashregister.journal['pos_method_type'] == 'wallet') {
                        wallet += payment_line.get_amount();
                        use_wallet = true;
                    }
                    if (payment_line.cashregister.journal['pos_method_type'] && payment_line.cashregister.journal['pos_method_type'] == 'credit') {
                        credit += payment_line.get_amount();
                        use_credit = true;
                    }
                }
                if (client['wallet'] < wallet && use_wallet == true) {
                    return this.pos.gui.show_popup('confirm', {
                        title: _t('Warning'),
                        body: 'You can not set wallet bigger than ' + this.format_currency(client['wallet']),
                    })
                }
                if ((client['balance'] - credit < 0) && use_credit == true) {
                    return this.pos.gui.show_popup('confirm', {
                        title: _t('Error'),
                        body: 'Balance debit/credit current of customer only have : ' + client['balance'],
                    })
                }
            }
            var res = this._super(force_validation);
            return res;
        },
    });

    // receipt screeen review
    // review receipt
    // receipt review
    var receipt_review = screens.ScreenWidget.extend({
        template: 'receipt_review',
        show: function () {
            this._super();
            var self = this;
            this.render_change();
            this.render_receipt();
            this.handle_auto_print();
        },
        handle_auto_print: function () {
            if (this.should_auto_print()) {
                this.print();
            } else {
                this.lock_screen(false);
            }
        },
        should_auto_print: function () {
            return this.pos.config.iface_print_auto && !this.pos.get_order()._printed;
        },
        should_close_immediately: function () {
            return this.pos.config.iface_print_via_proxy && this.pos.config.iface_print_skip_screen;
        },
        lock_screen: function (locked) {
            this._locked = locked;
            if (locked) {
                this.$('.back').removeClass('highlight');
            } else {
                this.$('.back').addClass('highlight');
            }
        },
        get_receipt_render_env: function () {
            var order = this.pos.get_order();
            return {
                widget: this,
                pos: this.pos,
                order: order,
                receipt: order.export_for_printing(),
                orderlines: order.get_orderlines(),
                paymentlines: order.get_paymentlines(),
            };
        },
        print_web: function () {
            window.print();
            this.pos.get_order()._printed = true;
        },
        print_xml: function () {
            var env = this.get_receipt_render_env();
            var receipt;
            if (this.pos.config.receipt_without_payment_template == 'display_price') {
                receipt = qweb.render('XmlReceipt', env);
            } else {
                receipt = qweb.render('xml_receipt_not_show_price', env);
            }
            this.pos.proxy.print_receipt(receipt);
            this.pos.get_order()._printed = true;
        },
        print: function () {
            var self = this;

            if (!this.pos.config.iface_print_via_proxy) { // browser (html) printing
                this.lock_screen(true);
                setTimeout(function () {
                    self.lock_screen(false);
                }, 1000);
                this.print_web();
            } else {    // proxy (xml) printing
                this.print_xml();
                this.lock_screen(false);
            }
        },

        click_back: function () {
            this.pos.gui.show_screen('products')
        },
        renderElement: function () {
            var self = this;
            this._super();
            this.$('.back').click(function () {
                if (!self._locked) {
                    self.click_back();
                }
            });
            this.$('.button.print').click(function () {
                if (!self._locked) {
                    self.print();
                }
            });
        },
        render_change: function () {
            this.$('.change-value').html(this.format_currency(this.pos.get_order().get_change()));
        },
        render_receipt: function () {
            this.$('.pos-receipt-container').html(qweb.render('pos_ticket_review', this.get_receipt_render_env()));
        }
    });

    gui.define_screen({name: 'receipt_review', widget: receipt_review});

    return {
        login_page: login_page
    };


});
