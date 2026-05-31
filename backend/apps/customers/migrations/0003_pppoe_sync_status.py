from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('customers', '0002_pppoe_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='customer',
            name='pppoe_sync_status',
            field=models.CharField(
                choices=[
                    ('not_required', 'Not Required'),
                    ('pending', 'Pending'),
                    ('synced', 'Synced'),
                    ('failed', 'Failed'),
                ],
                default='not_required',
                db_index=True,
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='customer',
            name='pppoe_sync_error',
            field=models.CharField(blank=True, default='', max_length=500),
        ),
        migrations.AddField(
            model_name='customer',
            name='pppoe_synced_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
