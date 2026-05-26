from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('olts', '0013_add_last_polled_index'),
    ]

    operations = [
        migrations.CreateModel(
            name='BandwidthSample',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('timestamp', models.DateTimeField(db_index=True)),
                ('in_mbps', models.FloatField(default=0.0)),
                ('out_mbps', models.FloatField(default=0.0)),
                ('in_octets_raw', models.BigIntegerField(default=0)),
                ('out_octets_raw', models.BigIntegerField(default=0)),
                ('port', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='bandwidth_samples',
                    to='olts.oltport',
                )),
            ],
            options={
                'db_table': 'bandwidth_samples',
                'ordering': ['timestamp'],
            },
        ),
        migrations.AddIndex(
            model_name='bandwidthsample',
            index=models.Index(fields=['port', 'timestamp'], name='bw_port_time_idx'),
        ),
    ]
