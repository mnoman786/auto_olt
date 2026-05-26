"""
Adds the Standard pay-per-OLT plan ($10/OLT/month, unlimited OLTs & ONUs)
and marks the old flat-fee tiers as inactive.
"""
from django.db import migrations


def add_standard_plan(apps, schema_editor):
    Plan = apps.get_model('plans', 'Plan')

    # Add the Standard per-OLT plan
    Plan.objects.update_or_create(
        slug='standard',
        defaults={
            'name': 'Standard',
            'billing_type': 'per_olt',
            'price_monthly': 0,
            'price_per_olt': '10.00',
            'olt_limit': None,   # unlimited OLTs
            'onu_limit': None,   # unlimited ONUs
            'is_active': True,
            'description': '$10 per OLT per month. Add as many OLTs as you need.',
            'features': [
                '$10 per OLT/month',
                'Unlimited ONUs per OLT',
                'All features included',
                'No setup fees',
                'Scale up or down anytime',
                'Priority support',
            ],
        },
    )

    # Keep flat-fee tiers in the DB but deactivate them
    # (they may be re-activated later or used for grandfathered users)
    Plan.objects.filter(slug__in=['free', 'starter', 'pro', 'business']).update(is_active=False)


def remove_standard_plan(apps, schema_editor):
    Plan = apps.get_model('plans', 'Plan')
    Plan.objects.filter(slug='standard').delete()
    Plan.objects.filter(slug__in=['free', 'starter', 'pro', 'business']).update(is_active=True)


class Migration(migrations.Migration):

    dependencies = [
        ('plans', '0003_plan_per_olt_billing'),
    ]

    operations = [
        migrations.RunPython(add_standard_plan, reverse_code=remove_standard_plan),
    ]
