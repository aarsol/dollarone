# -*- coding: utf-8 -*-
from odoo.exceptions import UserError, ValidationError
from odoo import api, fields, models, _


class InheritPointOfSale(models.TransientModel):
	_name = "pos.shortcut"

	payment = fields.Char(size=1, required=True, default='p')
	select_customer = fields.Char(size=1, string="Select Customer", required=True, default='y')
	qty = fields.Char(size=1, required=True, default='q')
	disc = fields.Char(size=1, required=True, default='d')
	price = fields.Char(size=1, required=True, default='p')
	
	invoice = fields.Char(size=1, required=True, default='i')
	
	lock_session = fields.Char(size=1, required=True, default='l')
	lock_screen = fields.Char(size=1, required=True, default='k')
	
	global_discount = fields.Char(size=1, help='If global discount is enabled it will work', string='Global Discount', required=True, default='g')
	direct_discount = fields.Char(size=1, help='If direct discount is enabled it will work', string='Direct Discount', required=True, default='t')

	order_note = fields.Char(size=1, required=True, default='n')
	line_note = fields.Char(size=1, required=True, default='m')
	
	return_order = fields.Char(size=1, required=True, default='r')
	products = fields.Char(size=1, required=True, default='u')
	return_products = fields.Char(size=1, required=True, default='z')
	clean_order = fields.Char(size=1, required=True, default='x')
	
	order_signature = fields.Char(size=1, required=True, default='s')
	daily_report = fields.Char(size=1, required=True, default='w')
	promotions = fields.Char(size=1, required=True, default='a')
	
	booking = fields.Char(size=1, required=True, default='b')
	booked = fields.Char(size=1, required=True, default='o')
	delivery = fields.Char(size=1, required=True, default='y')
	unlock = fields.Char(size=1, required=True, default='u')
	internal = fields.Char(size=1, required=True, default='i')
	voucher = fields.Char(size=1, required=True, default='v')
	invoices = fields.Char(size=1, required=True, default='e')
	
	
	@api.multi
	def print_report(self):
		return self.env.ref('pierce_pos_keyboard_shortcuts.pos_config_report_shortcuts').report_action(self)

	@api.multi
	def write(self, vals):
		lst = []
		for key, value in vals.items():
			if value in lst:
				raise Warning(_('Same char is not allowed'))
				return False
			else:
				if value:
					if value.isalpha() != True:
						raise Warning(_('Only char is allowed'))
						return False
					else:
						lst.append(value)

		return super(InheritPointOfSale, self).write(vals)

	@api.model
	def create(self, vals):
		existingRecords = self.env["pos.shortcut"].search([])
		existingRecordCount = len(existingRecords)
		if (existingRecordCount == 0):
			new_record = super(InheritPointOfSale, self).create(vals)
			return new_record
		else:
			current_settings_object = self.get_existing_settings_object()
			if current_settings_object:
				exclude = current_settings_object
				exclude.write(vals)
		return existingRecords[0]

	def get_existing_settings_object(self):
		settings_object = None;
		settings_objects = self.env["pos.shortcut"].search([])
		if (len(settings_objects) > 0):  # Making sure that one settings object exist
			settings_object = settings_objects[0]
		return settings_object

	@api.multi
	def execute(self):
		return {
		    'type': 'ir.actions.client',
		    'tag': 'reload',
		}

	'''Get the value form database and send to the js file'''
	@api.model
	def keys(self, fields):
		pos_configration_obj = self.env['pos.shortcut']		
		result_dic = {}
		sco_search_list = pos_configration_obj.search([])

		if (len(sco_search_list) > 0):
			sco_obj_list = pos_configration_obj.browse(sco_search_list[0].id)
			if (len(sco_obj_list) > 0):
				sco_obj = sco_obj_list[0]
								
				result_dic['customer'] = sco_obj.select_customer.upper() or 'C'
				result_dic['price'] = sco_obj.price.upper() or 'P'
				result_dic['disc'] = sco_obj.disc.upper() or 'D'
				result_dic['qty'] = sco_obj.qty.upper()  or 'Q'
				
				result_dic['invoice'] = sco_obj.invoice.upper() or 'I'
				
				result_dic['lock_session'] = sco_obj.lock_session.upper() or 'L'
				result_dic['lock_screen'] = sco_obj.lock_screen.upper() or 'K'
				
				result_dic['direct_discount'] = sco_obj.direcr_discount.upper() or 'T'
				result_dic['global_discount'] = sco_obj.global_discount.upper() or 'G'				
		
				result_dic['order_note'] = sco_obj.order_note.upper() or 'N'
				result_dic['line_note'] = sco_obj.line_note.upper() or 'M'
				
				result_dic['return_order'] = sco_obj.return_order.upper() or 'R'
				result_dic['products'] = sco_obj.products.upper() or 'U'
				
				result_dic['clean_order'] = sco_obj.clean_order.upper() or 'X'
				result_dic['return_products'] = sco_obj.return_products.upper() or 'Z'	
				
				result_dic['order_signature'] = sco_obj.order_signature.upper() or 'S'
				result_dic['daily_report'] = sco_obj.daily_report.upper() or 'W'
				result_dic['promotions'] = sco_obj.promotions.upper() or 'A'
				
				result_dic['booking'] = sco_obj.booking.upper() or 'B'
				result_dic['booked'] = sco_obj.booked.upper() or 'O'
				result_dic['delivery'] = sco_obj.delivery.upper() or 'Y'
				result_dic['unlock'] = sco_obj.unlock.upper() or 'U'
				result_dic['internal'] = sco_obj.internal.upper() or 'I'
				result_dic['voucher'] = sco_obj.voucher.upper() or 'V'
				result_dic['invoices'] = sco_obj.voucher.upper() or 'E'
		
		else:			
			result_dic['customer'] = 'C'
			result_dic['price'] = 'P'
			result_dic['disc'] = 'D'
			result_dic['qty'] = 'Q'
			
			result_dic['invoice'] = 'I'
			
			result_dic['lock_session'] = 'L'
			result_dic['lock_screen'] = 'K'
				
			result_dic['direct_discount'] = 'T'
			result_dic['global_discount'] = 'G'
			
			result_dic['order_note'] = 'N'
			result_dic['line_note'] = 'M'
			
			result_dic['return_order'] = 'R'
			result_dic['products'] = 'U'
			
			result_dic['clean_order'] = 'X'
			result_dic['return_products'] = 'Z'
			
			result_dic['order_signature'] = 'S'
			result_dic['daily_report'] = 'W'
			result_dic['promotions'] = 'A'
			
			result_dic['booking'] = 'B'
			result_dic['booked'] = 'O'
			result_dic['delivery'] = 'Y'
			result_dic['unlock'] = 'U'
			result_dic['internal'] = 'I'
			result_dic['voucher'] = 'V'
			result_dic['invoices'] = 'E'
			
		return result_dic
		
	@api.model
	def paymentscreen(self, fields):
		pos_configration_obj = self.env['pos.shortcut']		
		result_dic = {}
		sco_search_list = pos_configration_obj.search([])

		if (len(sco_search_list) > 0):
			sco_obj_list = pos_configration_obj.browse(sco_search_list[0].id)
			if (len(sco_obj_list) > 0):
				sco_obj = sco_obj_list[0]
								
				result_dic['customer'] = ord(sco_obj.select_customer) if sco_obj.select_customer else ord('c')
				result_dic['price'] = ord(sco_obj.price) if sco_obj.price else ord('p')
				result_dic['disc'] = ord(sco_obj.disc) if sco_obj.disc else ord('d')
				result_dic['qty'] = ord(sco_obj.qty) if sco_obj.qty else ord('q')
				
				result_dic['invoice'] = ord(sco_obj.invoice) if sco_obj.invoice else ord('i')
				
				result_dic['lock_session'] = ord(sco_obj.lock_session) if sco_obj.lock_session else ord('l')
				result_dic['lock_screen'] = ord(sco_obj.lock_screen) if sco_obj.lock_screen else ord('k')	
				
				result_dic['direct_discount'] = ord(sco_obj.direct_discount) if sco_obj.direcr_discount else ord('t')
				result_dic['global_discount'] = ord(sco_obj.global_discount) if sco_obj.global_discount else ord('g')			
		
				result_dic['order_note'] = ord(sco_obj.order_note) if sco_obj.order_note else ord('n')
				result_dic['line_note'] = ord(sco_obj.line_note) if sco_obj.line_note else ord('m')	
				
				result_dic['return_order'] = ord(sco_obj.return_order) if sco_obj.return_order else ord('r')
				result_dic['products'] = ord(sco_obj.products) if sco_obj.products else ord('u')
				
				result_dic['clean_order'] = ord(sco_obj.clean_order) if sco_obj.clean_order else ord('x')
				result_dic['return_products'] = ord(sco_obj.return_products) if sco_obj.return_products else ord('z')
				
				result_dic['order_signature'] = ord(sco_obj.order_signature) if sco_obj.order_signature else ord('s')
				result_dic['daily_report'] = ord(sco_obj.daily_report) if sco_obj.daily_report else ord('w')
				result_dic['promotions'] = ord(sco_obj.promotions) if sco_obj.promotions else ord('a')
				
				result_dic['booking'] = ord(sco_obj.booking) if sco_obj.booking else ord('b')
				result_dic['booked'] = ord(sco_obj.booked) if sco_obj.booked else ord('o')
				result_dic['delivery'] = ord(sco_obj.delivery) if sco_obj.delivery else ord('y')		
				result_dic['unlock'] = ord(sco_obj.unlock) if sco_obj.unlock else ord('u')
				result_dic['internal'] = ord(sco_obj.internal) if sco_obj.internal else ord('i')
				result_dic['voucher'] = ord(sco_obj.voucher) if sco_obj.voucher else ord('v')										
				result_dic['invoices'] = ord(sco_obj.invoices) if sco_obj.invoices else ord('e')
					
		else:			
			result_dic['customer'] = ord('c')
			result_dic['price'] = ord('p')
			result_dic['disc'] = ord('d')
			result_dic['qty'] = ord('q')
			
			result_dic['invoice'] = ord('i')
			
			result_dic['lock_session'] = ord('l')
			result_dic['lock_screen'] = ord('k')
			
			result_dic['direct_discount'] = ord('t')
			result_dic['global_discount'] = ord('g')
			
			result_dic['order_note'] = ord('n')
			result_dic['line_note'] = ord('m')
			
			result_dic['return_order'] = ord('r')
			result_dic['products'] = ord('u')
			
			result_dic['clean_order'] = ord('x')
			result_dic['return_products'] = ord('z')
			
			result_dic['order_signature'] = ord('s')
			result_dic['daily_report'] = ord('w')
			result_dic['promotions'] = ord('a')
			
			result_dic['booking'] = ord('b')
			result_dic['booked'] = ord('o')
			result_dic['delivery'] = ord('y')		
			result_dic['unlock'] = ord('u')
			result_dic['internal'] = ord('i')
			result_dic['voucher'] = ord('v')										
			result_dic['invoices'] = ord('e')
			
		return result_dic

	@api.model
	def default_get(self, fields):
		res = super(InheritPointOfSale, self).default_get(fields)
		global_search_config = self.env['pos.shortcut'].search([])
		for so in global_search_config:
		    if so.select_customer or so.qty or so.price or so.total_discount:		        
		        res.update({'select_customer': so.select_customer})
		        res.update({'qty': so.qty})
		        res.update({'disc': so.disc})
		        res.update({'price': so.price})
		        res.update({'total_discount': so.total_discount})
		        res.update({'invoice': so.invoice})
		return res
