import hashlib
import hmac
import time

from django.conf import settings


class HMACSigningMiddleware:
    """
    Signs every JSON API response with HMAC-SHA256 so clients can detect
    tampering by intermediaries (CDN, proxy, etc.).

    Headers added to each response:
        X-Timestamp : Unix epoch seconds (int) when the response was signed
        X-Signature : sha256=<hex>  — HMAC-SHA256(secret, "{timestamp}:{body}")
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # Only sign JSON responses on /api/ paths
        if not request.path.startswith('/api/'):
            return response
        if 'application/json' not in response.get('Content-Type', ''):
            return response

        secret = getattr(settings, 'HMAC_SECRET', '').encode('utf-8')
        if not secret:
            return response

        timestamp = str(int(time.time()))
        message = f'{timestamp}:'.encode() + response.content
        sig = hmac.new(secret, message, hashlib.sha256).hexdigest()

        response['X-Timestamp'] = timestamp
        response['X-Signature'] = f'sha256={sig}'
        return response
