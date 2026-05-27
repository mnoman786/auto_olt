from django.db import models
from django.conf import settings
from django.utils import timezone


class Plan(models.Model):
    BILLING_FLAT = 'flat'
    BILLING_PER_OLT = 'per_olt'
    BILLING_CHOICES = [
        (BILLING_FLAT, 'Flat monthly fee'),
        (BILLING_PER_OLT, 'Per OLT per month'),
    ]

    slug = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=100)
    billing_type = models.CharField(max_length=20, choices=BILLING_CHOICES, default=BILLING_FLAT)
    price_monthly = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    # For per_olt billing: cost per OLT per month
    price_per_olt = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    # None means unlimited
    olt_limit = models.PositiveIntegerField(null=True, blank=True)
    onu_limit = models.PositiveIntegerField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    description = models.TextField(blank=True)
    features = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['price_monthly', 'price_per_olt']

    def __str__(self):
        return self.name

    def calculate_monthly_cost(self, olt_count: int) -> float:
        """Return the expected monthly charge given current OLT count."""
        if self.billing_type == self.BILLING_PER_OLT:
            return float(self.price_per_olt) * olt_count
        return float(self.price_monthly)

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
        indexes = [models.Index(fields=['user', 'is_active'], name='plans_users_user_id_idx')]

    def __str__(self):
        return f'{self.user.username} → {self.plan.name}'

    @property
    def is_valid(self):
        if not self.is_active:
            return False
        if self.ends_at and self.ends_at < timezone.now():
            return False
        return True
