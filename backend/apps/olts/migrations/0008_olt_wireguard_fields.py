from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('olts', '0007_vpn_virtual_ip_unique'),
    ]

    operations = [
        migrations.AddField(
            model_name='olt',
            name='wg_client_public_key',
            field=models.CharField(blank=True, default='', max_length=200,
                                   help_text="Customer MikroTik's WireGuard public key"),
        ),
        migrations.AddField(
            model_name='olt',
            name='wg_client_subnet',
            field=models.CharField(blank=True, default='', max_length=50,
                                   help_text='Customer LAN subnet e.g. 192.168.1.0/24'),
        ),
    ]
