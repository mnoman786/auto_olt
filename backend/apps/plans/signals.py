from django.db.models.signals import post_save
from django.dispatch import receiver
from django.conf import settings


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def assign_beta_plan(sender, instance, created, **kwargs):
    """Give every new user the beta (unlimited) plan automatically."""
    if not created:
        return
    from apps.plans.models import Plan, UserSubscription
    try:
        plan = Plan.objects.get(slug='beta')
        UserSubscription.objects.get_or_create(user=instance, defaults={'plan': plan})
    except Plan.DoesNotExist:
        pass
