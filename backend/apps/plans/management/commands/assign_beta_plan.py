"""
python manage.py assign_beta_plan

Assigns the beta (unlimited) plan to every user who doesn't yet have a
subscription. Safe to re-run — skips users who already have one.
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from apps.plans.models import Plan, UserSubscription

User = get_user_model()


class Command(BaseCommand):
    help = 'Assign the beta unlimited plan to all users without a subscription'

    def handle(self, *args, **options):
        try:
            beta = Plan.objects.get(slug='beta')
        except Plan.DoesNotExist:
            self.stderr.write('Beta plan not found. Run migrations first.')
            return

        users = User.objects.all()
        assigned = 0
        skipped = 0

        for user in users:
            _, created = UserSubscription.objects.get_or_create(
                user=user,
                defaults={'plan': beta},
            )
            if created:
                assigned += 1
            else:
                skipped += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'Done. Assigned: {assigned}, already had plan: {skipped}'
            )
        )
