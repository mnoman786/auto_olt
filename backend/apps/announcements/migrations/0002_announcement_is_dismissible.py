from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('announcements', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='announcement',
            name='is_dismissible',
            field=models.BooleanField(default=True),
        ),
    ]
