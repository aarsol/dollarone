# -*- coding: utf-8 -*-
from odoo import models, fields, api, _

class pos_note(models.Model):
    _name = "pos.note"

    name = fields.Text('Note', required=1)
    

