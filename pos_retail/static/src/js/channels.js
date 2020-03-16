odoo.define('pos_retail.pos_chanel', function (require) {
    var models = require('point_of_sale.models');
    var rpc = require('web.rpc');
    var exports = {};
    var Backbone = window.Backbone;
    var bus = require('bus.bus');
    var core = require('web.core');
    var _t = core._t;

    exports.pos_stock_syncing = Backbone.Model.extend({ // chanel 1: pos.stock.update
        initialize: function (pos) {
            this.pos = pos;
        },
        start: function () {
            this.bus = bus.bus;
            this.bus.last = this.pos.db.load('bus_last', 0);
            this.bus.on("notification", this, this.on_notification);
            this.bus.start_polling();
        },
        on_notification: function (notification) {
            if (notification && notification[0] && notification[0][0] && typeof notification[0][0] === 'string') {
                notification = [notification]
            }
            if (notification.length) {
                for (var i = 0; i < notification.length; i++) {
                    var channel = notification[i][0];
                    var messages = notification[i][1];
                    this.on_notification_do(channel, messages);
                }
            }
        },
        on_notification_do: function (channel, messages) {
            if (Array.isArray(channel) && channel[1] === 'pos.stock.update') {
                this.pos.update_stock(messages)
            }
            this.pos.db.save('bus_last', this.bus.last)
        }
    });

    exports.sync_backend = Backbone.Model.extend({ // chanel 2: pos sync backend
        initialize: function (pos) {
            this.pos = pos;
        },
        start: function () {
            this.bus = bus.bus;
            this.bus.last = this.pos.db.load('bus_last', 0);
            this.bus.on("notification", this, this.on_notification);
            this.bus.start_polling();
        },
        on_notification: function (notifications) {
            if (notifications && notifications[0] && notifications[0][1]) {
                for (var i = 0; i < notifications.length; i++) {
                    var channel = notifications[i][0][1];
                    if (channel == 'pos.sync.data') {
                        this.on_notification_do(notifications[i][1]);
                    }
                }
            }
        },
        on_notification_do: function (datas) {
            var model = datas['model'];
            console.log('{sync} ' + model);
            if (model == 'product.product') {
                this.pos.syncing_product(datas)
            }
            if (model == 'res.partner') {
                this.pos.syncing_partner(datas)
            }
            if (model == 'account.invoice' && this.pos.config.management_invoice) {
                this.pos.db.save_data_sync_invoice(datas);
                this.pos.trigger('update:invoice');
            }
            if (model == 'pos.order' && this.pos.config.management_invoice) {
                this.pos.db.save_data_sync_order(datas);
                this.pos.trigger('update:order');
            }
            if (model == 'pos.order.line' && this.pos.config.management_invoice) {
                this.pos.db.save_data_sync_order_line(datas);
            }
            if (model == 'product.pricelist' && this.pos.config.sync_pricelist == true) {
                this.pos.syncing_pricelist(datas)
            }
            if (model == 'product.pricelist.item' && this.pos.config.sync_pricelist == true) {
                this.pos.syncing_pricelist_item(datas)
            }
            if (model == 'sale.order' && this.pos.config.sync_sale_order == true) {
                this.pos.db.sync_sale_order(datas);
                this.pos.trigger('sync:sale_orders', datas['id']);
            }
        }
    });

    var _super_posmodel = models.PosModel.prototype;
    models.PosModel = models.PosModel.extend({
        load_server_data: function () {
            var self = this;
            // create variable for loaded can load this variable
            // this.products = [];
            return _super_posmodel.load_server_data.apply(this, arguments).then(function () {
                self.chrome.loading_message(_t('Active sync between backend to pos'), 1);
                self.sync_backend = new exports.sync_backend(self);
                self.sync_backend.start();
                self.chrome.loading_message(_t('Active sync between stock backend to pos'), 1);
                self.pos_stock_syncing = new exports.pos_stock_syncing(self);
                self.pos_stock_syncing.start();
            }).done(function () {
                console.log('load_server_data DONE');
            })
        }
    });
    return exports;
});
