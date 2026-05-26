from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('olts', '0014_bandwidth_sample'),
        ('vlans', '__first__'),
    ]

    operations = [
        migrations.CreateModel(
            name='AutoProvisionConfig',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('enabled', models.BooleanField(default=False)),
                ('line_profile_id', models.IntegerField(default=1)),
                ('srv_profile_id', models.IntegerField(default=1)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('default_vlan', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='+', to='vlans.vlan',
                )),
                ('olt', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='auto_provision_config', to='olts.olt',
                )),
            ],
            options={'db_table': 'auto_provision_configs'},
        ),
    ]
