import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'auto_olt.settings')

django_asgi_app = get_asgi_application()

from apps.notifications import routing  # noqa: E402 — import after django setup

application = ProtocolTypeRouter({
    'http': django_asgi_app,
    'websocket': AllowedHostsOriginValidator(
        URLRouter(routing.websocket_urlpatterns)
    ),
})
