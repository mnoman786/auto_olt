from django.db import models
from django.conf import settings


class OLT(models.Model):
    SNMP_VERSION_CHOICES = [
        ('v1', 'SNMPv1'),
        ('v2c', 'SNMPv2c'),
        ('v3', 'SNMPv3'),
    ]
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('configuring', 'Configuring'),
        ('active', 'Active'),
        ('error', 'Error'),
        ('offline', 'Offline'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='olts')
    name = models.CharField(max_length=100)
    ip_address = models.GenericIPAddressField()
    snmp_version = models.CharField(max_length=4, choices=SNMP_VERSION_CHOICES, default='v2c')
    snmp_read_community = models.CharField(max_length=100, default='public')
    snmp_write_community = models.CharField(max_length=100, blank=True, default='')
    telnet_enabled = models.BooleanField(default=False)
    telnet_port = models.PositiveIntegerField(default=23)
    telnet_username = models.CharField(max_length=50, blank=True, default='admin')
    telnet_password = models.CharField(max_length=100, blank=True, default='admin')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    system_name = models.CharField(max_length=200, blank=True, default='')
    system_description = models.CharField(max_length=500, blank=True, default='')
    system_uptime = models.CharField(max_length=100, blank=True, default='')
    last_polled = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'olts'
        unique_together = ('user', 'ip_address')
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} ({self.ip_address})'


class SetupLog(models.Model):
    LEVEL_CHOICES = [
        ('info', 'Info'),
        ('success', 'Success'),
        ('warning', 'Warning'),
        ('error', 'Error'),
    ]

    olt = models.ForeignKey(OLT, on_delete=models.CASCADE, related_name='setup_logs')
    step = models.CharField(max_length=100)
    message = models.TextField()
    level = models.CharField(max_length=10, choices=LEVEL_CHOICES, default='info')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'setup_logs'
        ordering = ['created_at']

    def __str__(self):
        return f'[{self.level.upper()}] {self.step}: {self.message[:50]}'
