from django.urls import path
from . import views

urlpatterns = [
    path('olts/<int:olt_pk>/vlans/', views.VLANListCreateView.as_view(), name='vlan-list-create'),
    path('olts/<int:olt_pk>/vlans/<int:pk>/', views.VLANDetailView.as_view(), name='vlan-detail'),
]
