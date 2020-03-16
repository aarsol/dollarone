import xmlrpclib
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
    for i in range(0, 100000):
        vals = {
            'phone': u'False',
            'street': u'89 Lingfield Tower',
            'city': u'Ho Chi Minh',
            'name': 'Customer - %s' % str(i),
            'zip': u'False',
            'mobile': u'0902403918',
            'country_id': 233,
            'state_id': False,
            'email': u'thanhchatvn@gmail.com',
            'vat': u'False',
            'image': data.encode("base64")
        }
        models.execute_kw(database, uid, password, 'res.partner', 'create', [vals])
        __logger.info('created: %s' % i)


