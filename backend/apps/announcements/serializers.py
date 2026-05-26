from rest_framework import serializers
from .models import Announcement


class AnnouncementSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = Announcement
        fields = [
            'id', 'title', 'message', 'type', 'is_active', 'is_dismissible',
            'expires_at', 'created_by_username', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_by_username', 'created_at', 'updated_at']
