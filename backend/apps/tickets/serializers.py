from rest_framework import serializers
from .models import Ticket, TicketReply


class TicketReplySerializer(serializers.ModelSerializer):
    author_username = serializers.CharField(source='author.username', read_only=True)
    is_staff = serializers.BooleanField(source='author.is_staff', read_only=True)
    message = serializers.CharField(max_length=5000, strip=True)

    class Meta:
        model = TicketReply
        fields = ('id', 'author_username', 'is_staff', 'message', 'created_at')
        read_only_fields = ('id', 'author_username', 'is_staff', 'created_at')


class TicketSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    olt_name = serializers.CharField(source='olt.name', read_only=True, allow_null=True)
    replies = TicketReplySerializer(many=True, read_only=True)
    reply_count = serializers.IntegerField(source='replies.count', read_only=True)
    subject = serializers.CharField(max_length=200, strip=True)
    message = serializers.CharField(max_length=5000, strip=True)

    class Meta:
        model = Ticket
        fields = (
            'id', 'username', 'olt', 'olt_name', 'subject', 'message',
            'status', 'reply_count', 'replies', 'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'username', 'olt_name', 'reply_count', 'replies', 'created_at', 'updated_at')


class TicketListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list view — no replies body."""
    username = serializers.CharField(source='user.username', read_only=True)
    olt_name = serializers.CharField(source='olt.name', read_only=True, allow_null=True)
    reply_count = serializers.SerializerMethodField()

    def get_reply_count(self, obj):
        return getattr(obj, '_reply_count', obj.replies.count())

    class Meta:
        model = Ticket
        fields = (
            'id', 'username', 'olt', 'olt_name', 'subject',
            'status', 'reply_count', 'created_at', 'updated_at',
        )
        read_only_fields = fields
