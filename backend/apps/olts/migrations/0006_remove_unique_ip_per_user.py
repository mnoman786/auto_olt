from django.db import migrations
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        ('olts', '0005_olt_connection_type'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name='olt',
            unique_together=set(),
        ),
    ]
