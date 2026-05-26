from rest_framework import serializers
from .models import AlertRule, AlertEvent


class AlertRuleSerializer(serializers.ModelSerializer):
    olt_name = serializers.CharField(source='olt.name', read_only=True, default=None)

    class Meta:
        model = AlertRule
        fields = (
            'id', 'olt', 'olt_name', 'alert_type', 'channel',
            'enabled', 'threshold', 'cooldown_minutes', 'created_at',
        )
        read_only_fields = ('id', 'created_at')

    def validate(self, data):
        alert_type = data.get('alert_type', getattr(self.instance, 'alert_type', None))
        threshold = data.get('threshold', getattr(self.instance, 'threshold', None))
        if alert_type in ('signal_weak', 'onu_drop') and threshold is None:
            defaults = {'signal_weak': -28.0, 'onu_drop': 50.0}
            data['threshold'] = defaults[alert_type]
        return data


class AlertEventSerializer(serializers.ModelSerializer):
    olt_name = serializers.CharField(source='olt.name', read_only=True)
    alert_type = serializers.CharField(source='rule.alert_type', read_only=True)
    onu_serial = serializers.CharField(source='onu.serial_number', read_only=True, default=None)

    class Meta:
        model = AlertEvent
        fields = ('id', 'alert_type', 'olt_name', 'onu_serial', 'message', 'sent', 'triggered_at')
