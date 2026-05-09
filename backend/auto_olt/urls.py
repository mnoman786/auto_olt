from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.accounts.urls')),
    path('api/', include('apps.olts.urls')),
    path('api/', include('apps.onus.urls')),
    path('api/', include('apps.vlans.urls')),
]
