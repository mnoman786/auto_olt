import base64
import ipaddress
import re
from rest_framework import serializers
from .models import OLT, SetupLog, OLTPort, AutoProvisionConfig

VPN_POOL = ipaddress.IPv4Network('10.100.0.0/16')


def _assign_virtual_ip() -> str:
    """Pick the next unused IP from the VPN pool.

    Fast path: increment the highest currently-allocated IP — O(1).
    Fallback: full scan for gaps left by deletions — O(n), rarely needed.
    """
    last = (
        OLT.objects.filter(vpn_virtual_ip__isnull=False)
        .order_by('vpn_virtual_ip')
        .values_list('vpn_virtual_ip', flat=True)
        .last()
    )
    if last:
        try:
            candidate = ipaddress.IPv4Address(last) + 1
            candidate_str = str(candidate)
            if candidate in VPN_POOL and not OLT.objects.filter(vpn_virtual_ip=candidate_str).exists():
                return candidate_str
        except ipaddress.AddressValueError:
            pass

    # Fallback: full scan (handles gaps from deletions or first allocation)
    used = set(OLT.objects.filter(vpn_virtual_ip__isnull=False).values_list('vpn_virtual_ip', flat=True))
    for ip in VPN_POOL.hosts():
        if str(ip) not in used:
            return str(ip)
    raise serializers.ValidationError('VPN IP pool exhausted. Contact administrator.')


class SetupLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = SetupLog
        fields = ('id', 'step', 'message', 'level', 'created_at')


class _OLTSerializerBase(serializers.ModelSerializer):
    """Shared fields for both list and detail OLT serializers."""
    onu_count = serializers.SerializerMethodField()
    registered_onu_count = serializers.SerializerMethodField()
    vlan_count = serializers.SerializerMethodField()
    discovered_vlan_count = serializers.SerializerMethodField()
    username = serializers.CharField(source='user.username', read_only=True)
    has_admin_password = serializers.SerializerMethodField()
    has_snmp_read_community = serializers.SerializerMethodField()
    has_snmp_write_community = serializers.SerializerMethodField()

    def get_onu_count(self, obj):
        return getattr(obj, '_onu_count', None) or 0

    def get_registered_onu_count(self, obj):
        return getattr(obj, '_registered_onu_count', None) or 0

    def get_vlan_count(self, obj):
        return getattr(obj, '_vlan_count', None) or 0

    def get_discovered_vlan_count(self, obj):
        return getattr(obj, '_discovered_vlan_count', None) or 0

    def get_has_admin_password(self, obj):
        return bool(obj.olt_admin_password)

    def get_has_snmp_read_community(self, obj):
        return bool(obj.snmp_read_community)

    def get_has_snmp_write_community(self, obj):
        return bool(obj.snmp_write_community)


class OLTListSerializer(_OLTSerializerBase):
    """Lean serializer for list views — omits large profile JSONs."""
    class Meta:
        model = OLT
        fields = (
            'id', 'username', 'name', 'ip_address', 'connection_type', 'vpn_virtual_ip',
            'snmp_version', 'telnet_enabled', 'telnet_port', 'olt_admin_username',
            'has_admin_password', 'has_snmp_read_community', 'has_snmp_write_community',
            'status', 'system_name', 'system_uptime',
            'last_polled', 'created_at', 'updated_at',
            'onu_count', 'registered_onu_count',
            'vlan_count', 'discovered_vlan_count',
        )
        read_only_fields = ('id', 'status', 'system_name', 'system_uptime',
                            'last_polled', 'created_at', 'updated_at', 'vpn_virtual_ip')


class OLTSerializer(_OLTSerializerBase):
    """Full serializer for detail views — includes profile JSON and all fields."""
    class Meta:
        model = OLT
        fields = (
            'id', 'username', 'name', 'ip_address', 'connection_type', 'vpn_virtual_ip',
            'wg_client_public_key', 'wg_client_subnet',
            'snmp_version',
            'telnet_enabled', 'telnet_port',
            'olt_admin_username',
            'has_admin_password', 'has_snmp_read_community', 'has_snmp_write_community',
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
            'snmp_read_community': {'required': False, 'allow_blank': True, 'write_only': True},
            'snmp_write_community': {'required': False, 'allow_blank': True, 'write_only': True},
            'olt_admin_username': {'required': False, 'allow_blank': True},
            'olt_admin_password': {'required': False, 'allow_blank': True, 'write_only': True},
            'telnet_port': {'required': False},
        }

    def validate_wg_client_public_key(self, value):
        if not value:
            return value
        # WireGuard public keys are 32 bytes encoded as 44-character base64 (with trailing '=')
        if not re.fullmatch(r'[A-Za-z0-9+/]{43}=', value):
            raise serializers.ValidationError(
                'Invalid WireGuard public key. Must be a 44-character base64 string ending in "=".'
            )
        try:
            decoded = base64.b64decode(value)
            if len(decoded) != 32:
                raise serializers.ValidationError('WireGuard public key must decode to exactly 32 bytes.')
        except Exception:
            raise serializers.ValidationError('WireGuard public key is not valid base64.')
        return value

    def validate_wg_client_subnet(self, value):
        if not value:
            return value
        try:
            ipaddress.IPv4Network(value, strict=False)
        except ValueError:
            raise serializers.ValidationError(
                'Invalid CIDR notation. Expected format: e.g. 10.0.0.0/24'
            )
        return value

    def _validate_snmp_community(self, value, field_name):
        if not value:
            return value
        # Reject characters that could break OLT CLI commands
        if re.search(r'[\r\n\t"\'`;|&$<>\\]', value):
            raise serializers.ValidationError(
                f'{field_name} must not contain shell or CLI metacharacters '
                r'(newlines, quotes, semicolons, pipes, etc.).'
            )
        if len(value) > 64:
            raise serializers.ValidationError(f'{field_name} must not exceed 64 characters.')
        return value

    def validate_snmp_read_community(self, value):
        return self._validate_snmp_community(value, 'SNMP read community')

    def validate_snmp_write_community(self, value):
        return self._validate_snmp_community(value, 'SNMP write community')

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
    utilization_pct = serializers.FloatField(read_only=True)

    class Meta:
        model = OLTPort
        fields = ('id', 'if_index', 'name', 'description', 'port_type',
                  'status', 'speed_mbps', 'onu_count', 'max_capacity',
                  'utilization_pct', 'updated_at')


class AutoProvisionConfigSerializer(serializers.ModelSerializer):
    default_vlan_id   = serializers.IntegerField(source='default_vlan.id',   allow_null=True, read_only=True)
    default_vlan_name = serializers.CharField(source='default_vlan.name',    allow_null=True, read_only=True)
    default_vlan_vid  = serializers.IntegerField(source='default_vlan.vlan_id', allow_null=True, read_only=True)

    class Meta:
        model  = AutoProvisionConfig
        fields = (
            'enabled',
            'default_vlan', 'default_vlan_id', 'default_vlan_name', 'default_vlan_vid',
            'line_profile_id', 'srv_profile_id',
            'updated_at',
        )
        extra_kwargs = {'default_vlan': {'write_only': True, 'allow_null': True, 'required': False}}
