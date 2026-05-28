from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from .models import User


import re


def validate_phone(phone: str):
    """
    Returns an error string if invalid, None if valid.
    Accepts local (0300-1234567, 11 digits) and international (+92-300-1234567, +92 + 10 digits).
    """
    if not phone:
        return None
    has_plus = phone.startswith('+')
    digits = re.sub(r'\D', '', phone)
    if not digits.isdigit():
        return 'Phone number must contain only digits, dashes, or +.'
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


def validate_password_strength(password: str) -> list[str]:
    """Return a list of error strings, empty if password is acceptable."""
    errors = []
    if len(password) < 8:
        errors.append('Password must be at least 8 characters.')
    if not any(c.isupper() for c in password):
        errors.append('Password must contain at least one uppercase letter.')
    if not any(c.isdigit() for c in password):
        errors.append('Password must contain at least one number.')
    return errors


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password2 = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'password2', 'company_name', 'phone', 'olt_count_range', 'heard_from')

    def validate_phone(self, value):
        err = validate_phone(value)
        if err:
            raise serializers.ValidationError(err)
        return value

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
        company_name = validated_data.pop('company_name', '')
        phone = validated_data.pop('phone', '')
        olt_count_range = validated_data.pop('olt_count_range', '')
        heard_from = validated_data.pop('heard_from', '')
        user = User.objects.create_user(**validated_data)
        user.company_name = company_name
        user.phone = phone
        user.olt_count_range = olt_count_range
        user.heard_from = heard_from
        user.is_active = False
        user.save(update_fields=['is_active', 'company_name', 'phone', 'olt_count_range', 'heard_from'])
        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        user = authenticate(username=data['username'], password=data['password'])
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
