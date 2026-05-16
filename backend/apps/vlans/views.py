import threading
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from apps.olts.models import OLT
from .models import VLAN
from .serializers import VLANSerializer


def get_olt_for_user(pk, user):
    return get_object_or_404(OLT, pk=pk, user=user)


class VLANListCreateView(generics.ListCreateAPIView):
    serializer_class = VLANSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        olt = get_olt_for_user(self.kwargs['olt_pk'], self.request.user)
        return VLAN.objects.filter(olt=olt).prefetch_related('onus')

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['olt'] = get_olt_for_user(self.kwargs['olt_pk'], self.request.user)
        return ctx

    def perform_create(self, serializer):
        olt = get_olt_for_user(self.kwargs['olt_pk'], self.request.user)
        vlan = serializer.save(olt=olt)
        # Auto-push to OLT in background if telnet is enabled and OLT is active
        if olt.telnet_enabled and olt.status == 'active':
            from services import provisioning_service
            provisioning_service.push_vlan_to_olt_async(vlan.id)


class VLANDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = VLANSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        olt = get_olt_for_user(self.kwargs['olt_pk'], self.request.user)
        return VLAN.objects.filter(olt=olt)

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['olt'] = get_olt_for_user(self.kwargs['olt_pk'], self.request.user)
        return ctx

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.onus.exists():
            return Response(
                {'detail': f'Cannot delete VLAN {instance.vlan_id}: it has assigned ONUs.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def push_vlan(request, olt_pk, pk):
    """Manually push a VLAN to the OLT via Telnet. Runs in background."""
    olt = get_olt_for_user(olt_pk, request.user)
    vlan = get_object_or_404(VLAN, pk=pk, olt=olt)

    if not olt.telnet_enabled:
        return Response({'detail': 'Telnet not enabled on this OLT.'}, status=400)

    from services import provisioning_service
    provisioning_service.push_vlan_to_olt_async(vlan.id)
    return Response({'detail': f'Pushing VLAN {vlan.vlan_id} to OLT in background.', 'vlan_id': vlan.id})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sync_vlans(request, olt_pk):
    """
    Read all VLANs from the OLT and upsert them into the DB.
    Tries SNMP first, falls back to Telnet. Runs synchronously so the caller
    sees the count immediately.
    """
    olt = get_olt_for_user(olt_pk, request.user)
    from services import provisioning_service
    result = provisioning_service.sync_vlans_from_olt(olt.id)
    if not result.get('success'):
        return Response({'detail': result.get('error') or 'Sync failed', **result}, status=400)
    return Response(result)
