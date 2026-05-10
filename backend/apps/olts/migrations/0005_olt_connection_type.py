from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('olts', '0004_olt_ports'),
    ]

    operations = [
        migrations.AddField(
            model_name='olt',
            name='connection_type',
            field=models.CharField(
                choices=[('direct', 'Direct (Public IP)'), ('vpn', 'VPN (WireGuard)')],
                default='direct',
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name='olt',
            name='vpn_virtual_ip',
            field=models.GenericIPAddressField(
                blank=True,
                null=True,
                help_text='Virtual/mapped IP assigned on WireGuard server for this OLT',
            ),
        ),
    ]
