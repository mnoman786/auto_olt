from django.urls import path
from . import views

urlpatterns = [
    path('notifications/', views.NotificationListView.as_view(), name='notification-list'),
    path('notifications/mark-all-read/', views.mark_all_read, name='notification-mark-all-read'),
    path('notifications/<int:pk>/read/', views.mark_read, name='notification-mark-read'),
]
