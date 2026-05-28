from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0005_otp_max_length_8'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='company_name',
            field=models.CharField(blank=True, default='', max_length=150),
        ),
    ]
