"""
Encrypted model field for storing sensitive credentials in the database.

Values are encrypted with Fernet (AES-128-CBC + HMAC-SHA256) before being
written to the DB and decrypted transparently on read.  The key is derived
from FIELD_ENCRYPTION_KEY in settings (a Fernet key string), falling back to a
SHA-256 digest of SECRET_KEY so the app works without extra configuration.

Generating a dedicated key (recommended for production):
    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
Then set FIELD_ENCRYPTION_KEY=<output> in backend/.env
"""
import base64
import hashlib
import warnings

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.db import models

_ENCRYPTED_PREFIX = 'enc:'


def _get_fernet() -> Fernet:
    raw_key = getattr(settings, 'FIELD_ENCRYPTION_KEY', '') or ''
    if raw_key:
        key = raw_key.encode()
    else:
        # Deriving from SECRET_KEY means a leaked SECRET_KEY also exposes all
        # encrypted OLT credentials. Set FIELD_ENCRYPTION_KEY in .env for production.
        if not getattr(settings, 'DEBUG', True):
            warnings.warn(
                'FIELD_ENCRYPTION_KEY is not set. Encrypted fields are using a key '
                'derived from SECRET_KEY. Generate a dedicated key: '
                'python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"',
                stacklevel=2,
            )
        key = base64.urlsafe_b64encode(
            hashlib.sha256(settings.SECRET_KEY.encode()).digest()
        )
    return Fernet(key)


class EncryptedCharField(models.CharField):
    """CharField that transparently encrypts/decrypts its value."""

    def from_db_value(self, value, expression, connection):
        if not value or not value.startswith(_ENCRYPTED_PREFIX):
            return value  # plaintext or empty — return as-is (handles legacy rows)
        try:
            return _get_fernet().decrypt(value[len(_ENCRYPTED_PREFIX):].encode()).decode()
        except (InvalidToken, Exception):
            return value  # return raw if decryption fails rather than crashing

    def get_prep_value(self, value):
        if not value:
            return value
        if value.startswith(_ENCRYPTED_PREFIX):
            return value  # already encrypted (e.g. re-saving unchanged instance)
        return _ENCRYPTED_PREFIX + _get_fernet().encrypt(value.encode()).decode()

    def deconstruct(self):
        name, path, args, kwargs = super().deconstruct()
        # Report as plain CharField so Django doesn't store the custom class
        # in old migrations — avoids import errors if the field is later removed.
        path = 'django.db.models.CharField'
        return name, path, args, kwargs
