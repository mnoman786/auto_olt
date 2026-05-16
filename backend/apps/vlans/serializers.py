from rest_framework import serializers
from .models import VLAN


class VLANSerializer(serializers.ModelSerializer):
    onu_count = serializers.SerializerMethodField()

    class Meta:
        model = VLAN
        fields = ('id', 'vlan_id', 'name', 'description', 'onu_count',
                  'source', 'last_seen_on_olt',
                  'pushed_to_olt', 'push_error', 'created_at', 'updated_at')
        read_only_fields = ('id', 'source', 'last_seen_on_olt',
                            'pushed_to_olt', 'push_error', 'created_at', 'updated_at')

    def get_onu_count(self, obj):
        return obj.onus.count()

    def validate_vlan_id(self, value):
        if not 1 <= value <= 4094:
            raise serializers.ValidationError('VLAN ID must be between 1 and 4094.')
        return value

    def validate(self, data):
        olt = self.context.get('olt')
        vlan_id = data.get('vlan_id', getattr(self.instance, 'vlan_id', None))
        instance_id = self.instance.id if self.instance else None
        if olt and vlan_id:
            qs = VLAN.objects.filter(olt=olt, vlan_id=vlan_id)
            if instance_id:
                qs = qs.exclude(id=instance_id)
            if qs.exists():
                raise serializers.ValidationError({'vlan_id': f'VLAN {vlan_id} already exists on this OLT.'})
        return data
