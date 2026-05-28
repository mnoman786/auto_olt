from rest_framework import status, generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db.models import Q
from apps.olts.models import OLT
from apps.vlans.models import VLAN
from .models import ONU, ProvisioningLog
from .serializers import ONUSerializer, ONURegisterSerializer, ProvisioningLogSerializer
from services import provisioning_service


def get_olt_for_user(pk, user):
    if user.is_staff or user.is_superuser:
        return get_object_or_404(OLT, pk=pk)
    return get_object_or_404(OLT, pk=pk, user=user)


class ONUListView(generics.ListAPIView):
    serializer_class = ONUSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        olt = get_olt_for_user(self.kwargs['olt_pk'], self.request.user)
        status_filter = self.request.query_params.get('status')
        search = self.request.query_params.get('search', '').strip()
        qs = olt.onus.select_related('vlan').all()
        if status_filter:
            if status_filter == 'registered':
                qs = qs.filter(status__in=('registered', 'active'))
            elif status_filter == 'unregistered':
                qs = qs.filter(status='unregistered')
            else:
                qs = qs.filter(status=status_filter)
        if search:
            qs = qs.filter(
                Q(serial_number__icontains=search) |
                Q(description__icontains=search) |
                Q(pon_port__icontains=search)
            )
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
    from apps.plans.limits import check_onu_limit
    olt = get_olt_for_user(olt_pk, request.user)
    onu = get_object_or_404(ONU, pk=pk, olt=olt)

    if onu.status in ('active', 'registered', 'provisioning'):
        return Response({'detail': f'ONU is already {onu.status}.'}, status=400)

    allowed, current, limit = check_onu_limit(request.user)
    if not allowed:
        return Response(
            {
                'detail': f'ONU limit reached. Your plan allows {limit} registered ONU(s). '
                          f'Upgrade to register more.',
                'code': 'onu_limit_reached',
                'current': current,
                'limit': limit,
            },
            status=status.HTTP_402_PAYMENT_REQUIRED,
        )

    serializer = ONURegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    vlan_id_param = serializer.validated_data.get('vlan_id')
    description = serializer.validated_data.get('description', '')
    service_profile = serializer.validated_data.get('service_profile', '')

    # Use OLT's auto-discovered profile IDs unless the caller explicitly overrides.
    default_line, default_srv = provisioning_service.pick_default_profile_ids(olt)
    line_profile_id = serializer.validated_data.get('line_profile_id') or default_line
    srv_profile_id = serializer.validated_data.get('srv_profile_id') or default_srv

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

    from tasks import provision_onu_task
    provision_onu_task.delay(
        onu.id,
        vlan_id=vlan_id_param,
        line_profile_id=line_profile_id,
        srv_profile_id=srv_profile_id,
    )

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

        line_pid, srv_pid = provisioning_service.pick_default_profile_ids(olt)

        from tasks import provision_onu_task
        provision_onu_task.delay(
            onu.id,
            vlan_id=vlan_id_param,
            line_profile_id=line_pid,
            srv_profile_id=srv_pid,
        )
        started.append({'onu_id': onu_id, 'serial': onu.serial_number})

    return Response({
        'detail': f'Bulk provisioning started for {len(started)} ONU(s).',
        'started': started,
        'skipped': skipped,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reboot_onu(request, olt_pk, pk):
    """Reboot an ONU via Telnet CLI."""
    olt = get_olt_for_user(olt_pk, request.user)
    onu = get_object_or_404(ONU, pk=pk, olt=olt)

    if onu.status not in ('active', 'registered', 'offline'):
        return Response(
            {'detail': f'Cannot reboot ONU with status "{onu.status}".'},
            status=400
        )

    result = provisioning_service.reboot_onu(onu.id)
    if result['success']:
        return Response({'detail': result['message']})
    return Response({'detail': result['message']}, status=400)


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


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def onu_signal_history(request, olt_pk, pk):
    """Return Rx power samples for an ONU. ?hours=24 (default 24, max 168)."""
    from .models import SignalSample
    olt = get_olt_for_user(olt_pk, request.user)
    onu = get_object_or_404(ONU, pk=pk, olt=olt)
    hours = min(int(request.query_params.get('hours', 24)), 168)
    from django.utils import timezone
    from datetime import timedelta
    since = timezone.now() - timedelta(hours=hours)
    samples = (
        SignalSample.objects
        .filter(onu=onu, timestamp__gte=since)
        .order_by('timestamp')
        .values('timestamp', 'rx_power')
    )
    return Response({
        'onu_id': onu.id,
        'serial_number': onu.serial_number,
        'pon_port': onu.pon_port,
        'current_signal': onu.signal_strength,
        'hours': hours,
        'samples': [{'t': s['timestamp'].isoformat(), 'rx_power': s['rx_power']} for s in samples],
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bulk_reboot_onus(request, olt_pk):
    """Reboot multiple ONUs. Body: { onu_ids: [1,2,3] }"""
    olt = get_olt_for_user(olt_pk, request.user)
    onu_ids = request.data.get('onu_ids', [])
    if not onu_ids or not isinstance(onu_ids, list):
        return Response({'detail': 'onu_ids must be a non-empty list.'}, status=400)

    started, skipped = [], []
    for onu_id in onu_ids:
        try:
            onu = ONU.objects.get(pk=onu_id, olt=olt)
        except ONU.DoesNotExist:
            skipped.append({'onu_id': onu_id, 'reason': 'not found'})
            continue
        if onu.status not in ('active', 'registered', 'offline'):
            skipped.append({'onu_id': onu_id, 'serial': onu.serial_number, 'reason': f'status is {onu.status}'})
            continue
        from tasks import reboot_onu_task
        reboot_onu_task.delay(onu.id)
        started.append({'onu_id': onu_id, 'serial': onu.serial_number})

    return Response({
        'detail': f'Reboot queued for {len(started)} ONU(s).',
        'started': started,
        'skipped': skipped,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_onus_csv(request, olt_pk):
    """Download all ONUs for an OLT as CSV."""
    import csv
    from django.http import StreamingHttpResponse

    olt = get_olt_for_user(olt_pk, request.user)
    onus = (
        ONU.objects.filter(olt=olt)
        .select_related('vlan')
        .order_by('pon_port', 'onu_index')
    )

    def rows():
        yield ['Serial Number', 'MAC Address', 'PON Port', 'ONU Index', 'Status',
               'Signal (dBm)', 'VLAN', 'Description', 'Last Seen', 'Registered At']
        for o in onus:
            yield [
                o.serial_number, o.mac_address, o.pon_port, o.onu_index,
                o.status, o.signal_strength or '',
                f'{o.vlan.vlan_id} {o.vlan.name}' if o.vlan else '',
                o.description,
                o.last_seen.isoformat() if o.last_seen else '',
                o.registered_at.isoformat() if o.registered_at else '',
            ]

    class Echo:
        def write(self, value): return value

    writer = csv.writer(Echo())
    response = StreamingHttpResponse(
        (writer.writerow(r) for r in rows()),
        content_type='text/csv',
    )
    response['Content-Disposition'] = f'attachment; filename="onus_{olt.name}.csv"'
    return response


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def onu_search(request):
    """Global ONU search across all OLTs the user owns. Used for customer assignment."""
    q = request.query_params.get('search', '').strip()
    if not q or len(q) < 2:
        return Response([])

    user = request.user
    if user.is_staff or user.is_superuser:
        qs = ONU.objects.select_related('olt', 'customer').filter(serial_number__icontains=q)
    else:
        qs = ONU.objects.select_related('olt', 'customer').filter(
            olt__user=user, serial_number__icontains=q
        )

    # Exclude already-assigned ONUs (except possibly the one already on this customer)
    exclude_assigned = request.query_params.get('exclude_assigned', '1')
    current_onu = request.query_params.get('current_onu')
    if exclude_assigned == '1':
        qs = qs.filter(Q(customer__isnull=True) | Q(id=current_onu) if current_onu else Q(customer__isnull=True))

    results = []
    for onu in qs[:10]:
        results.append({
            'id': onu.id,
            'serial_number': onu.serial_number,
            'pon_port': onu.pon_port,
            'status': onu.status,
            'olt_name': onu.olt.name,
            'olt_id': onu.olt.id,
            'has_customer': hasattr(onu, 'customer') and onu.customer is not None,
        })
    return Response(results)
