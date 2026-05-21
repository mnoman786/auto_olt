from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0003_add_email_verification_otp'),
    ]

    operations = [
        migrations.AddField(
            model_name='passwordresetotp',
            name='attempts',
            field=models.SmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='emailverificationotp',
            name='attempts',
            field=models.SmallIntegerField(default=0),
        ),
    ]
