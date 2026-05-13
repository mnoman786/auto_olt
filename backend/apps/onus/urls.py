from django.urls import path
from . import views

urlpatterns = [
    path('olts/<int:olt_pk>/onus/', views.ONUListView.as_view(), name='onu-list'),
    path('olts/<int:olt_pk>/onus/<int:pk>/', views.ONUDetailView.as_view(), name='onu-detail'),
    path('olts/<int:olt_pk>/onus/<int:pk>/register/', views.register_onu, name='onu-register'),
    path('olts/<int:olt_pk>/onus/<int:pk>/deregister/', views.deregister_onu, name='onu-deregister'),
    path('olts/<int:olt_pk>/onus/<int:pk>/logs/', views.onu_provisioning_logs, name='onu-logs'),
    path('olts/<int:olt_pk>/onus/bulk-register/', views.bulk_register_onus, name='onu-bulk-register'),
]
