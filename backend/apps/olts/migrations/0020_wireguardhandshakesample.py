from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('olts', '0019_alter_mikrotikrouter_id'),
    ]

    operations = [
        migrations.CreateModel(
            name='WireGuardHandshakeSample',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('timestamp', models.DateTimeField(db_index=True)),
                ('connected', models.BooleanField(default=False)),
                ('last_handshake', models.BigIntegerField(default=0)),
                ('olt', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='wg_handshake_samples', to='olts.olt')),
            ],
            options={
                'db_table': 'wg_handshake_samples',
                'ordering': ['timestamp'],
                'indexes': [models.Index(fields=['olt', 'timestamp'], name='wg_olt_time_idx')],
            },
        ),
    ]
