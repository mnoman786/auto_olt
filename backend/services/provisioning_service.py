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


def _make_terminal_logger(olt):
    """Return a callback that saves raw telnet I/O as terminal logs."""
    def on_io(direction: str, text: str):
        clean = text.strip()
        if not clean:
            return
        if direction == 'send':
            _create_log(olt, 'telnet_terminal', f'> {clean}', 'info')
        elif direction == 'auto':
            # Auto-credential response — shown as a warning so UI can highlight it
            _create_log(olt, 'telnet_terminal', clean, 'warning')
        else:
            _create_log(olt, 'telnet_terminal', clean, 'success')
    return on_io


def _create_prov_log(onu, step: str, message: str, level: str = 'info'):
    """Helper to create a ProvisioningLog entry."""
    from apps.onus.models import ProvisioningLog
    ProvisioningLog.objects.create(onu=onu, step=step, message=message, level=level)


def run_olt_setup(olt_id: int) -> None:
    """
    Full OLT setup workflow. Intended to run in a background thread.
    Steps:
      1. Telnet login and verify CLI (if telnet_enabled)
      2. Create management user via Telnet (if telnet_enabled)
      3. Configure SNMP communities via Telnet (if telnet_enabled)
      4. Validate SNMP connectivity (read)
      5. Verify SNMP write access (if write community provided)
      6. Fetch system information
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

    # Step 1: Telnet-first setup
    if olt.telnet_enabled:
        _create_log(olt, 'telnet_connect', f'Connecting via Telnet to {olt.ip_address}:{olt.telnet_port}...', 'info')

        terminal_log = _make_terminal_logger(olt)
        success, message, client = telnet_service.telnet_login(
            host=olt.ip_address,
            username=(
                olt.olt_admin_username
                or olt.telnet_username
                or settings.DEFAULT_TELNET_USERNAME
            ),
            password=(
                olt.olt_admin_password
                or olt.telnet_password
                or settings.DEFAULT_TELNET_PASSWORD
            ),
            port=olt.telnet_port,
            on_io=terminal_log,
        )

        if not success:
            _create_log(olt, 'telnet_connect', f'Telnet login FAILED: {message}', 'error')
            olt.status = 'error'
            olt.save(update_fields=['status'])
            return
        else:
            _create_log(olt, 'telnet_connect', f'Telnet login: OK - {message}', 'success')

            try:
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
            finally:
                client.disconnect()
    else:
        _create_log(olt, 'telnet_skip', 'Telnet disabled - skipping CLI configuration', 'info')

    # Step 2: SNMP read connectivity (after Telnet configuration)
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

    # Step 3: SNMP write access
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

    # Step 4: Update system info
    olt.system_name = snmp_result.get('sys_name', '')
    olt.system_description = snmp_result.get('sys_descr', '')[:500]
    olt.system_uptime = snmp_result.get('sys_uptime', '')
    olt.save(update_fields=['system_name', 'system_description', 'system_uptime'])
    _create_log(olt, 'sys_info',
                f'System: {olt.system_name or "Unknown"} | Uptime: {olt.system_uptime or "N/A"}',
                'success')

    # Done
    olt.status = 'active'
    olt.last_polled = timezone.now()
    olt.save(update_fields=['status', 'last_polled'])
    _create_log(olt, 'setup_complete', f'OLT {olt.name} setup complete. Status: ACTIVE', 'success')


def start_olt_setup_async(olt_id: int) -> None:
    """Start OLT setup in a background thread."""
    thread = threading.Thread(target=run_olt_setup, args=(olt_id,), daemon=True)
    thread.start()


def simulate_olt_setup(olt_id: int) -> None:
    """
    Simulated OLT setup — no real network calls.
    Mirrors the real setup steps with artificial delays so the UI behaves identically.
    """
    import time
    from apps.olts.models import OLT

    try:
        olt = OLT.objects.get(id=olt_id)
    except OLT.DoesNotExist:
        return

    olt.status = 'configuring'
    olt.save(update_fields=['status'])
    olt.setup_logs.all().delete()

    def tlog(direction, text):
        _create_log(olt, 'telnet_terminal', f'> {text}' if direction == 'send' else text, 'info' if direction == 'send' else 'success')

    ip = olt.ip_address
    port = olt.telnet_port
    admin = olt.olt_admin_username or 'admin'
    mgmt_user = getattr(settings, 'OLT_MGMT_USER', 'autoolt')
    read_comm = olt.snmp_read_community
    write_comm = olt.snmp_write_community

    _create_log(olt, 'setup_start', f'[SIMULATION] Starting setup for OLT: {olt.name} ({ip})', 'info')
    time.sleep(0.8)

    # Step 1: Telnet connect
    _create_log(olt, 'telnet_connect', f'Connecting via Telnet to {ip}:{port}...', 'info')
    time.sleep(1.2)
    tlog('recv', f'\r\nHuawei Versatile Routing Platform Software\r\nVRP (R) software, Version 5.160 (MA5608T V800R013C00)\r\nCopyright (C) 2000-2018 HUAWEI TECH CO., LTD\r\n\r\nLogin: ')
    time.sleep(0.5)
    tlog('send', admin)
    time.sleep(0.4)
    tlog('recv', f'\r\nPassword: ')
    time.sleep(0.5)
    tlog('auto', f'[auto] password: → ********')
    time.sleep(0.8)
    tlog('recv', f'\r\nInfo: The max number of VTY users is 5, and the number\r\n      of current VTY users on line is 1.\r\n\r\n{admin}>')
    _create_log(olt, 'telnet_connect', f'Telnet login: OK - Authenticated as {admin}', 'success')
    time.sleep(0.5)

    # Step 2: Create management user
    _create_log(olt, 'create_user', f'Creating management user: {mgmt_user}', 'info')
    time.sleep(0.3)
    tlog('send', 'enable')
    time.sleep(0.4)
    tlog('recv', f'Password: ')
    tlog('auto', f'[auto] password: → ********')
    time.sleep(0.3)
    tlog('recv', f'{admin}#')
    tlog('send', 'config')
    time.sleep(0.3)
    tlog('recv', f'Enter system view, return user view with Ctrl+Z.\r\n[~{admin}]')
    tlog('send', 'aaa')
    time.sleep(0.3)
    tlog('recv', f'[~{admin}-aaa]')
    tlog('send', f'local-user {mgmt_user} password irreversible-cipher AutoOlt@123')
    time.sleep(0.5)
    tlog('recv', f'Info: Add a new user.\r\n[*{admin}-aaa]')
    tlog('send', f'local-user {mgmt_user} privilege level 15')
    time.sleep(0.3)
    tlog('recv', f'[*{admin}-aaa]')
    tlog('send', f'local-user {mgmt_user} service-type terminal ssh telnet')
    time.sleep(0.3)
    tlog('recv', f'[*{admin}-aaa]')
    tlog('send', 'quit')
    time.sleep(0.3)
    tlog('recv', f'[*{admin}]')
    _create_log(olt, 'create_user', f'Management user {mgmt_user} created successfully', 'success')
    time.sleep(0.4)

    # Step 3: Configure SNMP
    _create_log(olt, 'configure_snmp', 'Configuring SNMP via CLI...', 'info')
    tlog('send', f'snmp-agent community read {read_comm}')
    time.sleep(0.5)
    tlog('recv', f'[*{admin}]')
    if write_comm:
        tlog('send', f'snmp-agent community write {write_comm}')
        time.sleep(0.5)
        tlog('recv', f'[*{admin}]')
    tlog('send', 'snmp-agent')
    time.sleep(0.3)
    tlog('recv', f'[*{admin}]')
    tlog('send', 'quit')
    time.sleep(0.3)
    tlog('recv', f'[~{admin}]')
    tlog('send', 'save')
    time.sleep(0.8)
    tlog('recv', f'Warning: The current configuration will be written to the device.\r\nAre you sure to continue?[Y/N]')
    tlog('send', 'Y')
    time.sleep(1.0)
    tlog('recv', f'Info: The configuration is saved to the device successfully.\r\n[~{admin}]')
    _create_log(olt, 'configure_snmp', f'SNMP community "{read_comm}" configured', 'success')
    time.sleep(0.4)

    # Step 4: SNMP connectivity check
    _create_log(olt, 'snmp_check', f'Testing SNMP connectivity to {ip}...', 'info')
    time.sleep(1.5)
    _create_log(olt, 'snmp_check', 'SNMP read connectivity: OK', 'success')
    time.sleep(0.4)

    # Step 5: SNMP write access
    if write_comm:
        _create_log(olt, 'snmp_write', 'Verifying SNMP write access...', 'info')
        time.sleep(1.0)
        _create_log(olt, 'snmp_write', 'SNMP write access: OK', 'success')
    else:
        _create_log(olt, 'snmp_write', 'No SNMP write community provided (read-only mode)', 'warning')
    time.sleep(0.4)

    # Step 6: System info
    sim_name = f'MA5608T-{olt.name}'
    olt.system_name = sim_name
    olt.system_description = 'Huawei MA5608T GPON OLT (Simulated)'
    olt.system_uptime = '0 days, 0:00:00'
    olt.save(update_fields=['system_name', 'system_description', 'system_uptime'])
    _create_log(olt, 'sys_info', f'System: {sim_name} | Uptime: 0 days, 0:00:00', 'success')
    time.sleep(0.5)

    # Done
    olt.status = 'active'
    olt.last_polled = timezone.now()
    olt.save(update_fields=['status', 'last_polled'])
    _create_log(olt, 'setup_complete', f'[SIMULATION] OLT {olt.name} setup complete. Status: ACTIVE', 'success')


def start_simulate_setup_async(olt_id: int) -> None:
    """Start simulated OLT setup in a background thread."""
    thread = threading.Thread(target=simulate_olt_setup, args=(olt_id,), daemon=True)
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
            username=(
                olt.olt_admin_username
                or olt.telnet_username
                or settings.DEFAULT_TELNET_USERNAME
            ),
            password=(
                olt.olt_admin_password
                or olt.telnet_password
                or settings.DEFAULT_TELNET_PASSWORD
            ),
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
