from django.db import models


class ONU(models.Model):
    STATUS_CHOICES = [
        ('unregistered', 'Unregistered'),
        ('registered', 'Registered'),
        ('active', 'Active'),
        ('offline', 'Offline'),
        ('provisioning', 'Provisioning'),
    ]

    olt = models.ForeignKey('olts.OLT', on_delete=models.CASCADE, related_name='onus')
    serial_number = models.CharField(max_length=100, db_index=True)
    mac_address = models.CharField(max_length=17, blank=True, default='')
    pon_port = models.CharField(max_length=50, blank=True, default='', db_index=True)
    onu_index = models.IntegerField(default=0)
    onu_id = models.IntegerField(default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='unregistered', db_index=True)
    signal_strength = models.FloatField(null=True, blank=True)
    service_profile = models.CharField(max_length=100, blank=True, default='')
    vlan = models.ForeignKey(
        'vlans.VLAN', null=True, blank=True, on_delete=models.SET_NULL, related_name='onus'
    )
    description = models.CharField(max_length=200, blank=True, default='')
    last_seen = models.DateTimeField(null=True, blank=True)
    registered_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'onus'
        unique_together = ('olt', 'serial_number')
        ordering = ['-created_at']

    def __str__(self):
        return f'ONU {self.serial_number} on {self.olt.name} [{self.status}]'


class ProvisioningLog(models.Model):
    LEVEL_CHOICES = [
        ('info', 'Info'),
        ('success', 'Success'),
        ('warning', 'Warning'),
        ('error', 'Error'),
    ]

    onu = models.ForeignKey(ONU, on_delete=models.CASCADE, related_name='provisioning_logs')
    step = models.CharField(max_length=100)
    message = models.TextField()
    level = models.CharField(max_length=10, choices=LEVEL_CHOICES, default='info')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'provisioning_logs'
        ordering = ['created_at']
