# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
import pdb

class pos_product_prop(models.Model):
	_name = "pos.product.prop"

	@api.one
	@api.depends('price_cost_include', 'prop_line','prop_line.standard_price')
	def _compute_price(self):
		h = m = a = c = 0		
		
		for line in self.prop_line:			
			c += 1
			a += line.standard_price
			
			if line.standard_price < m or m == 0:
				m = line.standard_price
			if line.standard_price > h or h == 0:
				h = line.standard_price
		
		if 	self.price_cost_include == 'n':
			self.price = 0
		elif self.price_cost_include == 'm':
			self.price = m
		elif self.price_cost_include == 'h':
			self.price = h
		elif self.price_cost_include == 'a':
			self.price = a * 1.0 / c
			
		
	#@api.multi
	#def write(self, vals):
	#	#h = m = a = c = 0		
	#	#
	#	#for line in self.prop_line:			
	#	#	c += 1
	#	#	a += line.standard_price
	#	#	
	#	#	if line.standard_price < m or m == 0:
	#	#		m = line.standard_price
	#	#	if line.standard_price > h or h == 0:
	#	#		h = line.standard_price
	#	#
	#	#if 	self.price_cost_include == 'n':
	#	#	vals['price'] = 0
	#	#elif self.price_cost_include == 'm':
	#	#	vals['price'] = m
	#	#elif self.price_cost_include == 'h':
	#	#	vals['price'] = h
	#	#elif self.price_cost_include == 'a':
	#	#	vals['price'] = a * 1.0 / c
	#	
	#	res = super(pos_product_prop,self).write(vals)		
	#	for product in self:
	#		if product.product_tmpl_id:			
	#			bom = self.env['mrp.bom'].search([('product_tmpl_id','=',product.product_tmpl_id.id)])
	#			bom.write({'code':'123'})	
                
	
				   
	name = fields.Char('Prop Note', required=1)
	multi_selection = fields.Boolean('Multi Selection')    
	prop_line = fields.Many2many('pos.product.prop.line',string='Options')
	default_line = fields.Many2one('pos.product.prop.line','Default Option')
	product_tmpl_id = fields.Many2one('product.template', 'Product', required=1)
	price = fields.Float('Price',compute='_compute_price', store=True)
	price_cost_include = fields.Selection([('n','No'),('h','Highest'),('l','Low'),('a','Average')],default='n')
	dummy = fields.Datetime()

class pos_product_prop_line(models.Model):
	_name = "pos.product.prop.line"

	prop_ids = fields.Many2many('pos.product.prop',string='Prop Notes')
	name = fields.Char('Name')
	price = fields.Float('Price')
	rm_product_tmpl_id = fields.Many2one('product.template', 'RM Product')
	standard_price = fields.Float(string='Cost Price', related='rm_product_tmpl_id.standard_price',store=True)
	description = fields.Text('Description')
	
	@api.multi
	def write(self, vals):
		res = super(pos_product_prop_line,self).write(vals)		
		h = m = a = c = 0		
		
		for prop in self.prop_ids:	
			for line in prop.prop_line:			
				c += 1
				a += line.standard_price
				
				if line.standard_price < m or m == 0:
					m = line.standard_price
				if line.standard_price > h or h == 0:
					h = line.standard_price
			
			if 	prop.price_cost_include == 'n':
				prop.price = 0
			elif prop.price_cost_include == 'm':
				prop.price = m
			elif prop.price_cost_include == 'h':
				prop.price = h
			elif prop.price_cost_include == 'a':
				prop.price = a * 1.0 / c
				
				
				
				
				
				
				
