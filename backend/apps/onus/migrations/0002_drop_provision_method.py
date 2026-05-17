from django.db import migrations


class Migration(migrations.Migration):
    """
    Drop the provision_method column. ONU provisioning is now Telnet-only;
    the field always held 'telnet' or 'none' and no longer carried useful
    information.
    """

    dependencies = [
        ('onus', '0001_initial'),
    ]

    operations = [
        migrations.RemoveField(model_name='onu', name='provision_method'),
    ]
