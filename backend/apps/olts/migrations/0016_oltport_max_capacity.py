from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('olts', '0015_autoprovisionconfig'),
    ]

    operations = [
        migrations.AddField(
            model_name='oltport',
            name='max_capacity',
            field=models.IntegerField(default=128),
        ),
    ]
