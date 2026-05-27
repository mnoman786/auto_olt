"""
Django settings for auto_olt project.
"""
from pathlib import Path
from datetime import timedelta
from decouple import config
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = config('SECRET_KEY')  # No fallback — app will not start without this set in .env
DEBUG = config('DEBUG', default=False, cast=bool)
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1').split(',')

INSTALLED_APPS = [
    'daphne',  # must be before django.contrib.staticfiles
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third party
    'rest_framework',
    'channels',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    # Local apps
    'apps.accounts',
    'apps.olts',
    'apps.onus',
    'apps.vlans',
    'apps.tickets',
    'apps.alerts',
    'apps.plans',
    'apps.announcements',
    'apps.notifications',
]

MIDDLEWARE = [
    'django.middleware.gzip.GZipMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'utils.security_headers.SecurityHeadersMiddleware',
    'utils.hmac_signing.HMACSigningMiddleware',
]

ROOT_URLCONF = 'auto_olt.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'auto_olt.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

# Cache — Redis (same instance as Celery broker, different DB index)
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': config('REDIS_CACHE_URL', default='redis://127.0.0.1:6379/1'),
        'OPTIONS': {},
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

AUTH_USER_MODEL = 'accounts.User'

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'apps.accounts.cookie_auth.JWTCookieAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '30/minute',
        'user': '3000/minute',
        'auth_login': '20/minute',
        'auth_register': '3/minute',
        'forgot_password': '3/minute',
        'otp_verify': '10/hour',
        'resend_otp': '3/hour',
        'olt_setup': '10/hour',
        'olt_poll': '30/hour',
    },
}

# JWT
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=config('JWT_ACCESS_TOKEN_LIFETIME_MINUTES', default=15, cast=int)),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=config('JWT_REFRESH_TOKEN_LIFETIME_DAYS', default=7, cast=int)),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
}

# CORS — never open by default; set CORS_ALLOW_ALL_ORIGINS=True only in local dev via .env
CORS_ALLOW_ALL_ORIGINS = config('CORS_ALLOW_ALL_ORIGINS', default=False, cast=bool)
CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    default='http://localhost:3000,http://localhost:6000,http://127.0.0.1:3000'
).split(',')
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]
CORS_ALLOW_METHODS = ['DELETE', 'GET', 'OPTIONS', 'PATCH', 'POST', 'PUT']

# Email / SMTP
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = config('EMAIL_HOST', default='smtp.gmail.com')
EMAIL_PORT = config('EMAIL_PORT', default=587, cast=int)
EMAIL_USE_TLS = config('EMAIL_USE_TLS', default=True, cast=bool)
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='Auto OLT <noreply@autoolt.com>')

# OTP
OTP_EXPIRY_MINUTES = config('OTP_EXPIRY_MINUTES', default=10, cast=int)

# Site URL for email links
SITE_URL = config('SITE_URL', default='http://localhost:3000')

# WireGuard
WG_INTERFACE = config('WG_INTERFACE', default='wg0')
# WG_ENDPOINT must be the public server IP and UDP port (e.g. "203.0.113.10:51820").
# If unset, the app will derive it from ALLOWED_HOSTS but warn loudly in get_wg_info.
WG_ENDPOINT = config('WG_ENDPOINT', default='')
WG_SERVER_PUBLIC_KEY = config('WG_SERVER_PUBLIC_KEY', default='')

# ONU provisioning (Telnet-only — SNMP/hybrid path was removed)
DEFAULT_TELNET_USERNAME = config('DEFAULT_TELNET_USERNAME', default='')
DEFAULT_TELNET_PASSWORD = config('DEFAULT_TELNET_PASSWORD', default='')
DEFAULT_TELNET_PORT = config('DEFAULT_TELNET_PORT', default=23, cast=int)
OLT_MGMT_USER = config('OLT_MGMT_USER', default='')
OLT_MGMT_PASSWORD = config('OLT_MGMT_PASSWORD', default='')
OLT_MGMT_PRIVILEGE = config('OLT_MGMT_PRIVILEGE', default=15, cast=int)

# Enforce that production credentials are explicitly set in .env
if not DEBUG:
    _required_credentials = {
        'DEFAULT_TELNET_USERNAME': DEFAULT_TELNET_USERNAME,
        'DEFAULT_TELNET_PASSWORD': DEFAULT_TELNET_PASSWORD,
        'OLT_MGMT_USER': OLT_MGMT_USER,
        'OLT_MGMT_PASSWORD': OLT_MGMT_PASSWORD,
    }
    _missing = [k for k, v in _required_credentials.items() if not v]
    if _missing:
        raise ImproperlyConfigured(
            f"The following credentials must be set in .env for production: {', '.join(_missing)}"
        )

# Registration — set to True in .env only when you want to allow new sign-ups
REGISTRATION_OPEN = config('REGISTRATION_OPEN', default=False, cast=bool)
HMAC_SECRET = config('HMAC_SECRET', default='')
ADMIN_URL = config('ADMIN_URL', default='admin/')

# HTTPS security — must be True in production behind SSL
SECURE_SSL_REDIRECT = config('SECURE_SSL_REDIRECT', default=False, cast=bool)
SESSION_COOKIE_SECURE = config('SESSION_COOKIE_SECURE', default=False, cast=bool)
CSRF_COOKIE_SECURE = config('CSRF_COOKIE_SECURE', default=False, cast=bool)

import warnings as _warnings
if not DEBUG and not SECURE_SSL_REDIRECT:
    _warnings.warn(
        'SECURE_SSL_REDIRECT is False in a non-DEBUG environment. '
        'Set SECURE_SSL_REDIRECT=True, SESSION_COOKIE_SECURE=True, and CSRF_COOKIE_SECURE=True in .env.',
        stacklevel=2,
    )

# Logging level
LOG_LEVEL = config('LOG_LEVEL', default='INFO')

# Encryption key for sensitive DB fields (OLT credentials).
# Must be a 32-byte url-safe base64 string (generate: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
# Falls back to a SHA-256 digest of SECRET_KEY if not set.
FIELD_ENCRYPTION_KEY = config('FIELD_ENCRYPTION_KEY', default='')

# Celery
ASGI_APPLICATION = 'auto_olt.asgi.application'

CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [config('REDIS_CHANNEL_URL', default='redis://127.0.0.1:6379/2')],
        },
    },
}

CELERY_BROKER_URL = config('CELERY_BROKER_URL', default='redis://localhost:6379/0')
CELERY_RESULT_BACKEND = config('CELERY_RESULT_BACKEND', default='redis://localhost:6379/0')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_TRACK_STARTED = True
CELERY_RESULT_EXPIRES = 3600  # purge task results from Redis after 1 hour

CELERY_BEAT_SCHEDULE = {
    'poll-bandwidth-every-5-min': {
        'task': 'tasks.dispatch_bandwidth_poll',
        'schedule': 300,  # seconds
    },
    'cleanup-old-logs-daily': {
        'task': 'tasks.cleanup_old_logs',
        'schedule': 86400,  # seconds
    },
}
# Hard kill a task after 10 minutes; soft limit warns at 8 minutes
CELERY_TASK_TIME_LIMIT = 600
CELERY_TASK_SOFT_TIME_LIMIT = 480
