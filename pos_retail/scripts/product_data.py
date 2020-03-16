import xmlrpclib
import json
import time
import logging

__logger = logging.getLogger(__name__)

start_time = time.time()

database = 'v11_pos_retail'
login = 'admin'
password = 'admin'
url = 'http://localhost:8069'

common = xmlrpclib.ServerProxy('{}/xmlrpc/2/common'.format(url))
uid = common.authenticate(database, login, password, {})

models = xmlrpclib.ServerProxy(url + '/xmlrpc/object')

with open("img.png", "rb") as f:
    data = f.read()
    for i in range(0, 21400):
        vals = {
            'list_price': 10.0,
            'description': u'description',
            'display_name': 'Product Example - %s' % str(i),
            'name': 'Product : %s' % str(i),
            'pos_categ_id': 1,
            'to_weight': u'True',
            'image': data.encode("base64")
        }
        models.execute_kw(database, uid, password, 'product.product', 'create', [vals])
        __logger.info('created: %s' % i)
