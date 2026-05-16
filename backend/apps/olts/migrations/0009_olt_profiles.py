from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('olts', '0008_olt_wireguard_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='olt',
            name='line_profiles',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='olt',
            name='srv_profiles',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='olt',
            name='profiles_last_synced',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
