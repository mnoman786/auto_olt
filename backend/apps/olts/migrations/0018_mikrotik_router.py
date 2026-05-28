from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.db.models.fields


class Migration(migrations.Migration):

    dependencies = [
        ('olts', '0017_mikrotik_fields'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # 1. Create MikroTikRouter table
        migrations.CreateModel(
            name='MikroTikRouter',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('host', models.CharField(max_length=100)),
                ('port', models.PositiveIntegerField(default=8728)),
                ('username', models.CharField(default='admin', max_length=100)),
                ('password', models.CharField(blank=True, default='', max_length=500)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='mikrotik_routers',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={'db_table': 'mikrotik_routers', 'ordering': ['name']},
        ),
        # 2. Add mikrotik FK to OLT
        migrations.AddField(
            model_name='olt',
            name='mikrotik',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='olts',
                to='olts.mikrotikrouter',
            ),
        ),
        # 3. Remove the old per-OLT mikrotik fields (replaced by the FK above)
        migrations.RemoveField(model_name='olt', name='mikrotik_host'),
        migrations.RemoveField(model_name='olt', name='mikrotik_port'),
        migrations.RemoveField(model_name='olt', name='mikrotik_username'),
        migrations.RemoveField(model_name='olt', name='mikrotik_password'),
    ]
