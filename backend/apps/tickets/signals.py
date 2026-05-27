from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model

User = get_user_model()


def _push(group_name, data):
    """Send data to a channel layer group, silently ignoring errors."""
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                group_name,
                {'type': 'notification.message', 'data': data},
            )
    except Exception:
        pass


def _notification_payload(notification):
    return {
        'type': 'notification',
        'id': notification.id,
        'ticket_id': notification.ticket_id,
        'ticket_subject': notification.ticket.subject,
        'message': notification.message,
        'is_read': False,
        'created_at': notification.created_at.isoformat(),
    }


@receiver(pre_save, sender='tickets.Ticket')
def capture_old_status(sender, instance, **kwargs):
    if instance.pk:
        from apps.tickets.models import Ticket
        try:
            instance._old_status = Ticket.objects.values_list('status', flat=True).get(pk=instance.pk)
        except Ticket.DoesNotExist:
            instance._old_status = None
    else:
        instance._old_status = None


@receiver(post_save, sender='tickets.Ticket')
def notify_on_ticket_status_change(sender, instance, created, **kwargs):
    if created:
        return
    old_status = getattr(instance, '_old_status', None)
    new_status = instance.status
    if old_status == new_status:
        return

    from apps.notifications.models import Notification

    if old_status != 'closed' and new_status == 'closed':
        message = f'Your ticket "{instance.subject}" has been closed.'
    elif old_status == 'closed' and new_status == 'open':
        message = f'Your ticket "{instance.subject}" has been reopened.'
    else:
        return

    n = Notification.objects.create(
        recipient=instance.user,
        ticket=instance,
        message=message,
    )
    _push(f'user_{instance.user_id}', _notification_payload(n))
    _push(f'user_{instance.user_id}', {
        'type': 'ticket_status_changed',
        'ticket_id': instance.id,
        'status': new_status,
    })


@receiver(post_save, sender='tickets.Ticket')
def notify_admins_on_new_ticket(sender, instance, created, **kwargs):
    if not created:
        return
    from apps.notifications.models import Notification
    admins = User.objects.filter(is_staff=True).exclude(pk=instance.user_id)
    for admin in admins:
        n = Notification.objects.create(
            recipient=admin,
            ticket=instance,
            message=f'{instance.user.username} opened ticket: {instance.subject}',
        )
        _push(f'user_{admin.id}', _notification_payload(n))


@receiver(post_save, sender='tickets.TicketReply')
def notify_on_reply(sender, instance, created, **kwargs):
    if not created:
        return
    from apps.notifications.models import Notification
    ticket = instance.ticket
    author = instance.author

    if author.is_staff:
        if ticket.user_id != author.pk:
            n = Notification.objects.create(
                recipient=ticket.user,
                ticket=ticket,
                message=f'{author.username} replied to your ticket: {ticket.subject}',
            )
            _push(f'user_{ticket.user_id}', _notification_payload(n))
            # Tell the open ticket page a new reply arrived
            _push(f'user_{ticket.user_id}', {
                'type': 'ticket_reply_added',
                'ticket_id': ticket.id,
            })
    else:
        admins = User.objects.filter(is_staff=True).exclude(pk=author.pk)
        for admin in admins:
            n = Notification.objects.create(
                recipient=admin,
                ticket=ticket,
                message=f'{author.username} replied on ticket: {ticket.subject}',
            )
            _push(f'user_{admin.id}', _notification_payload(n))
            # Tell admins watching this ticket a reply arrived
            _push(f'user_{admin.id}', {
                'type': 'ticket_reply_added',
                'ticket_id': ticket.id,
            })
