from rest_framework import serializers
from .models import OLT, SetupLog


class SetupLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = SetupLog
        fields = ('id', 'step', 'message', 'level', 'created_at')


class OLTSerializer(serializers.ModelSerializer):
    onu_count = serializers.SerializerMethodField()
    registered_onu_count = serializers.SerializerMethodField()

    class Meta:
        model = OLT
        fields = (
            'id', 'name', 'ip_address', 'snmp_version',
            'snmp_read_community', 'snmp_write_community',
            'telnet_enabled', 'telnet_port', 'telnet_username',
            'status', 'system_name', 'system_description', 'system_uptime',
            'last_polled', 'created_at', 'updated_at',
            'onu_count', 'registered_onu_count',
        )
        read_only_fields = ('id', 'status', 'system_name', 'system_description',
                            'system_uptime', 'last_polled', 'created_at', 'updated_at')
        extra_kwargs = {
            'telnet_username': {'write_only': False},
            'snmp_write_community': {'required': False, 'allow_blank': True},
        }

    def get_onu_count(self, obj):
        return obj.onus.count()

    def get_registered_onu_count(self, obj):
        return obj.onus.filter(status__in=('registered', 'active')).count()


class OLTCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = OLT
        fields = (
            'name', 'ip_address', 'snmp_version',
            'snmp_read_community', 'snmp_write_community',
            'telnet_enabled', 'telnet_port', 'telnet_username', 'telnet_password',
        )
        extra_kwargs = {
            'snmp_write_community': {'required': False, 'allow_blank': True},
            'telnet_username': {'required': False, 'allow_blank': True},
            'telnet_password': {'required': False, 'allow_blank': True},
            'telnet_port': {'required': False},
        }

    def validate_ip_address(self, value):
        user = self.context['request'].user
        olt_id = self.instance.id if self.instance else None
        qs = OLT.objects.filter(user=user, ip_address=value)
        if olt_id:
            qs = qs.exclude(id=olt_id)
        if qs.exists():
            raise serializers.ValidationError('You already have an OLT with this IP address.')
        return value
