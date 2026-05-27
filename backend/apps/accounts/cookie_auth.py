from django.conf import settings
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework.response import Response

ACCESS_COOKIE = 'access_token'
REFRESH_COOKIE = 'refresh_token'
REFRESH_COOKIE_PATH = '/api/auth/token/refresh/'


def _set_token_cookies(response: Response, access_token: str, refresh_token: str = None) -> None:
    secure = not settings.DEBUG
    common = dict(httponly=True, samesite='Lax', secure=secure)
    response.set_cookie(
        ACCESS_COOKIE,
        access_token,
        max_age=int(settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds()),
        path='/',
        **common,
    )
    if refresh_token is not None:
        response.set_cookie(
            REFRESH_COOKIE,
            refresh_token,
            max_age=int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds()),
            path=REFRESH_COOKIE_PATH,
            **common,
        )


def _clear_token_cookies(response: Response) -> None:
    response.delete_cookie(ACCESS_COOKIE, path='/')
    response.delete_cookie(REFRESH_COOKIE, path=REFRESH_COOKIE_PATH)


class JWTCookieAuthentication(JWTAuthentication):
    """Reads JWT access token from HttpOnly cookie."""

    def get_header(self, request):
        return None

    def authenticate(self, request):
        raw_token = request.COOKIES.get(ACCESS_COOKIE)
        if raw_token is None:
            return None
        try:
            validated = self.get_validated_token(raw_token.encode())
            return self.get_user(validated), validated
        except InvalidToken:
            return None
