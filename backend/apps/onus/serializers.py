from rest_framework import serializers
from .models import ONU, ProvisioningLog
from apps.vlans.models import VLAN


class ProvisioningLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProvisioningLog
        fields = ('id', 'step', 'message', 'level', 'created_at')


class ONUSerializer(serializers.ModelSerializer):
    vlan_name = serializers.CharField(source='vlan.name', read_only=True, default=None)
    vlan_id_num = serializers.IntegerField(source='vlan.vlan_id', read_only=True, default=None)

    class Meta:
        model = ONU
        fields = (
            'id', 'serial_number', 'mac_address', 'pon_port', 'onu_index', 'onu_id',
            'status', 'signal_strength', 'service_profile', 'description',
            'vlan', 'vlan_name', 'vlan_id_num',
            'last_seen', 'registered_at', 'created_at', 'updated_at',
        )
        read_only_fields = (
            'id', 'serial_number', 'pon_port', 'onu_index', 'status',
            'signal_strength', 'last_seen', 'registered_at',
            'created_at', 'updated_at',
        )


class ONURegisterSerializer(serializers.Serializer):
    vlan_id = serializers.IntegerField(required=False, allow_null=True)
    description = serializers.CharField(required=False, allow_blank=True, max_length=200)
    service_profile = serializers.CharField(required=False, allow_blank=True, max_length=100)
    # Huawei ont-lineprofile-id and ont-srvprofile-id. If omitted, the OLT's
    # auto-discovered profile IDs are used (falls back to 1/1 if none cached).
    line_profile_id = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    srv_profile_id = serializers.IntegerField(required=False, allow_null=True, min_value=1)
