from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0004_add_otp_attempts'),
    ]

    operations = [
        migrations.AlterField(
            model_name='passwordresetotp',
            name='otp',
            field=models.CharField(db_index=True, max_length=8),
        ),
        migrations.AlterField(
            model_name='emailverificationotp',
            name='otp',
            field=models.CharField(db_index=True, max_length=8),
        ),
    ]
