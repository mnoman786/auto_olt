from django.db import migrations, models
import django.db.models.fields


class Migration(migrations.Migration):

    dependencies = [
        ('olts', '0016_oltport_max_capacity'),
    ]

    operations = [
        migrations.AddField(
            model_name='olt',
            name='mikrotik_host',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AddField(
            model_name='olt',
            name='mikrotik_port',
            field=models.PositiveIntegerField(default=8728),
        ),
        migrations.AddField(
            model_name='olt',
            name='mikrotik_username',
            field=models.CharField(blank=True, default='admin', max_length=100),
        ),
        migrations.AddField(
            model_name='olt',
            name='mikrotik_password',
            field=models.CharField(blank=True, default='', max_length=500),
        ),
    ]
