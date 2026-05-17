from django.urls import path
from . import views

urlpatterns = [
    path('olts/', views.OLTListCreateView.as_view(), name='olt-list-create'),
    path('olts/<int:pk>/', views.OLTDetailView.as_view(), name='olt-detail'),
    path('olts/<int:pk>/setup/', views.trigger_setup, name='olt-setup'),
    path('olts/<int:pk>/setup/logs/', views.setup_logs, name='olt-setup-logs'),
    path('olts/<int:pk>/poll/', views.poll_olt, name='olt-poll'),
    path('olts/<int:pk>/stats/', views.olt_stats, name='olt-stats'),
    path('olts/<int:pk>/ports/', views.olt_ports, name='olt-ports'),
    path('olts/<int:pk>/test-snmp/', views.test_snmp, name='olt-test-snmp'),
    path('olts/<int:pk>/wireguard/', views.wg_info, name='olt-wg-info'),
    path('olts/<int:pk>/profiles/sync/', views.sync_profiles, name='olt-profiles-sync'),
]
