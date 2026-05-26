from django.conf import settings
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path(settings.ADMIN_URL, admin.site.urls),
    path('api/auth/', include('apps.accounts.urls')),
    path('api/', include('apps.olts.urls')),
    path('api/', include('apps.onus.urls')),
    path('api/', include('apps.vlans.urls')),
    path('api/', include('apps.tickets.urls')),
    path('api/', include('apps.alerts.urls')),
    path('api/announcements/', include('apps.announcements.urls')),
]
