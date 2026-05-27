from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    ticket_id = serializers.IntegerField(source='ticket.id', read_only=True)
    ticket_subject = serializers.CharField(source='ticket.subject', read_only=True)

    class Meta:
        model = Notification
        fields = ['id', 'ticket_id', 'ticket_subject', 'message', 'is_read', 'created_at']
        read_only_fields = ['id', 'ticket_id', 'ticket_subject', 'message', 'created_at']
