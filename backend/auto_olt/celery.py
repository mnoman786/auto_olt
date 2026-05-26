import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'auto_olt.settings')

app = Celery('auto_olt')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()
app.conf.include = ['tasks']
