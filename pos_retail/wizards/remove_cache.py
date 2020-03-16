# -*- coding: utf-8 -*-

from odoo import api, fields, models
import json
import ast
import logging


_logger = logging.getLogger(__name__)

class pos_remove_cache(models.TransientModel):
    _name = 'pos.remove.cache'

    @api.multi
    def remove_cache(self):
        _logger.info('{remove_cache} start')
        self.env['pos.cache.database'].search([]).unlink()
        modules = [
            'product.product',
            'res.partner',
            'account.invoice',
            'pos.order',
            'pos.order.line',
            'product.pricelist',
            'product.pricelist.item',
            'sale.order',
        ]
        for module in modules:
            params = self.env['ir.config_parameter'].sudo().get_param(module)
            if params:
                params = ast.literal_eval(params)
                _logger.info('{remove_cache} module %s' % module)
                records = self.env[module].search(params.get('domain', [])).with_context(params.get('context', {}))
                for record in records:
                    record.sync()
            else:
                _logger.error('{params} null')
        _logger.info('{remove_cache} end')
        return True
