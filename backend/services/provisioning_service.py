"""
Provisioning Service - orchestrates OLT setup and ONU provisioning.
Implements the full setup workflow and SNMP-first hybrid provisioning logic.
"""
import logging
import threading
from typing import Optional, Dict, Any, List
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


def _create_log(olt, step: str, message: str, level: str = 'info'):
    """Helper to create a SetupLog entry."""
    from apps.olts.models import SetupLog
    SetupLog.objects.create(olt=olt, step=step, message=message, level=level)
    logger.info(f"[OLT:{olt.id}] [{level.upper()}] {step}: {message}")


def _create_prov_log(onu, step: str, message: str, level: str = 'info'):
    """Helper to create a ProvisioningLog entry."""
    from apps.onus.models import ProvisioningLog
    ProvisioningLog.objects.create(onu=onu, step=step, message=message, level=level)


def run_olt_setup(olt_id: int) -> None:
    """
    Full OLT setup workflow. Intended to run in a background thread.
    Steps:
      1. Validate SNMP connectivity (read)
      2. Verify SNMP write access (if write community provided)
      3. Fetch system information
      4. Telnet login and verify CLI (if telnet_enabled)
      5. Configure SNMP communities via Telnet (if telnet_enabled)
      6. Create management user (if telnet_enabled)
      7. Mark OLT as active
    """
    from apps.olts.models import OLT
    from services import snmp_service, telnet_service

    try:
        olt = OLT.objects.get(id=olt_id)
    except OLT.DoesNotExist:
        logger.error(f"OLT {olt_id} not found for setup")
        return

    olt.status = 'configuring'
    olt.save(update_fields=['status'])
    olt.setup_logs.all().delete()

    _create_log(olt, 'setup_start', f'Starting setup for OLT: {olt.name} ({olt.ip_address})', 'info')

    # Step 1: SNMP read connectivity
    _create_log(olt, 'snmp_check', f'Testing SNMP connectivity to {olt.ip_address}...', 'info')
    snmp_result = snmp_service.validate_snmp_connectivity(
        host=olt.ip_address,
        community=olt.snmp_read_community,
        version=olt.snmp_version,
    )

    if not snmp_result['connected']:
        err = snmp_result.get('error', 'Unknown error')
        _create_log(olt, 'snmp_check', f'SNMP connectivity FAILED: {err}', 'error')
        olt.status = 'error'
        olt.save(update_fields=['status'])
        return

    _create_log(olt, 'snmp_check', 'SNMP read connectivity: OK', 'success')

    # Update system info
    olt.system_name = snmp_result.get('sys_name', '')
    olt.system_description = snmp_result.get('sys_descr', '')[:500]
    olt.system_uptime = snmp_result.get('sys_uptime', '')
    olt.save(update_fields=['system_name', 'system_description', 'system_uptime'])
    _create_log(olt, 'sys_info',
                f'System: {olt.system_name or "Unknown"} | Uptime: {olt.system_uptime or "N/A"}',
                'info')

    # Step 2: SNMP write access
    if olt.snmp_write_community:
        _create_log(olt, 'snmp_write', 'Verifying SNMP write access...', 'info')
        write_result = snmp_service.validate_snmp_write_access(
            host=olt.ip_address,
            write_community=olt.snmp_write_community,
            version=olt.snmp_version,
        )
        if write_result['writable']:
            _create_log(olt, 'snmp_write', 'SNMP write access: OK', 'success')
        else:
            _create_log(olt, 'snmp_write',
                        f'SNMP write access WARNING: {write_result.get("error", "Not writable")}',
                        'warning')
    else:
        _create_log(olt, 'snmp_write', 'No SNMP write community provided (read-only mode)', 'warning')

    # Step 3: Telnet setup
    if olt.telnet_enabled:
        _create_log(olt, 'telnet_connect', f'Connecting via Telnet to {olt.ip_address}:{olt.telnet_port}...', 'info')

        success, message, client = telnet_service.telnet_login(
            host=olt.ip_address,
            username=olt.telnet_username or settings.DEFAULT_TELNET_USERNAME,
            password=olt.telnet_password or settings.DEFAULT_TELNET_PASSWORD,
            port=olt.telnet_port,
        )

        if not success:
            _create_log(olt, 'telnet_connect', f'Telnet login FAILED: {message}', 'warning')
            _create_log(olt, 'telnet_connect', 'Continuing with SNMP-only mode', 'info')
        else:
            _create_log(olt, 'telnet_connect', f'Telnet login: OK - {message}', 'success')

            try:
                # Configure SNMP via CLI
                _create_log(olt, 'configure_snmp', 'Configuring SNMP via CLI...', 'info')
                snmp_cfg = telnet_service.telnet_configure_snmp(
                    client=client,
                    read_community=olt.snmp_read_community,
                    write_community=olt.snmp_write_community,
                )
                for step in snmp_cfg.get('steps', []):
                    _create_log(olt, step['step'], step['message'],
                                'success' if step.get('success') else 'warning')

                # Create management user
                mgmt_user = settings.OLT_MGMT_USER
                mgmt_pass = settings.OLT_MGMT_PASSWORD
                mgmt_priv = settings.OLT_MGMT_PRIVILEGE
                _create_log(olt, 'create_user', f'Creating management user: {mgmt_user}', 'info')
                user_result = telnet_service.telnet_create_mgmt_user(
                    client=client,
                    username=mgmt_user,
                    password=mgmt_pass,
                    privilege=mgmt_priv,
                )
                if user_result['success']:
                    _create_log(olt, 'create_user', f'Management user {mgmt_user} created', 'success')
                else:
                    _create_log(olt, 'create_user',
                                f'Could not create user {mgmt_user} (may already exist)', 'warning')
            finally:
                client.disconnect()
    else:
        _create_log(olt, 'telnet_skip', 'Telnet disabled - skipping CLI configuration', 'info')

    # Done
    olt.status = 'active'
    olt.last_polled = timezone.now()
    olt.save(update_fields=['status', 'last_polled'])
    _create_log(olt, 'setup_complete', f'OLT {olt.name} setup complete. Status: ACTIVE', 'success')


def start_olt_setup_async(olt_id: int) -> None:
    """Start OLT setup in a background thread."""
    thread = threading.Thread(target=run_olt_setup, args=(olt_id,), daemon=True)
    thread.start()


def poll_olt_onus(olt_id: int) -> Dict[str, Any]:
    """
    Poll OLT via SNMP to discover and update ONUs.
    Returns summary of discovered/updated ONUs.
    """
    from apps.olts.models import OLT
    from apps.onus.models import ONU
    from services import snmp_service

    result = {'discovered': 0, 'new': 0, 'updated': 0, 'error': None}

    try:
        olt = OLT.objects.get(id=olt_id)
    except OLT.DoesNotExist:
        result['error'] = f'OLT {olt_id} not found'
        return result

    if olt.status not in ('active', 'offline'):
        result['error'] = f'OLT {olt.name} is not active (status: {olt.status})'
        return result

    discovered_onus = snmp_service.discover_onus_snmp(
        host=olt.ip_address,
        community=olt.snmp_read_community,
        version=olt.snmp_version,
    )

    result['discovered'] = len(discovered_onus)

    for onu_data in discovered_onus:
        serial = onu_data.get('serial_number', '').strip()
        if not serial:
            continue

        signal = snmp_service.get_onu_signal_strength(
            host=olt.ip_address,
            community=olt.snmp_read_community,
            onu_index=onu_data.get('onu_index', 0),
            version=olt.snmp_version,
        )
        onu_data['signal_strength'] = signal

        onu, created = ONU.objects.get_or_create(
            olt=olt,
            serial_number=serial,
            defaults={
                'pon_port': onu_data.get('pon_port', ''),
                'onu_index': onu_data.get('onu_index', 0),
                'status': 'unregistered',
                'signal_strength': signal,
                'last_seen': timezone.now(),
            }
        )

        if created:
            result['new'] += 1
        else:
            # Update existing ONU
            update_fields = ['last_seen', 'signal_strength', 'updated_at']
            onu.last_seen = timezone.now()
            if signal is not None:
                onu.signal_strength = signal
            if not onu.pon_port and onu_data.get('pon_port'):
                onu.pon_port = onu_data['pon_port']
                update_fields.append('pon_port')
            # Mark active if was offline and just seen
            if onu.status == 'offline' and onu.registered_at:
                onu.status = 'active'
                update_fields.append('status')
            onu.save(update_fields=update_fields)
            result['updated'] += 1

    # Update OLT last_polled
    olt.last_polled = timezone.now()
    olt.status = 'active'
    olt.save(update_fields=['last_polled', 'status'])

    return result


def provision_onu(onu_id: int, vlan_id: Optional[int] = None) -> Dict[str, Any]:
    """
    Provision an ONU using the configured method (snmp/telnet/hybrid).
    Returns result dict with success, method_used, steps, error.
    """
    from apps.onus.models import ONU
    from apps.olts.models import OLT
    from services import snmp_service, telnet_service

    result = {'success': False, 'method_used': None, 'steps': [], 'error': None}

    try:
        onu = ONU.objects.select_related('olt', 'vlan').get(id=onu_id)
    except ONU.DoesNotExist:
        result['error'] = f'ONU {onu_id} not found'
        return result

    olt = onu.olt
    method = settings.ONU_REGISTER_METHOD  # 'snmp', 'telnet', or 'hybrid'
    effective_vlan = vlan_id or (onu.vlan.vlan_id if onu.vlan else 0)

    onu.status = 'provisioning'
    onu.save(update_fields=['status'])
    _create_prov_log(onu, 'start', f'Starting ONU provisioning via {method} method', 'info')

    def try_snmp() -> Dict[str, Any]:
        if not olt.snmp_write_community:
            return {'success': False, 'error': 'No SNMP write community configured', 'steps': []}
        _create_prov_log(onu, 'snmp_provision', 'Attempting SNMP provisioning...', 'info')
        res = snmp_service.snmp_provision_onu(
            host=olt.ip_address,
            write_community=olt.snmp_write_community,
            onu_index=onu.onu_index,
            vlan_id=effective_vlan,
            version=olt.snmp_version,
        )
        return res

    def try_telnet() -> Dict[str, Any]:
        if not olt.telnet_enabled:
            return {'success': False, 'error': 'Telnet not enabled on this OLT', 'steps': []}
        _create_prov_log(onu, 'telnet_provision', 'Attempting Telnet provisioning...', 'info')
        success, message, client = telnet_service.telnet_login(
            host=olt.ip_address,
            username=olt.telnet_username or settings.DEFAULT_TELNET_USERNAME,
            password=olt.telnet_password or settings.DEFAULT_TELNET_PASSWORD,
            port=olt.telnet_port,
        )
        if not success:
            return {'success': False, 'error': f'Telnet login failed: {message}', 'steps': []}
        try:
            res = telnet_service.telnet_provision_onu(
                client=client,
                onu_serial=onu.serial_number,
                pon_port=onu.pon_port,
                vlan_id=effective_vlan,
                onu_id=onu.onu_id or 1,
            )
        finally:
            client.disconnect()
        return res

    prov_result = None

    if method == 'snmp':
        prov_result = try_snmp()
        result['method_used'] = 'snmp'
    elif method == 'telnet':
        prov_result = try_telnet()
        result['method_used'] = 'telnet'
    elif method == 'hybrid':
        prov_result = try_snmp()
        result['method_used'] = 'snmp'
        if not prov_result.get('success'):
            _create_prov_log(onu, 'hybrid_fallback',
                             f'SNMP provisioning failed, falling back to Telnet: {prov_result.get("error", "")}',
                             'warning')
            prov_result = try_telnet()
            result['method_used'] = 'telnet'

    if prov_result:
        result['success'] = prov_result.get('success', False)
        result['error'] = prov_result.get('error')
        result['steps'] = prov_result.get('steps', [])

        for step in result['steps']:
            level = 'success' if step.get('success') else 'warning'
            _create_prov_log(onu, step.get('step', 'step'), step.get('message', ''), level)

    if result['success']:
        onu.status = 'active'
        onu.provision_method = result['method_used'] or 'none'
        onu.registered_at = timezone.now()
        onu.save(update_fields=['status', 'provision_method', 'registered_at'])
        _create_prov_log(onu, 'complete', f'ONU {onu.serial_number} successfully provisioned', 'success')
    else:
        onu.status = 'unregistered'
        onu.save(update_fields=['status'])
        _create_prov_log(onu, 'failed',
                         f'ONU provisioning failed: {result.get("error", "Unknown error")}', 'error')

    return result
