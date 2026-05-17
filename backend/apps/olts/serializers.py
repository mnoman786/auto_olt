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
    vlan_count = serializers.SerializerMethodField()
    discovered_vlan_count = serializers.SerializerMethodField()
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = OLT
        fields = (
            'id', 'username', 'name', 'ip_address', 'connection_type', 'vpn_virtual_ip',
            'wg_client_public_key', 'wg_client_subnet',
            'snmp_version', 'snmp_read_community', 'snmp_write_community',
            'telnet_enabled', 'telnet_port',
            'olt_admin_username', 'olt_admin_password',
            'status', 'system_name', 'system_description', 'system_uptime',
            'last_polled', 'created_at', 'updated_at',
            'onu_count', 'registered_onu_count',
            'vlan_count', 'discovered_vlan_count',
            'line_profiles', 'srv_profiles', 'profiles_last_synced',
        )
        read_only_fields = ('id', 'status', 'system_name', 'system_description',
                            'system_uptime', 'last_polled', 'created_at', 'updated_at',
                            'vpn_virtual_ip',
                            'line_profiles', 'srv_profiles', 'profiles_last_synced')
        extra_kwargs = {
            'snmp_write_community': {'required': False, 'allow_blank': True},
        }

    def get_onu_count(self, obj):
        # Use annotation from queryset to avoid N+1; fall back for single-object retrieval
        return getattr(obj, '_onu_count', obj.onus.count())

    def get_registered_onu_count(self, obj):
        return getattr(obj, '_registered_onu_count',
                       obj.onus.filter(status__in=('registered', 'active')).count())

    def get_vlan_count(self, obj):
        return getattr(obj, '_vlan_count', obj.vlans.count())

    def get_discovered_vlan_count(self, obj):
        return getattr(obj, '_discovered_vlan_count',
                       obj.vlans.filter(source='discovered').count())


class OLTCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = OLT
        fields = (
            'name', 'ip_address', 'connection_type', 'vpn_virtual_ip',
            'wg_client_public_key', 'wg_client_subnet',
            'snmp_version', 'snmp_read_community', 'snmp_write_community',
            'telnet_enabled', 'telnet_port',
            'olt_admin_username', 'olt_admin_password',
        )
        extra_kwargs = {
            'connection_type': {'required': False},
            'vpn_virtual_ip': {'required': False, 'allow_null': True, 'read_only': False},
            'wg_client_public_key': {'required': False, 'allow_blank': True},
            'wg_client_subnet': {'required': False, 'allow_blank': True},
            'snmp_write_community': {'required': False, 'allow_blank': True},
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
        admin_username = attrs.get('olt_admin_username', getattr(self.instance, 'olt_admin_username', ''))
        admin_password = attrs.get('olt_admin_password', getattr(self.instance, 'olt_admin_password', ''))

        if telnet_enabled:
            if not admin_username:
                errors['olt_admin_username'] = 'OLT admin username is required when Telnet is enabled.'
            if not admin_password and not (self.instance and getattr(self.instance, 'olt_admin_password', '')):
                errors['olt_admin_password'] = 'OLT admin password is required when Telnet is enabled.'

        if errors:
            raise serializers.ValidationError(errors)

        return attrs

    def update(self, instance, validated_data):
        if validated_data.get('olt_admin_password', None) == '':
            validated_data.pop('olt_admin_password', None)
        return super().update(instance, validated_data)


class OLTPortSerializer(serializers.ModelSerializer):
    class Meta:
        model = OLTPort
        fields = ('id', 'if_index', 'name', 'description', 'port_type',
                  'status', 'speed_mbps', 'onu_count', 'updated_at')
