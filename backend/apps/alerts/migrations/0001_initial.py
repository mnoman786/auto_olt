from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('olts', '__first__'),
        ('onus', '__first__'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='AlertRule',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('alert_type', models.CharField(choices=[('olt_offline', 'OLT Offline'), ('olt_error', 'OLT Error'), ('onu_drop', 'ONU Drop (mass offline)'), ('signal_weak', 'Weak ONU Signal')], max_length=20)),
                ('channel', models.CharField(choices=[('email', 'Email')], default='email', max_length=10)),
                ('enabled', models.BooleanField(default=True)),
                ('threshold', models.FloatField(blank=True, null=True)),
                ('cooldown_minutes', models.PositiveIntegerField(default=60)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='alert_rules', to=settings.AUTH_USER_MODEL)),
                ('olt', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='alert_rules', to='olts.olt')),
            ],
            options={'db_table': 'alert_rules', 'ordering': ['alert_type']},
        ),
        migrations.CreateModel(
            name='AlertEvent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('message', models.TextField()),
                ('sent', models.BooleanField(default=False)),
                ('triggered_at', models.DateTimeField(auto_now_add=True)),
                ('rule', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='events', to='alerts.alertrule')),
                ('olt', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='alert_events', to='olts.olt')),
                ('onu', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='alert_events', to='onus.onu')),
            ],
            options={'db_table': 'alert_events', 'ordering': ['-triggered_at']},
        ),
        migrations.AddIndex(
            model_name='alertevent',
            index=models.Index(fields=['olt', 'triggered_at'], name='alert_olt_time_idx'),
        ),
    ]
