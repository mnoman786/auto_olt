from rest_framework import serializers
from .models import OLT, SetupLog, OLTPort


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
            'telnet_enabled', 'telnet_port', 'telnet_username', 'telnet_password',
            'olt_admin_username', 'olt_admin_password',
            'status', 'system_name', 'system_description', 'system_uptime',
            'last_polled', 'created_at', 'updated_at',
            'onu_count', 'registered_onu_count',
        )
        read_only_fields = ('id', 'status', 'system_name', 'system_description',
                            'system_uptime', 'last_polled', 'created_at', 'updated_at')
        extra_kwargs = {
            'olt_admin_username': {'write_only': False},
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
            'olt_admin_username', 'olt_admin_password',
        )
        extra_kwargs = {
            'snmp_write_community': {'required': False, 'allow_blank': True},
            'telnet_username': {'required': False, 'allow_blank': True},
            'telnet_password': {'required': False, 'allow_blank': True},
            'olt_admin_username': {'required': False, 'allow_blank': True},
            'olt_admin_password': {'required': False, 'allow_blank': True},
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

    def validate(self, attrs):
        telnet_enabled = attrs.get('telnet_enabled', getattr(self.instance, 'telnet_enabled', False))
        telnet_username = attrs.get('telnet_username', getattr(self.instance, 'telnet_username', ''))
        telnet_password = attrs.get('telnet_password', getattr(self.instance, 'telnet_password', ''))

        if telnet_enabled:
            errors = {}
            if not telnet_username:
                errors['telnet_username'] = 'Telnet username is required when Telnet is enabled.'
            # Allow blank telnet_password on update to keep existing stored password.
            if not telnet_password and not (self.instance and getattr(self.instance, 'telnet_password', '')):
                errors['telnet_password'] = 'Telnet password is required when Telnet is enabled.'
            if errors:
                raise serializers.ValidationError(errors)

        return attrs

    def update(self, instance, validated_data):
        # Preserve existing sensitive passwords when client sends empty strings.
        for password_field in ('telnet_password', 'olt_admin_password'):
            if validated_data.get(password_field, None) == '':
                validated_data.pop(password_field, None)
        return super().update(instance, validated_data)


class OLTPortSerializer(serializers.ModelSerializer):
    class Meta:
        model = OLTPort
        fields = ('id', 'if_index', 'name', 'description', 'port_type',
                  'status', 'speed_mbps', 'onu_count', 'updated_at')
