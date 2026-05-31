from rest_framework import serializers
from .models import Customer


class CustomerSerializer(serializers.ModelSerializer):
    onu_serial = serializers.CharField(source='onu.serial_number', read_only=True, default=None)
    onu_pon_port = serializers.CharField(source='onu.pon_port', read_only=True, default=None)
    onu_status = serializers.CharField(source='onu.status', read_only=True, default=None)
    olt_name = serializers.CharField(source='onu.olt.name', read_only=True, default=None)
    olt_id = serializers.IntegerField(source='onu.olt.id', read_only=True, default=None)
    olt_has_mikrotik = serializers.SerializerMethodField()

    def get_olt_has_mikrotik(self, obj):
        return bool(obj.onu and obj.onu.olt and obj.onu.olt.mikrotik_id)

    class Meta:
        model = Customer
        fields = (
            'id', 'name', 'phone', 'address', 'cnic', 'plan_name', 'notes',
            'pppoe_username', 'pppoe_password',
            'pppoe_sync_status', 'pppoe_sync_error', 'pppoe_synced_at',
            'onu', 'onu_serial', 'onu_pon_port', 'onu_status', 'olt_name', 'olt_id',
            'olt_has_mikrotik',
            'created_at', 'updated_at',
        )
        read_only_fields = (
            'id', 'created_at', 'updated_at',
            'pppoe_sync_status', 'pppoe_sync_error', 'pppoe_synced_at',
        )


class CustomerInlineSerializer(serializers.ModelSerializer):
    """Lightweight serializer embedded inside ONU responses."""
    class Meta:
        model = Customer
        fields = ('id', 'name', 'phone', 'plan_name', 'cnic')
