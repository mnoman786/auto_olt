from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0007_add_phone'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='olt_count_range',
            field=models.CharField(blank=True, default='', max_length=20),
        ),
        migrations.AddField(
            model_name='user',
            name='heard_from',
            field=models.CharField(blank=True, default='', max_length=50),
        ),
    ]
