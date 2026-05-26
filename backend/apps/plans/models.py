from django.db import models
from django.conf import settings
from django.utils import timezone


class Plan(models.Model):
    slug = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=100)
    price_monthly = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    # None means unlimited
    olt_limit = models.PositiveIntegerField(null=True, blank=True)
    onu_limit = models.PositiveIntegerField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    description = models.TextField(blank=True)
    features = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['price_monthly']

    def __str__(self):
        return self.name

    @property
    def olt_limit_display(self):
        return '∞' if self.olt_limit is None else str(self.olt_limit)

    @property
    def onu_limit_display(self):
        return '∞' if self.onu_limit is None else str(self.onu_limit)


class UserSubscription(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='subscription',
    )
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT, related_name='subscriptions')
    started_at = models.DateTimeField(auto_now_add=True)
    ends_at = models.DateTimeField(null=True, blank=True)  # None = no expiry
    is_active = models.BooleanField(default=True)

    class Meta:
        indexes = [models.Index(fields=['user', 'is_active'])]

    def __str__(self):
        return f'{self.user.username} → {self.plan.name}'

    @property
    def is_valid(self):
        if not self.is_active:
            return False
        if self.ends_at and self.ends_at < timezone.now():
            return False
        return True
