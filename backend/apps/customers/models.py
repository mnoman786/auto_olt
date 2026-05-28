from django.conf import settings
from django.db import models


class Customer(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='customers',
    )
    # Optional link to an ONU — one ONU can have at most one customer
    onu = models.OneToOneField(
        'onus.ONU',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='customer',
    )

    name = models.CharField(max_length=255, db_index=True)
    phone = models.CharField(max_length=20, blank=True, default='')
    address = models.TextField(blank=True, default='')
    cnic = models.CharField(max_length=20, blank=True, default='', verbose_name='CNIC')
    plan_name = models.CharField(max_length=100, blank=True, default='')
    notes = models.TextField(blank=True, default='')
    pppoe_username = models.CharField(max_length=100, blank=True, default='')
    pppoe_password = models.CharField(max_length=100, blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'customers'
        ordering = ['name']
        indexes = [
            models.Index(fields=['user', 'name'], name='customers_user_name_idx'),
        ]

    def __str__(self):
        return self.name
