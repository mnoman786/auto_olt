import ipaddress
from rest_framework import serializers
from .models import OLT, SetupLog, OLTPort

VPN_POOL = ipaddress.IPv4Network('10.100.0.0/16')


def _assign_virtual_ip() -> str:
    """Pick the next unused IP from the VPN pool (globally unique across all OLTs)."""
    used = set(OLT.objects.filter(vpn_virtual_ip__isnull=False).values_list('vpn_virtual_ip', flat=True))
    for ip in VPN_POOL.hosts():
        candidate = str(ip)
        if candidate not in used:
            return candidate
    raise serializers.ValidationError('VPN IP pool exhausted. Contact administrator.')


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
            'id', 'name', 'ip_address', 'connection_type', 'vpn_virtual_ip',
            'snmp_version', 'snmp_read_community', 'snmp_write_community',
            'telnet_enabled', 'telnet_port', 'telnet_username', 'telnet_password',
            'olt_admin_username', 'olt_admin_password',
            'status', 'system_name', 'system_description', 'system_uptime',
            'last_polled', 'created_at', 'updated_at',
            'onu_count', 'registered_onu_count',
        )
        read_only_fields = ('id', 'status', 'system_name', 'system_description',
                            'system_uptime', 'last_polled', 'created_at', 'updated_at',
                            'vpn_virtual_ip')
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
            'name', 'ip_address', 'connection_type', 'vpn_virtual_ip',
            'snmp_version', 'snmp_read_community', 'snmp_write_community',
            'telnet_enabled', 'telnet_port', 'telnet_username', 'telnet_password',
            'olt_admin_username', 'olt_admin_password',
        )
        extra_kwargs = {
            'connection_type': {'required': False},
            'vpn_virtual_ip': {'required': False, 'allow_null': True, 'read_only': False},
            'snmp_write_community': {'required': False, 'allow_blank': True},
            'telnet_username': {'required': False, 'allow_blank': True},
            'telnet_password': {'required': False, 'allow_blank': True},
            'olt_admin_username': {'required': False, 'allow_blank': True},
            'olt_admin_password': {'required': False, 'allow_blank': True},
            'telnet_port': {'required': False},
        }

    def validate(self, attrs):
        user = self.context['request'].user
        olt_id = self.instance.id if self.instance else None
        connection_type = attrs.get('connection_type', getattr(self.instance, 'connection_type', 'direct'))
        errors = {}

        if connection_type == 'direct':
            ip = attrs.get('ip_address', getattr(self.instance, 'ip_address', None))
            if ip:
                qs = OLT.objects.filter(connection_type='direct', ip_address=ip, user=user)
                if olt_id:
                    qs = qs.exclude(id=olt_id)
                if qs.exists():
                    errors['ip_address'] = 'You already have a direct OLT with this IP address.'
            # Clear any stale virtual IP if switching from VPN to direct
            attrs['vpn_virtual_ip'] = None
        else:
            # VPN: auto-assign a globally unique virtual IP (ignore anything sent by client)
            if not self.instance or not self.instance.vpn_virtual_ip:
                attrs['vpn_virtual_ip'] = _assign_virtual_ip()
            # else keep existing assigned IP on update

        telnet_enabled = attrs.get('telnet_enabled', getattr(self.instance, 'telnet_enabled', False))
        telnet_username = attrs.get('telnet_username', getattr(self.instance, 'telnet_username', ''))
        telnet_password = attrs.get('telnet_password', getattr(self.instance, 'telnet_password', ''))

        if telnet_enabled:
            if not telnet_username:
                errors['telnet_username'] = 'Telnet username is required when Telnet is enabled.'
            if not telnet_password and not (self.instance and getattr(self.instance, 'telnet_password', '')):
                errors['telnet_password'] = 'Telnet password is required when Telnet is enabled.'

        if errors:
            raise serializers.ValidationError(errors)

        return attrs

    def update(self, instance, validated_data):
        for password_field in ('telnet_password', 'olt_admin_password'):
            if validated_data.get(password_field, None) == '':
                validated_data.pop(password_field, None)
        return super().update(instance, validated_data)


class OLTPortSerializer(serializers.ModelSerializer):
    class Meta:
        model = OLTPort
        fields = ('id', 'if_index', 'name', 'description', 'port_type',
                  'status', 'speed_mbps', 'onu_count', 'updated_at')
