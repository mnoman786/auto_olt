"""
Data migration — creates the 5 plan tiers and assigns every existing
user to the 'beta' (unlimited) plan.
"""
from django.db import migrations


PLANS = [
    {
        'slug': 'beta',
        'name': 'Beta (Unlimited)',
        'price_monthly': '0.00',
        'olt_limit': None,   # unlimited
        'onu_limit': None,   # unlimited
        'description': 'Free unlimited access during the beta period.',
        'features': [
            'Unlimited OLT devices',
            'Unlimited ONUs',
            'All features included',
            'No credit card required',
            'Priority feedback channel',
        ],
    },
    {
        'slug': 'free',
        'name': 'Free',
        'price_monthly': '0.00',
        'olt_limit': 1,
        'onu_limit': 50,
        'description': 'Get started with a single OLT.',
        'features': [
            '1 OLT device',
            'Up to 50 ONUs',
            'ONU auto-discovery',
            'Basic monitoring',
            'Community support',
        ],
    },
    {
        'slug': 'starter',
        'name': 'Starter',
        'price_monthly': '9.00',
        'olt_limit': 3,
        'onu_limit': 300,
        'description': 'Perfect for small ISPs.',
        'features': [
            'Up to 3 OLT devices',
            'Up to 300 ONUs',
            'All core features',
            'VLAN management',
            'Email support',
            '7-day signal history',
        ],
    },
    {
        'slug': 'pro',
        'name': 'Pro',
        'price_monthly': '29.00',
        'olt_limit': 10,
        'onu_limit': None,   # unlimited ONUs
        'description': 'For growing ISPs that need more.',
        'features': [
            'Up to 10 OLT devices',
            'Unlimited ONUs',
            'All features',
            'Advanced alerts',
            'Excel & PDF reports',
            '30-day signal history',
            'Priority support',
            'Bulk ONU registration',
        ],
    },
    {
        'slug': 'business',
        'name': 'Business',
        'price_monthly': '79.00',
        'olt_limit': None,   # unlimited
        'onu_limit': None,   # unlimited
        'description': 'Large ISPs with no limits.',
        'features': [
            'Unlimited OLT devices',
            'Unlimited ONUs',
            'All features',
            '90-day signal history',
            'API access',
            'White-label option',
            '24/7 dedicated support',
            'Custom integrations',
        ],
    },
]


def seed_plans(apps, schema_editor):
    Plan = apps.get_model('plans', 'Plan')
    UserSubscription = apps.get_model('plans', 'UserSubscription')
    User = apps.get_model('accounts', 'User')

    # Create all plans
    plan_objs = {}
    for data in PLANS:
        plan, _ = Plan.objects.update_or_create(slug=data['slug'], defaults=data)
        plan_objs[data['slug']] = plan

    # Assign every existing user to the beta plan
    beta = plan_objs['beta']
    for user in User.objects.all():
        UserSubscription.objects.get_or_create(user=user, defaults={'plan': beta})


def unseed_plans(apps, schema_editor):
    Plan = apps.get_model('plans', 'Plan')
    Plan.objects.filter(slug__in=[p['slug'] for p in PLANS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('plans', '0001_initial'),
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_plans, reverse_code=unseed_plans),
    ]
