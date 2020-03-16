# -*- coding: utf-8 -*-
from odoo import api, fields, models, tools, _

class res_users(models.Model):
    _inherit = "res.users"

    pos_config_id = fields.Many2one('pos.config', 'Pos Config')
