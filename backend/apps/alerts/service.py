"""
Alert evaluation and delivery.

Called after each ONU poll and OLT status change.
Each function is cheap: one DB read of rules, then conditional sends.
"""
import logging
from django.db.models import Q
from django.core.mail import send_mail
from django.conf import settings

logger = logging.getLogger(__name__)


def _cooldown_key(rule_id: int, olt_id: int) -> str:
    return f'alert_cooldown:{rule_id}:{olt_id}'


def _is_on_cooldown(rule_id: int, olt_id: int, cooldown_minutes: int) -> bool:
    from django.core.cache import cache
    return bool(cache.get(_cooldown_key(rule_id, olt_id)))


def _set_cooldown(rule_id: int, olt_id: int, cooldown_minutes: int) -> None:
    from django.core.cache import cache
    cache.set(_cooldown_key(rule_id, olt_id), '1', cooldown_minutes * 60)


def _send(rule, olt, message: str, onu=None) -> None:
    from .models import AlertEvent
    event = AlertEvent.objects.create(rule=rule, olt=olt, onu=onu, message=message)
    if rule.channel == 'email':
        recipient = rule.user.email
        if not recipient:
            return
        try:
            send_mail(
                subject=f'[Auto OLT] {rule.get_alert_type_display()} — {olt.name}',
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[recipient],
                fail_silently=True,
            )
            event.sent = True
            event.save(update_fields=['sent'])
        except Exception as exc:
            logger.warning(f'Alert email failed for rule {rule.id}: {exc}')
    _set_cooldown(rule.id, olt.id, rule.cooldown_minutes)


def evaluate_olt_status(olt) -> None:
    """Call after OLT status changes. Checks olt_offline and olt_error rules."""
    from .models import AlertRule
    if olt.status not in ('offline', 'error'):
        return
    alert_type = 'olt_offline' if olt.status == 'offline' else 'olt_error'
    rules = AlertRule.objects.filter(
        user=olt.user, alert_type=alert_type, enabled=True,
    ).filter(
        Q(olt=olt) | Q(olt__isnull=True)
    )
    for rule in rules:
        if _is_on_cooldown(rule.id, olt.id, rule.cooldown_minutes):
            continue
        msg = (
            f'OLT "{olt.name}" ({olt.ip_address}) is now {olt.status.upper()}.\n'
            f'Last polled: {olt.last_polled or "never"}\n'
            f'Check: http://auto-olt/olts/{olt.id}/'
        )
        _send(rule, olt, msg)


def evaluate_after_poll(olt_id: int) -> None:
    """
    Called after a successful ONU poll.
    Checks onu_drop (mass offline) and signal_weak rules.
    """
    from .models import AlertRule
    from apps.onus.models import ONU
    from apps.olts.models import OLT
    try:
        olt = OLT.objects.get(id=olt_id)
    except OLT.DoesNotExist:
        return

    rules = AlertRule.objects.filter(
        user=olt.user, enabled=True,
        alert_type__in=('onu_drop', 'signal_weak'),
    ).filter(
        Q(olt=olt) | Q(olt__isnull=True)
    )

    if not rules.exists():
        return

    onus = list(ONU.objects.filter(olt=olt))
    total = len(onus)
    if total == 0:
        return

    offline_count = sum(1 for o in onus if o.status == 'offline')
    offline_pct = (offline_count / total) * 100

    for rule in rules:
        if _is_on_cooldown(rule.id, olt.id, rule.cooldown_minutes):
            continue

        if rule.alert_type == 'onu_drop':
            threshold = rule.threshold if rule.threshold is not None else 50.0
            if offline_pct >= threshold:
                msg = (
                    f'Mass ONU drop on "{olt.name}" ({olt.ip_address}).\n'
                    f'{offline_count}/{total} ONUs are offline ({offline_pct:.1f}% ≥ {threshold}% threshold).\n'
                    f'Check: http://auto-olt/olts/{olt.id}/onus/'
                )
                _send(rule, olt, msg)

        elif rule.alert_type == 'signal_weak':
            threshold = rule.threshold if rule.threshold is not None else -28.0
            weak = [o for o in onus if o.signal_strength is not None and o.signal_strength < threshold]
            if weak:
                onu = weak[0]
                msg = (
                    f'{len(weak)} ONU(s) with weak signal on "{olt.name}".\n'
                    f'Example: {onu.serial_number} on {onu.pon_port} = {onu.signal_strength:.1f} dBm (threshold {threshold} dBm).\n'
                    f'Check: http://auto-olt/olts/{olt.id}/onus/'
                )
                _send(rule, olt, msg, onu=onu)

