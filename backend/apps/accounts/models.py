from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    email = models.EmailField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['email']

    class Meta:
        db_table = 'users'

    def __str__(self):
        return self.username


class PasswordResetOTP(models.Model):
    MAX_ATTEMPTS = 5

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reset_otps')
    otp = models.CharField(max_length=8, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_used = models.BooleanField(default=False)
    attempts = models.SmallIntegerField(default=0)

    class Meta:
        db_table = 'password_reset_otps'
        ordering = ['-created_at']

    def is_expired(self):
        from django.conf import settings
        expiry = getattr(settings, 'OTP_EXPIRY_MINUTES', 10)
        return timezone.now() > self.created_at + timezone.timedelta(minutes=expiry)

    def is_locked(self):
        return self.attempts >= self.MAX_ATTEMPTS


class EmailVerificationOTP(models.Model):
    MAX_ATTEMPTS = 5

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='verification_otps')
    otp = models.CharField(max_length=8, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_used = models.BooleanField(default=False)
    attempts = models.SmallIntegerField(default=0)

    class Meta:
        db_table = 'email_verification_otps'
        ordering = ['-created_at']

    def is_expired(self):
        from django.conf import settings
        expiry = getattr(settings, 'OTP_EXPIRY_MINUTES', 10)
        return timezone.now() > self.created_at + timezone.timedelta(minutes=expiry)

    def is_locked(self):
        return self.attempts >= self.MAX_ATTEMPTS
