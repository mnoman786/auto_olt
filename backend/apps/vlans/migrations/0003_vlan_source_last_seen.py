from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('vlans', '0002_vlan_push_status'),
    ]

    operations = [
        migrations.AddField(
            model_name='vlan',
            name='source',
            field=models.CharField(
                choices=[
                    ('managed', 'Managed (created in dashboard)'),
                    ('discovered', 'Discovered (read from OLT)'),
                ],
                default='managed',
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name='vlan',
            name='last_seen_on_olt',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
