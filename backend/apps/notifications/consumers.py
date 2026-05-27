import json
from typing import Optional
from urllib.parse import parse_qs
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async


def _cookie_from_scope(scope: dict, name: str) -> Optional[str]:
    """Extract a single cookie value from the ASGI scope headers."""
    for key, value in scope.get('headers', []):
        if key == b'cookie':
            for part in value.decode('latin-1').split(';'):
                k, _, v = part.strip().partition('=')
                if k.strip() == name:
                    return v.strip()
    return None


class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Prefer HttpOnly cookie; fall back to ?token= query param for backwards compat
        token = _cookie_from_scope(self.scope, 'access_token')
        if not token:
            qs = parse_qs(self.scope['query_string'].decode())
            token = qs.get('token', [None])[0]

        user = await self.get_user_from_token(token)
        if user is None:
            await self.close()
            return
        self.group_name = f'user_{user.id}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        pass  # no client → server messages needed

    async def notification_message(self, event):
        await self.send(text_data=json.dumps(event['data']))

    @database_sync_to_async
    def get_user_from_token(self, token):
        if not token:
            return None
        try:
            from rest_framework_simplejwt.tokens import AccessToken
            from django.contrib.auth import get_user_model
            access = AccessToken(token)
            return get_user_model().objects.get(id=access['user_id'])
        except Exception:
            return None
