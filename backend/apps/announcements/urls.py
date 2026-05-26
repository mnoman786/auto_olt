from django.urls import path
from . import views

urlpatterns = [
    path('', views.AnnouncementListCreateView.as_view(), name='announcement-list'),
    path('<int:pk>/', views.AnnouncementDetailView.as_view(), name='announcement-detail'),
]
