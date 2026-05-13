import threading
from rest_framework import status, generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from apps.olts.models import OLT
from apps.vlans.models import VLAN
from .models import ONU, ProvisioningLog
from .serializers import ONUSerializer, ONURegisterSerializer, ProvisioningLogSerializer
from services import provisioning_service


def get_olt_for_user(pk, user):
    return get_object_or_404(OLT, pk=pk, user=user)


class ONUListView(generics.ListAPIView):
    serializer_class = ONUSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        olt = get_olt_for_user(self.kwargs['olt_pk'], self.request.user)
        status_filter = self.request.query_params.get('status')
        qs = olt.onus.select_related('vlan').all()
        if status_filter:
            if status_filter == 'registered':
                qs = qs.filter(status__in=('registered', 'active'))
            elif status_filter == 'unregistered':
                qs = qs.filter(status='unregistered')
            else:
                qs = qs.filter(status=status_filter)
        return qs


class ONUDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ONUSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        olt = get_olt_for_user(self.kwargs['olt_pk'], self.request.user)
        return olt.onus.select_related('vlan').all()


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def register_onu(request, olt_pk, pk):
    """Register (provision) an ONU."""
    olt = get_olt_for_user(olt_pk, request.user)
    onu = get_object_or_404(ONU, pk=pk, olt=olt)

    if onu.status in ('active', 'registered', 'provisioning'):
        return Response({'detail': f'ONU is already {onu.status}.'}, status=400)

    serializer = ONURegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    vlan_id_param = serializer.validated_data.get('vlan_id')
    description = serializer.validated_data.get('description', '')
    service_profile = serializer.validated_data.get('service_profile', '')
    line_profile_id = serializer.validated_data.get('line_profile_id', 1)
    srv_profile_id = serializer.validated_data.get('srv_profile_id', 1)

    # Resolve VLAN
    vlan_db_id = None
    if vlan_id_param:
        try:
            vlan_obj = VLAN.objects.get(olt=olt, vlan_id=vlan_id_param)
            onu.vlan = vlan_obj
            vlan_db_id = vlan_obj.id
        except VLAN.DoesNotExist:
            return Response(
                {'detail': f'VLAN {vlan_id_param} does not exist on this OLT. Create it first.'},
                status=400
            )

    if description:
        onu.description = description
    if service_profile:
        onu.service_profile = service_profile
    onu.save()

    def _provision():
        provisioning_service.provision_onu(
            onu.id,
            vlan_id=vlan_id_param,
            line_profile_id=line_profile_id,
            srv_profile_id=srv_profile_id,
        )

    thread = threading.Thread(target=_provision, daemon=True)
    thread.start()

    return Response({'detail': 'ONU provisioning started.', 'onu_id': onu.id})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def onu_provisioning_logs(request, olt_pk, pk):
    """Get provisioning logs for an ONU."""
    olt = get_olt_for_user(olt_pk, request.user)
    onu = get_object_or_404(ONU, pk=pk, olt=olt)
    logs = onu.provisioning_logs.all().order_by('created_at')
    serializer = ProvisioningLogSerializer(logs, many=True)
    return Response({
        'onu_id': onu.id,
        'status': onu.status,
        'logs': serializer.data,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bulk_register_onus(request, olt_pk):
    """
    Register multiple unregistered ONUs at once.
    Body: { onu_ids: [1,2,3], vlan_id: 100, description: '' }
    Spawns a provisioning thread for each ONU.
    """
    olt = get_olt_for_user(olt_pk, request.user)

    onu_ids = request.data.get('onu_ids', [])
    vlan_id_param = request.data.get('vlan_id')
    description = request.data.get('description', '')

    if not onu_ids or not isinstance(onu_ids, list):
        return Response({'detail': 'onu_ids must be a non-empty list.'}, status=400)

    # Resolve VLAN upfront
    vlan_obj = None
    if vlan_id_param:
        try:
            vlan_obj = VLAN.objects.get(olt=olt, vlan_id=vlan_id_param)
        except VLAN.DoesNotExist:
            return Response(
                {'detail': f'VLAN {vlan_id_param} does not exist on this OLT. Create it first.'},
                status=400
            )

    started = []
    skipped = []

    for onu_id in onu_ids:
        try:
            onu = ONU.objects.get(pk=onu_id, olt=olt)
        except ONU.DoesNotExist:
            skipped.append({'onu_id': onu_id, 'reason': 'not found'})
            continue

        if onu.status in ('active', 'registered', 'provisioning'):
            skipped.append({'onu_id': onu_id, 'serial': onu.serial_number, 'reason': f'already {onu.status}'})
            continue

        if vlan_obj:
            onu.vlan = vlan_obj
        if description:
            onu.description = description
        onu.save()

        def _provision(oid=onu.id):
            provisioning_service.provision_onu(oid, vlan_id=vlan_id_param)

        threading.Thread(target=_provision, daemon=True).start()
        started.append({'onu_id': onu_id, 'serial': onu.serial_number})

    return Response({
        'detail': f'Bulk provisioning started for {len(started)} ONU(s).',
        'started': started,
        'skipped': skipped,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def deregister_onu(request, olt_pk, pk):
    """Move ONU back to unregistered status."""
    olt = get_olt_for_user(olt_pk, request.user)
    onu = get_object_or_404(ONU, pk=pk, olt=olt)
    if onu.status == 'provisioning':
        return Response(
            {'detail': 'Cannot deregister while provisioning is in progress.'},
            status=400
        )
    onu.status = 'unregistered'
    onu.registered_at = None
    onu.vlan = None
    onu.save(update_fields=['status', 'registered_at', 'vlan'])
    return Response({'detail': 'ONU deregistered.', 'onu_id': onu.id})
