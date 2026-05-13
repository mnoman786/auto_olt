from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('vlans', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='vlan',
            name='pushed_to_olt',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='vlan',
            name='push_error',
            field=models.CharField(blank=True, default='', max_length=300),
        ),
    ]
