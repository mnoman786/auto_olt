from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('onus', '0004_add_olt_status_composite_index'),
    ]

    operations = [
        migrations.CreateModel(
            name='SignalSample',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('timestamp', models.DateTimeField(db_index=True)),
                ('rx_power', models.FloatField()),
                ('onu', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='signal_samples', to='onus.onu')),
            ],
            options={'db_table': 'signal_samples'},
        ),
        migrations.AddIndex(
            model_name='signalsample',
            index=models.Index(fields=['onu', 'timestamp'], name='signal_onu_time_idx'),
        ),
    ]
