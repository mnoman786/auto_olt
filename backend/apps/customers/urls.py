from django.urls import path
from . import views

urlpatterns = [
    path('customers/', views.customer_list, name='customer-list'),
    path('customers/<int:pk>/', views.customer_detail, name='customer-detail'),
    path('customers/import/', views.customer_import_csv, name='customer-import'),
    path('customers/<int:pk>/pppoe-retry/', views.customer_pppoe_retry, name='customer-pppoe-retry'),
]
