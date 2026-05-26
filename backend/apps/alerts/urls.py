from django.urls import path
from . import views

urlpatterns = [
    path('alerts/rules/', views.alert_rules, name='alert-rules'),
    path('alerts/rules/<int:pk>/', views.alert_rule_detail, name='alert-rule-detail'),
    path('alerts/events/', views.alert_events, name='alert-events'),
]
