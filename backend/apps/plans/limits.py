"""
Quota helpers — import and call these in OLT/ONU views.
"""
from django.db import models as django_models


def get_user_plan(user):
    """Return the user's active Plan, falling back to the free plan."""
    from apps.plans.models import Plan
    try:
        sub = user.subscription
        if sub.is_valid:
            return sub.plan
    except Exception:
        pass
    return Plan.objects.filter(slug='free').first()


def check_olt_limit(user):
    """
    Returns (allowed: bool, current: int, limit: int|None).
    limit=None means unlimited.
    """
    from apps.olts.models import OLT
    plan = get_user_plan(user)
    current = OLT.objects.filter(user=user).count()
    if plan is None or plan.olt_limit is None:
        return True, current, None
    return current < plan.olt_limit, current, plan.olt_limit


def check_onu_limit(user):
    """
    Returns (allowed: bool, current: int, limit: int|None).
    Counts total ONUs across all the user's OLTs.
    limit=None means unlimited.
    """
    from apps.onus.models import ONU
    plan = get_user_plan(user)
    current = ONU.objects.filter(olt__user=user).count()
    if plan is None or plan.onu_limit is None:
        return True, current, None
    return current < plan.onu_limit, current, plan.onu_limit
