from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('plans', '0002_seed_plans'),
    ]

    operations = [
        migrations.AddField(
            model_name='plan',
            name='billing_type',
            field=models.CharField(
                choices=[('flat', 'Flat monthly fee'), ('per_olt', 'Per OLT per month')],
                default='flat',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='plan',
            name='price_per_olt',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=8),
        ),
        migrations.AlterModelOptions(
            name='plan',
            options={'ordering': ['price_monthly', 'price_per_olt']},
        ),
    ]
