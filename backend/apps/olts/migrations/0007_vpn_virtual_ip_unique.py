from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('olts', '0006_remove_unique_ip_per_user'),
    ]

    operations = [
        migrations.AlterField(
            model_name='olt',
            name='vpn_virtual_ip',
            field=models.GenericIPAddressField(
                null=True,
                blank=True,
                unique=True,
                help_text='Auto-assigned virtual IP from WireGuard pool (10.100.0.0/16)',
            ),
        ),
    ]
