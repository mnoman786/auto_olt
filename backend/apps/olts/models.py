from django.db import models
from django.conf import settings
from utils.fields import EncryptedCharField


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
    CONNECTION_TYPE_CHOICES = [
        ('direct', 'Direct (Public IP)'),
        ('vpn', 'VPN (WireGuard)'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='olts')
    name = models.CharField(max_length=100)
    ip_address = models.GenericIPAddressField()
    connection_type = models.CharField(max_length=10, choices=CONNECTION_TYPE_CHOICES, default='direct')
    vpn_virtual_ip = models.GenericIPAddressField(null=True, blank=True, unique=True, help_text='Auto-assigned virtual IP from WireGuard pool (10.100.0.0/16)')
    wg_client_public_key = models.CharField(max_length=200, blank=True, default='', help_text="Customer MikroTik's WireGuard public key")
    wg_client_subnet = models.CharField(max_length=50, blank=True, default='', help_text="Customer LAN subnet e.g. 192.168.1.0/24")
    snmp_version = models.CharField(max_length=4, choices=SNMP_VERSION_CHOICES, default='v2c')
    snmp_read_community = models.CharField(max_length=100, default='autoolt_read')
    snmp_write_community = models.CharField(max_length=100, blank=True, default='autoolt_write')
    telnet_enabled = models.BooleanField(default=False)
    telnet_port = models.PositiveIntegerField(default=23)
    # Credentials used to log in to the OLT for setup, polling, and provisioning.
    olt_admin_username = models.CharField(max_length=50, blank=True, default='admin')
    olt_admin_password = EncryptedCharField(max_length=500, blank=True, default='admin')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)
    system_name = models.CharField(max_length=200, blank=True, default='')
    system_description = models.CharField(max_length=500, blank=True, default='')
    system_uptime = models.CharField(max_length=100, blank=True, default='')
    last_polled = models.DateTimeField(null=True, blank=True)
    # Auto-discovered ONU profile IDs (Huawei). List of dicts like {"id": 1, "name": "default"}.
    # Used so we don't have to guess profile IDs when registering ONUs.
    line_profiles = models.JSONField(default=list, blank=True)
    srv_profiles = models.JSONField(default=list, blank=True)
    profiles_last_synced = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'olts'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} ({self.ip_address})'


class OLTPort(models.Model):
    PORT_TYPE_CHOICES = [
        ('pon', 'PON / GPON'),
        ('uplink', 'Uplink / Ethernet'),
        ('lag', 'LAG / Trunk'),
        ('other', 'Other'),
    ]
    STATUS_CHOICES = [
        ('up', 'Up'),
        ('down', 'Down'),
        ('unknown', 'Unknown'),
    ]

    olt = models.ForeignKey(OLT, on_delete=models.CASCADE, related_name='ports')
    if_index = models.IntegerField(default=0)
    name = models.CharField(max_length=100)
    description = models.CharField(max_length=200, blank=True, default='')
    port_type = models.CharField(max_length=10, choices=PORT_TYPE_CHOICES, default='other')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='unknown')
    speed_mbps = models.IntegerField(default=0)
    onu_count = models.IntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'olt_ports'
        ordering = ['port_type', 'name']
        unique_together = ('olt', 'if_index')

    def __str__(self):
        return f'{self.olt.name} — {self.name} ({self.port_type})'


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
