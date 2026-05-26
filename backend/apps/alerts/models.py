from django.db import models
from django.conf import settings


class AlertRule(models.Model):
    ALERT_TYPE_CHOICES = [
        ('olt_offline', 'OLT Offline'),
        ('olt_error', 'OLT Error'),
        ('onu_drop', 'ONU Drop (mass offline)'),
        ('signal_weak', 'Weak ONU Signal'),
    ]
    CHANNEL_CHOICES = [
        ('email', 'Email'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='alert_rules')
    # null olt = apply to all user's OLTs
    olt = models.ForeignKey('olts.OLT', null=True, blank=True, on_delete=models.CASCADE, related_name='alert_rules')
    alert_type = models.CharField(max_length=20, choices=ALERT_TYPE_CHOICES)
    channel = models.CharField(max_length=10, choices=CHANNEL_CHOICES, default='email')
    enabled = models.BooleanField(default=True)
    # For signal_weak: fire when rx_power < threshold (dBm), e.g. -28.0
    # For onu_drop:    fire when offline% of port ONUs > threshold, e.g. 50
    threshold = models.FloatField(null=True, blank=True)
    # Cooldown: don't re-fire same rule+OLT within this many minutes
    cooldown_minutes = models.PositiveIntegerField(default=60)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'alert_rules'
        ordering = ['alert_type']

    def __str__(self):
        olt_label = self.olt.name if self.olt_id else 'All OLTs'
        return f'{self.get_alert_type_display()} → {olt_label} [{self.channel}]'


class AlertEvent(models.Model):
    rule = models.ForeignKey(AlertRule, on_delete=models.CASCADE, related_name='events')
    olt = models.ForeignKey('olts.OLT', on_delete=models.CASCADE, related_name='alert_events')
    onu = models.ForeignKey('onus.ONU', null=True, blank=True, on_delete=models.SET_NULL, related_name='alert_events')
    message = models.TextField()
    sent = models.BooleanField(default=False)
    triggered_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'alert_events'
        ordering = ['-triggered_at']
        indexes = [
            models.Index(fields=['olt', 'triggered_at'], name='alert_olt_time_idx'),
        ]
