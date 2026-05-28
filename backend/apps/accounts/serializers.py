import re
from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import User

# ── Allowed values for dropdown fields ───────────────────────────────────────
VALID_OLT_RANGES = {'1–5', '6–20', '21–50', '50+'}
VALID_HEARD_FROM = {'WhatsApp Group', 'Facebook', 'Friend / Referral', 'Google', 'Other'}

# ── Helpers ───────────────────────────────────────────────────────────────────

def _strip_html(value: str) -> str:
    """Remove all HTML/script tags and null bytes."""
    value = re.sub(r'<[^>]*>', '', value)   # strip tags
    value = value.replace('\x00', '')        # null bytes
    return value.strip()


def sanitize_text(value: str, max_length: int = 150) -> str:
    """Strip HTML, null bytes, trim whitespace, enforce max length."""
    return _strip_html(value)[:max_length]


def validate_phone(phone: str):
    """
    Returns an error string if invalid, None if valid.
    Accepts local (0300-1234567, 11 digits) and international (+92-300-1234567).
    """
    if not phone:
        return None
    # Only allow digits, dashes, spaces, parentheses, and a leading +
    if not re.match(r'^\+?[\d\s\-()]+$', phone):
        return 'Phone number contains invalid characters.'
    has_plus = phone.startswith('+')
    digits = re.sub(r'\D', '', phone)
    if has_plus:
        if not digits.startswith('92'):
            return 'International numbers must start with +92 (e.g. +92-300-1234567).'
        if len(digits) != 12:
            return 'International format: +92-300-1234567 (12 digits after +92).'
    else:
        if not digits.startswith('0'):
            return 'Local numbers must start with 0 (e.g. 0300-1234567).'
        if len(digits) != 11:
            return 'Local format: 0300-1234567 (11 digits total).'
    return None


def validate_password_strength(password: str) -> list:
    """Return a list of error strings, empty if password is acceptable."""
    errors = []
    if len(password) < 8:
        errors.append('Password must be at least 8 characters.')
    if not any(c.isupper() for c in password):
        errors.append('Password must contain at least one uppercase letter.')
    if not any(c.isdigit() for c in password):
        errors.append('Password must contain at least one number.')
    return errors


# ── Serializers ───────────────────────────────────────────────────────────────

class RegisterSerializer(serializers.ModelSerializer):
    password  = serializers.CharField(write_only=True, min_length=8, max_length=128)
    password2 = serializers.CharField(write_only=True, max_length=128)

    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'password2', 'company_name', 'phone', 'olt_count_range', 'heard_from')
        extra_kwargs = {
            'username':       {'max_length': 150},
            'email':          {'max_length': 254},
            'company_name':   {'max_length': 150, 'required': True, 'allow_blank': False},
            'phone':          {'max_length': 30,  'required': True, 'allow_blank': False},
            'olt_count_range':{'max_length': 20,  'required': True, 'allow_blank': False},
            'heard_from':     {'max_length': 50,  'required': True, 'allow_blank': False},
        }

    # ── Per-field sanitization ────────────────────────────────────────────────

    def validate_username(self, value):
        value = value.strip()
        if not re.match(r'^[\w.@+\-]+$', value):
            raise serializers.ValidationError('Username may only contain letters, digits, and @/./+/-/_.')
        return value

    def validate_email(self, value):
        return value.strip().lower()

    def validate_company_name(self, value):
        value = sanitize_text(value, max_length=150)
        if not value:
            raise serializers.ValidationError('Company name is required.')
        return value

    def validate_phone(self, value):
        value = value.strip()
        err = validate_phone(value)
        if err:
            raise serializers.ValidationError(err)
        return value

    def validate_olt_count_range(self, value):
        value = value.strip()
        if value not in VALID_OLT_RANGES:
            raise serializers.ValidationError('Invalid selection.')
        return value

    def validate_heard_from(self, value):
        value = value.strip()
        if value not in VALID_HEARD_FROM:
            raise serializers.ValidationError('Invalid selection.')
        return value

    # ── Cross-field validation ────────────────────────────────────────────────

    def validate(self, data):
        if User.objects.filter(username=data.get('username'), is_active=True).exists():
            raise serializers.ValidationError({'username': 'This username is already registered. Please sign in.'})
        if User.objects.filter(email=data.get('email'), is_active=True).exists():
            raise serializers.ValidationError({'email': 'This email is already registered. Please sign in.'})
        if data['password'] != data['password2']:
            raise serializers.ValidationError({'password': 'Passwords do not match.'})
        errors = validate_password_strength(data['password'])
        if errors:
            raise serializers.ValidationError({'password': errors[0]})
        return data

    def create(self, validated_data):
        validated_data.pop('password2')
        company_name    = validated_data.pop('company_name', '')
        phone           = validated_data.pop('phone', '')
        olt_count_range = validated_data.pop('olt_count_range', '')
        heard_from      = validated_data.pop('heard_from', '')
        user = User.objects.create_user(**validated_data)
        user.company_name    = company_name
        user.phone           = phone
        user.olt_count_range = olt_count_range
        user.heard_from      = heard_from
        user.is_active = False
        user.save(update_fields=['is_active', 'company_name', 'phone', 'olt_count_range', 'heard_from'])
        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, max_length=128)

    def validate(self, data):
        user = authenticate(username=data['username'].strip(), password=data['password'])
        if not user:
            raise serializers.ValidationError('Invalid credentials.')
        if not user.is_active:
            raise serializers.ValidationError('Please verify your email address before logging in.')
        data['user'] = user
        return data


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'company_name', 'phone', 'olt_count_range', 'heard_from', 'is_staff', 'is_superuser', 'created_at')
        read_only_fields = ('id', 'username', 'is_staff', 'is_superuser', 'created_at')
