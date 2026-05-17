import socket
import threading
from django.db.models import Count, Q
from rest_framework import status, generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import OLT, SetupLog, OLTPort
from .serializers import OLTSerializer, OLTCreateSerializer, SetupLogSerializer, OLTPortSerializer
from services import provisioning_service


class OLTListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return OLTCreateSerializer
        return OLTSerializer

    def get_queryset(self):
        return OLT.objects.filter(user=self.request.user).annotate(
            _onu_count=Count('onus', distinct=True),
            _registered_onu_count=Count(
                'onus',
                filter=Q(onus__status__in=('registered', 'active')),
                distinct=True,
            ),
        )

    def perform_create(self, serializer):
        olt = serializer.save(user=self.request.user)
        provisioning_service.start_olt_setup_async(olt.id)
        return olt

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        olt = self.perform_create(serializer)
        if olt.connection_type == 'vpn' and olt.wg_client_public_key:
            from services import wireguard_service
            wireguard_service.add_peer(olt)
        output = OLTSerializer(olt, context={'request': request})
        headers = self.get_success_headers(output.data)
        return Response(output.data, status=status.HTTP_201_CREATED, headers=headers)


class OLTDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return OLTCreateSerializer
        return OLTSerializer

    def get_queryset(self):
        return OLT.objects.filter(user=self.request.user)

    def perform_destroy(self, instance):
        if instance.connection_type == 'vpn' and instance.wg_client_public_key:
            from services import wireguard_service
            wireguard_service.remove_peer(instance.wg_client_public_key)
        instance.delete()

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(
            instance, data=request.data, partial=partial,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        old_pubkey = instance.wg_client_public_key
        olt = serializer.save()
        if olt.connection_type == 'vpn':
            from services import wireguard_service
            if old_pubkey and old_pubkey != olt.wg_client_public_key:
                wireguard_service.remove_peer(old_pubkey)
            if olt.wg_client_public_key:
                wireguard_service.add_peer(olt)
        output = OLTSerializer(olt, context={'request': request})
        return Response(output.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def trigger_setup(request, pk):
    """Trigger OLT setup workflow (async)."""
    olt = get_object_or_404(OLT, pk=pk, user=request.user)
    if olt.status == 'configuring':
        return Response({'detail': 'Setup already in progress.'}, status=400)
    provisioning_service.start_olt_setup_async(olt.id)
    return Response({'detail': 'Setup started.', 'olt_id': olt.id})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def setup_logs(request, pk):
    """Get setup logs for an OLT."""
    olt = get_object_or_404(OLT, pk=pk, user=request.user)
    logs = olt.setup_logs.all().order_by('created_at')
    serializer = SetupLogSerializer(logs, many=True)
    return Response({
        'olt_id': olt.id,
        'status': olt.status,
        'logs': serializer.data,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def poll_olt(request, pk):
    """Trigger SNMP poll for ONU discovery."""
    olt = get_object_or_404(OLT, pk=pk, user=request.user)

    def _poll():
        provisioning_service.poll_olt_onus(olt.id)

    thread = threading.Thread(target=_poll, daemon=True)
    thread.start()
    return Response({'detail': 'Poll started.'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def olt_stats(request, pk):
    """Get OLT statistics."""
    olt = get_object_or_404(OLT, pk=pk, user=request.user)
    onus = olt.onus.all()
    return Response({
        'olt_id': olt.id,
        'status': olt.status,
        'total_onus': onus.count(),
        'active_onus': onus.filter(status='active').count(),
        'offline_onus': onus.filter(status='offline').count(),
        'unregistered_onus': onus.filter(status='unregistered').count(),
        'registered_onus': onus.filter(status__in=('registered', 'active')).count(),
        'last_polled': olt.last_polled,
    })


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def olt_ports(request, pk):
    """GET: list saved ports. POST: re-discover ports via SNMP and save."""
    olt = get_object_or_404(OLT, pk=pk, user=request.user)

    if request.method == 'POST':
        from services import snmp_service
        from services.provisioning_service import _connect_ip
        discovered = snmp_service.discover_ports_snmp(
            host=_connect_ip(olt),
            community=olt.snmp_read_community,
            version=olt.snmp_version,
        )
        for p in discovered:
            # Count ONUs on this PON port
            onu_count = 0
            if p['port_type'] == 'pon':
                onu_count = olt.onus.filter(pon_port__icontains=p['name']).count()
            OLTPort.objects.update_or_create(
                olt=olt, if_index=p['if_index'],
                defaults={**p, 'onu_count': onu_count},
            )
        ports = olt.ports.all()
        return Response({'count': ports.count(), 'ports': OLTPortSerializer(ports, many=True).data})

    ports = olt.ports.all()
    return Response({'count': ports.count(), 'ports': OLTPortSerializer(ports, many=True).data})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def test_snmp(request, pk):
    """
    Diagnostic endpoint — tests SNMP connectivity step by step and returns
    detailed results so the user can see exactly what is failing.
    """
    from services import snmp_service

    from services.provisioning_service import _connect_ip
    olt = get_object_or_404(OLT, pk=pk, user=request.user)
    connect_ip = _connect_ip(olt)
    checks = []

    # 1. ICMP-free reachability: attempt a TCP connection to the Telnet port (23)
    # UDP port 161 cannot be reliably probed (connectionless) so we use Telnet port
    # if enabled, otherwise skip and let the SNMP GET below prove connectivity.
    if olt.telnet_enabled:
        try:
            s = socket.create_connection((connect_ip, olt.telnet_port), timeout=3)
            s.close()
            checks.append({'check': 'network_reach', 'ok': True,
                            'detail': f'TCP {connect_ip}:{olt.telnet_port} is reachable'})
        except Exception as e:
            checks.append({'check': 'network_reach', 'ok': False,
                            'detail': f'TCP {connect_ip}:{olt.telnet_port} unreachable — {e}'})

    # 2. SNMP GET sysDescr with read community
    snmp_result = snmp_service.validate_snmp_connectivity(
        host=connect_ip,
        community=olt.snmp_read_community,
        version=olt.snmp_version,
    )
    checks.append({
        'check': 'snmp_read',
        'ok': snmp_result['connected'],
        'detail': (
            f'sysDescr = {snmp_result["sys_descr"][:120]}' if snmp_result['connected']
            else f'SNMP GET failed: {snmp_result["error"]}'
        ),
        'oid_tested': '1.3.6.1.2.1.1.1.0 (sysDescr)',
        'community_used': olt.snmp_read_community,
        'snmp_version': olt.snmp_version,
    })

    # 3. SNMP write access (if write community set)
    if olt.snmp_write_community:
        write_result = snmp_service.validate_snmp_write_access(
            host=connect_ip,
            write_community=olt.snmp_write_community,
            version=olt.snmp_version,
        )
        checks.append({
            'check': 'snmp_write',
            'ok': write_result['writable'],
            'detail': (
                'Write access confirmed' if write_result['writable']
                else f'Write failed: {write_result["error"]}'
            ),
            'community_used': olt.snmp_write_community,
        })
    else:
        checks.append({'check': 'snmp_write', 'ok': None,
                        'detail': 'No write community configured — skipped'})

    # 4. Telnet port reachability (if enabled)
    if olt.telnet_enabled:
        try:
            s = socket.create_connection((connect_ip, olt.telnet_port), timeout=4)
            s.close()
            checks.append({'check': 'telnet_port', 'ok': True,
                            'detail': f'TCP {connect_ip}:{olt.telnet_port} is open'})
        except Exception as e:
            checks.append({'check': 'telnet_port', 'ok': False,
                            'detail': f'TCP {connect_ip}:{olt.telnet_port} refused — {e}'})

    overall_ok = all(c['ok'] for c in checks if c['ok'] is not None)
    return Response({
        'olt_id': olt.id,
        'olt_name': olt.name,
        'ip_address': olt.ip_address,
        'overall': 'pass' if overall_ok else 'fail',
        'checks': checks,
        'hint': (
            'All checks passed — OLT is reachable and SNMP is working.' if overall_ok else
            'One or more checks failed. Common causes: '
            '(1) Wrong IP or OLT is offline, '
            '(2) Firewall blocking UDP 161, '
            '(3) Wrong SNMP community string, '
            '(4) SNMP agent not enabled on the OLT device itself.'
        ),
    })


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def wg_info(request, pk):
    """
    GET: Return WireGuard connection info for this OLT (server pubkey, endpoint, peer status).
    POST: Update client public key + subnet, then sync WireGuard peer.
    """
    from services import wireguard_service
    olt = get_object_or_404(OLT, pk=pk, user=request.user)

    if olt.connection_type != 'vpn':
        return Response({'detail': 'This OLT is not configured for VPN (WireGuard).'}, status=400)

    if request.method == 'POST':
        old_pubkey = olt.wg_client_public_key
        new_pubkey = request.data.get('wg_client_public_key', '').strip()
        new_subnet = request.data.get('wg_client_subnet', '').strip()

        if old_pubkey and old_pubkey != new_pubkey:
            wireguard_service.remove_peer(old_pubkey)

        olt.wg_client_public_key = new_pubkey
        olt.wg_client_subnet = new_subnet
        olt.save(update_fields=['wg_client_public_key', 'wg_client_subnet'])

        if new_pubkey:
            success, msg = wireguard_service.add_peer(olt)
            if not success:
                return Response({'error': msg}, status=400)

    info = wireguard_service.get_wg_info(olt)
    return Response(info)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sync_profiles(request, pk):
    """
    Re-read ONU line + service profiles from the OLT and cache them.
    Used so ONU registration can auto-pick a valid profile ID without
    the user having to know what IDs exist on the device.
    """
    olt = get_object_or_404(OLT, pk=pk, user=request.user)
    result = provisioning_service.sync_profiles_from_olt(olt.id)
    if not result.get('success'):
        return Response(
            {'detail': result.get('error') or 'Profile sync failed', **result},
            status=400,
        )
    return Response(result)
