from django.db import migrations


class Migration(migrations.Migration):
    """
    Drop the redundant telnet_username / telnet_password columns. The
    olt_admin_* fields cover the same purpose and were already preferred
    in the credential-resolution chain.
    """

    dependencies = [
        ('olts', '0009_olt_profiles'),
    ]

    operations = [
        migrations.RemoveField(model_name='olt', name='telnet_username'),
        migrations.RemoveField(model_name='olt', name='telnet_password'),
    ]
