from django.db import models


class VLAN(models.Model):
    SOURCE_CHOICES = (
        ('managed', 'Managed (created in dashboard)'),
        ('discovered', 'Discovered (read from OLT)'),
    )

    olt = models.ForeignKey('olts.OLT', on_delete=models.CASCADE, related_name='vlans')
    vlan_id = models.PositiveIntegerField()
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, default='')
    source = models.CharField(max_length=16, choices=SOURCE_CHOICES, default='managed')
    last_seen_on_olt = models.DateTimeField(null=True, blank=True)
    pushed_to_olt = models.BooleanField(default=False)
    push_error = models.CharField(max_length=300, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'vlans'
        unique_together = ('olt', 'vlan_id')
        ordering = ['vlan_id']

    def __str__(self):
        return f'VLAN {self.vlan_id} ({self.name}) on {self.olt.name}'
