"""
Provisioning Service - orchestrates OLT setup and ONU provisioning.
Implements the full setup workflow and SNMP-first hybrid provisioning logic.
"""
import logging
from typing import Optional, Dict, Any, List, Tuple
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


def _connect_ip(olt) -> str:
    """Return the IP the app should use to reach this OLT.
    For VPN OLTs the WireGuard virtual IP is used; for direct OLTs the stored ip_address."""
    if olt.connection_type == 'vpn' and olt.vpn_virtual_ip:
        return olt.vpn_virtual_ip
    return olt.ip_address


def _create_log(olt, step: str, message: str, level: str = 'info'):
    """Helper to create a SetupLog entry."""
    from apps.olts.models import SetupLog
    SetupLog.objects.create(olt=olt, step=step, message=message, level=level)
    logger.info(f"[OLT:{olt.id}] [{level.upper()}] {step}: {message}")


# Cap the number of telnet_terminal rows kept per OLT so a verbose setup or
# a stuck pager can't flood the SetupLog table. Older rows are dropped.
TERMINAL_LOG_MAX_ROWS = 200


def _trim_terminal_logs(olt) -> None:
    """Delete oldest telnet_terminal rows for this OLT beyond the cap."""
    from apps.olts.models import SetupLog
    qs = SetupLog.objects.filter(olt=olt, step='telnet_terminal').order_by('-id')
    # Get the cutoff id (id of the row at position TERMINAL_LOG_MAX_ROWS, if any)
    cutoff = qs.values_list('id', flat=True)[TERMINAL_LOG_MAX_ROWS:TERMINAL_LOG_MAX_ROWS + 1]
    cutoff_id = next(iter(cutoff), None)
    if cutoff_id is not None:
        SetupLog.objects.filter(
            olt=olt, step='telnet_terminal', id__lte=cutoff_id,
        ).delete()


def _redact_credentials(text: str, olt) -> str:
    """Replace OLT credentials with *** in terminal log text."""
    secrets = [
        olt.olt_admin_password,
        olt.snmp_read_community,
        olt.snmp_write_community,
    ]
    from django.conf import settings
    secrets += [
        getattr(settings, 'OLT_MGMT_PASSWORD', ''),
        getattr(settings, 'DEFAULT_TELNET_PASSWORD', ''),
    ]
    for secret in secrets:
        if secret and len(secret) > 2:
            text = text.replace(secret, '***')
    return text


def _make_terminal_logger(olt):
    """Return a callback that saves raw telnet I/O as terminal logs (capped)."""
    write_count = {'n': 0}

    def on_io(direction: str, text: str):
        clean = _redact_credentials(text.strip(), olt)
        if not clean:
            return
        if direction == 'send':
            _create_log(olt, 'telnet_terminal', f'> {clean}', 'info')
        elif direction == 'auto':
            # Auto-credential response — always shown as a masked placeholder
            _create_log(olt, 'telnet_terminal', '[auto-credential sent]', 'warning')
        else:
            _create_log(olt, 'telnet_terminal', clean, 'success')
        # Trim periodically rather than on every write to avoid DB churn
        write_count['n'] += 1
        if write_count['n'] % 50 == 0:
            _trim_terminal_logs(olt)
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

    connect_ip = _connect_ip(olt)
    _create_log(olt, 'setup_start', f'Starting setup for OLT: {olt.name} ({connect_ip})', 'info')

    # Step 1: Telnet-first setup
    if olt.telnet_enabled:
        _create_log(olt, 'telnet_connect', f'Connecting via Telnet to {connect_ip}:{olt.telnet_port}...', 'info')

        terminal_log = _make_terminal_logger(olt)
        success, message, client = telnet_service.telnet_login(
            host=connect_ip,
            username=olt.olt_admin_username or settings.DEFAULT_TELNET_USERNAME,
            password=olt.olt_admin_password or settings.DEFAULT_TELNET_PASSWORD,
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

                # Discover ONU profiles so ONU registration knows which IDs are valid
                _create_log(olt, 'discover_profiles',
                            'Discovering ONU line + service profiles on OLT...', 'info')
                prof_result = telnet_service.telnet_discover_profiles(client)
                if prof_result.get('success'):
                    olt.line_profiles = prof_result['line_profiles']
                    olt.srv_profiles = prof_result['srv_profiles']
                    olt.profiles_last_synced = timezone.now()
                    olt.save(update_fields=['line_profiles', 'srv_profiles',
                                            'profiles_last_synced'])
                    line_ids = [str(p['id']) for p in prof_result['line_profiles']]
                    srv_ids = [str(p['id']) for p in prof_result['srv_profiles']]
                    _create_log(
                        olt, 'discover_profiles',
                        f'Found {len(line_ids)} line profile(s) [{", ".join(line_ids) or "none"}] '
                        f'and {len(srv_ids)} service profile(s) [{", ".join(srv_ids) or "none"}]',
                        'success',
                    )
                else:
                    _create_log(olt, 'discover_profiles',
                                f'Profile discovery: {prof_result.get("error", "unknown error")} '
                                '(ONU registration will fall back to profile ID 1)',
                                'warning')
            finally:
                client.disconnect()
    else:
        _create_log(olt, 'telnet_skip', 'Telnet disabled - skipping CLI configuration', 'info')

    # Step 2: SNMP read connectivity (after Telnet configuration)
    _create_log(olt, 'snmp_check', f'Testing SNMP connectivity to {connect_ip}...', 'info')
    snmp_result = snmp_service.validate_snmp_connectivity(
        host=connect_ip,
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
            host=connect_ip,
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

    # Trim terminal logs to the cap after the noisy setup phase
    _trim_terminal_logs(olt)

    # Auto-discover ONUs on first setup
    _create_log(olt, 'onu_discovery', 'Starting initial ONU discovery via SNMP...', 'info')
    poll_result = poll_olt_onus(olt_id)
    if poll_result.get('error'):
        _create_log(olt, 'onu_discovery', f'ONU discovery warning: {poll_result["error"]}', 'warning')
    else:
        _create_log(olt, 'onu_discovery',
                    f'ONU discovery complete: {poll_result["discovered"]} found, '
                    f'{poll_result["new"]} new, {poll_result["updated"]} updated', 'success')


def start_olt_setup_async(olt_id: int) -> None:
    """Enqueue OLT setup as a Celery task."""
    from tasks import run_olt_setup_task
    run_olt_setup_task.delay(olt_id)


def poll_olt_onus(olt_id: int) -> Dict[str, Any]:
    """
    Poll OLT via SNMP to discover and update ONUs.
    Returns summary of discovered/updated ONUs.

    Optimisations applied:
    - snmp_bulk_walk (GETBULK) fetches ONU table in far fewer PDU round trips
    - All existing ONUs loaded in one DB query, split into create/update batches
    - Django cache used to skip DB writes when ONU state has not changed
    - bulk_create / bulk_update replace per-row get_or_create / save calls
    """
    from apps.olts.models import OLT
    from apps.onus.models import ONU
    from services import snmp_service
    from django.core.cache import cache

    result = {'discovered': 0, 'new': 0, 'updated': 0, 'skipped': 0, 'error': None}

    try:
        olt = OLT.objects.get(id=olt_id)
    except OLT.DoesNotExist:
        result['error'] = f'OLT {olt_id} not found'
        return result

    if olt.status not in ('active', 'offline'):
        result['error'] = f'OLT {olt.name} is not active (status: {olt.status})'
        return result

    connect_ip = _connect_ip(olt)

    snmp_check = snmp_service.validate_snmp_connectivity(
        host=connect_ip,
        community=olt.snmp_read_community,
        version=olt.snmp_version,
    )
    if not snmp_check['connected']:
        result['error'] = snmp_check.get('error') or f'SNMP not responding from {connect_ip}'
        olt.status = 'offline'
        olt.last_polled = timezone.now()
        olt.save(update_fields=['status', 'last_polled'])
        return result

    discovered_onus = snmp_service.discover_onus_snmp(
        host=connect_ip,
        community=olt.snmp_read_community,
        version=olt.snmp_version,
    )

    result['discovered'] = len(discovered_onus)
    if not discovered_onus:
        olt.last_polled = timezone.now()
        olt.status = 'active'
        olt.save(update_fields=['last_polled', 'status'])
        return result

    # Bulk-fetch signal strength and admin state for ALL ONUs in 2 SNMP walks
    # instead of 2 individual GETs per ONU (avoids N*2 round trips).
    OID_RX_POWER   = '1.3.6.1.4.1.2011.6.128.1.1.2.51.1.4'
    OID_ADMIN_STATE= '1.3.6.1.4.1.2011.6.128.1.1.2.43.1.15'

    def _index_walk(oid):
        rows = snmp_service.snmp_bulk_walk(
            connect_ip, olt.snmp_read_community, oid,
            version=olt.snmp_version, max_rows=2000,
        )
        result_map = {}
        for oid_str, val in rows:
            idx = oid_str.split('.')[-1]
            if idx.isdigit():
                result_map[int(idx)] = val
        return result_map

    signal_map = _index_walk(OID_RX_POWER)    # {onu_index: raw_value}
    admin_map  = _index_walk(OID_ADMIN_STATE)  # {onu_index: '0'/'1'}

    # Load all existing ONUs for this OLT in a single query
    existing_map = {
        onu.serial_number: onu
        for onu in ONU.objects.filter(olt=olt)
    }

    now = timezone.now()
    to_create: List[ONU] = []
    to_update: List[ONU] = []

    for onu_data in discovered_onus:
        serial = onu_data.get('serial_number', '').strip()
        if not serial:
            continue

        onu_index = onu_data.get('onu_index', 0)

        raw_signal = signal_map.get(onu_index)
        try:
            signal = int(raw_signal) / 100.0 if raw_signal not in (None, 'None', '') else None
        except (ValueError, TypeError):
            signal = None

        already_registered = admin_map.get(onu_index) == '1'
        initial_status = 'registered' if already_registered else 'unregistered'

        # Snapshot used to detect changes between polls
        cache_key = f'onu_state:{olt_id}:{serial}'
        current_state = {
            'signal': round(signal, 2) if signal is not None else None,
            'status': initial_status,
            'pon_port': onu_data.get('pon_port', ''),
        }

        if serial not in existing_map:
            to_create.append(ONU(
                olt=olt,
                serial_number=serial,
                pon_port=onu_data.get('pon_port', ''),
                onu_index=onu_index,
                onu_id=onu_index,
                status=initial_status,
                signal_strength=signal,
                last_seen=now,
            ))
            cache.set(cache_key, current_state, timeout=600)
            continue

        # Skip DB write if nothing changed since last poll
        if cache.get(cache_key) == current_state:
            result['skipped'] += 1
            continue

        onu = existing_map[serial]
        onu.last_seen = now
        onu.updated_at = now
        onu.signal_strength = signal
        fields = ['last_seen', 'signal_strength', 'updated_at']

        if not onu.pon_port and onu_data.get('pon_port'):
            onu.pon_port = onu_data['pon_port']
            fields.append('pon_port')

        if onu.status == 'unregistered' and already_registered:
            onu.status = 'registered'
            fields.append('status')
        elif onu.status == 'offline' and onu.registered_at and signal is not None:
            onu.status = 'active'
            fields.append('status')

        # Store which fields need updating so bulk_update covers them all
        onu._poll_update_fields = fields
        to_update.append(onu)
        cache.set(cache_key, current_state, timeout=600)

    if to_create:
        ONU.objects.bulk_create(to_create, ignore_conflicts=True)
        result['new'] = len(to_create)

    if to_update:
        # Union of all changed field sets so every field that any object touched is covered
        all_fields = set()
        for onu in to_update:
            all_fields.update(getattr(onu, '_poll_update_fields', []))
        ONU.objects.bulk_update(to_update, list(all_fields))
        result['updated'] = len(to_update)

    olt.last_polled = now
    olt.status = 'active'
    olt.save(update_fields=['last_polled', 'status'])

    return result


def push_vlan_to_olt(vlan_db_id: int) -> Dict[str, Any]:
    """
    Push a VLAN to the OLT via Telnet CLI.
    Updates vlan.pushed_to_olt and vlan.push_error in the DB.
    """
    from apps.vlans.models import VLAN
    from services import telnet_service

    result = {'success': False, 'error': None}

    try:
        vlan = VLAN.objects.select_related('olt').get(id=vlan_db_id)
    except VLAN.DoesNotExist:
        result['error'] = f'VLAN {vlan_db_id} not found'
        return result

    olt = vlan.olt

    if not olt.telnet_enabled:
        result['error'] = 'Telnet not enabled on this OLT — cannot push VLAN'
        vlan.pushed_to_olt = False
        vlan.push_error = result['error']
        vlan.save(update_fields=['pushed_to_olt', 'push_error'])
        return result

    connect_ip = _connect_ip(olt)
    success, message, client = telnet_service.telnet_login(
        host=connect_ip,
        username=olt.olt_admin_username or settings.DEFAULT_TELNET_USERNAME,
        password=olt.olt_admin_password or settings.DEFAULT_TELNET_PASSWORD,
        port=olt.telnet_port,
    )

    if not success:
        result['error'] = f'Telnet login failed: {message}'
        vlan.pushed_to_olt = False
        vlan.push_error = result['error'][:300]
        vlan.save(update_fields=['pushed_to_olt', 'push_error'])
        return result

    try:
        push_result = telnet_service.telnet_push_vlan(client, vlan.vlan_id)
    finally:
        client.disconnect()

    if push_result.get('success'):
        vlan.pushed_to_olt = True
        vlan.push_error = ''
        vlan.save(update_fields=['pushed_to_olt', 'push_error'])
        result['success'] = True
        result['already_existed'] = bool(push_result.get('already_existed'))
        if result['already_existed']:
            result['message'] = f'VLAN {vlan.vlan_id} was already present on OLT; no change made'
        else:
            result['message'] = f'VLAN {vlan.vlan_id} created on OLT'
    else:
        err = push_result.get('error', 'Unknown error')
        vlan.pushed_to_olt = False
        vlan.push_error = str(err)[:300]
        vlan.save(update_fields=['pushed_to_olt', 'push_error'])
        result['error'] = err

    return result


def sync_vlans_from_olt(olt_id: int) -> Dict[str, Any]:
    """
    Read all VLANs from the OLT and upsert them into the DB.

    Tries SNMP first (Q-BRIDGE-MIB), falls back to Telnet (`display vlan all` /
    `show vlan`) if SNMP returns nothing.

    Existing rows are kept; their `last_seen_on_olt` is bumped and
    `pushed_to_olt` is set to True (since the device confirms they exist).
    New rows are created with `source='discovered'`.
    """
    from apps.olts.models import OLT
    from apps.vlans.models import VLAN
    from services import snmp_service, telnet_service

    result: Dict[str, Any] = {
        'success': False,
        'method': None,
        'discovered': 0,
        'created': 0,
        'updated': 0,
        'error': None,
    }

    try:
        olt = OLT.objects.get(id=olt_id)
    except OLT.DoesNotExist:
        result['error'] = f'OLT {olt_id} not found'
        return result

    host = _connect_ip(olt)
    vlans_found: List[Dict[str, Any]] = []

    # ── Try SNMP first ───────────────────────────────────────────────────
    if olt.snmp_read_community:
        try:
            snmp_vlans = snmp_service.discover_vlans_snmp(
                host=host,
                community=olt.snmp_read_community,
                version=olt.snmp_version or 'v2c',
            )
            if snmp_vlans:
                vlans_found = snmp_vlans
                result['method'] = 'snmp'
        except Exception as e:
            logger.debug(f"SNMP VLAN discovery failed for OLT {olt_id}: {e}")

    # ── Telnet fallback ──────────────────────────────────────────────────
    if not vlans_found and olt.telnet_enabled:
        success, message, client = telnet_service.telnet_login(
            host=host,
            username=olt.olt_admin_username or settings.DEFAULT_TELNET_USERNAME,
            password=olt.olt_admin_password or settings.DEFAULT_TELNET_PASSWORD,
            port=olt.telnet_port,
        )
        if not success:
            result['error'] = f'Telnet login failed: {message}'
            return result
        try:
            disco = telnet_service.telnet_discover_vlans(client)
        finally:
            client.disconnect()
        if disco.get('success') and disco.get('vlans'):
            vlans_found = disco['vlans']
            result['method'] = 'telnet'
        elif disco.get('error'):
            result['error'] = f'Telnet discovery error: {disco["error"]}'
            return result

    if not vlans_found:
        result['error'] = 'No VLANs returned by SNMP or Telnet'
        return result

    # ── Upsert into DB (bulk) ────────────────────────────────────────────
    now = timezone.now()

    incoming_ids = [v['vlan_id'] for v in vlans_found]
    existing_map = {
        obj.vlan_id: obj
        for obj in VLAN.objects.filter(olt=olt, vlan_id__in=incoming_ids)
    }

    to_create: List[VLAN] = []
    to_update: List[VLAN] = []

    for v in vlans_found:
        vid = v['vlan_id']
        name = v.get('name') or f'VLAN{vid}'
        description = v.get('description') or ''

        if vid not in existing_map:
            to_create.append(VLAN(
                olt=olt,
                vlan_id=vid,
                name=name,
                description=description,
                source='discovered',
                last_seen_on_olt=now,
                pushed_to_olt=True,
                push_error='',
            ))
        else:
            obj = existing_map[vid]
            obj.last_seen_on_olt = now
            obj.pushed_to_olt = True
            obj.push_error = ''
            # Don't overwrite operator-set name/description
            if not obj.name or obj.name == f'VLAN{vid}':
                obj.name = name
            if not obj.description and description:
                obj.description = description
            to_update.append(obj)

    if to_create:
        VLAN.objects.bulk_create(to_create, ignore_conflicts=True)
    if to_update:
        VLAN.objects.bulk_update(
            to_update,
            ['last_seen_on_olt', 'pushed_to_olt', 'push_error', 'name', 'description'],
        )

    result['success'] = True
    result['discovered'] = len(vlans_found)
    result['created'] = len(to_create)
    result['updated'] = len(to_update)
    return result


def sync_vlans_from_olt_async(olt_id: int) -> None:
    from tasks import sync_vlans_from_olt_task
    sync_vlans_from_olt_task.delay(olt_id)


def sync_profiles_from_olt(olt_id: int) -> Dict[str, Any]:
    """
    Read ONU line + service profiles from the OLT and cache them on the model.
    Synchronous; returns {success, line_profiles, srv_profiles, error}.
    """
    from apps.olts.models import OLT
    from services import telnet_service

    result: Dict[str, Any] = {
        'success': False,
        'line_profiles': [],
        'srv_profiles': [],
        'error': None,
    }

    try:
        olt = OLT.objects.get(id=olt_id)
    except OLT.DoesNotExist:
        result['error'] = f'OLT {olt_id} not found'
        return result

    if not olt.telnet_enabled:
        result['error'] = 'Telnet must be enabled to discover profiles'
        return result

    host = _connect_ip(olt)
    success, message, client = telnet_service.telnet_login(
        host=host,
        username=olt.olt_admin_username or settings.DEFAULT_TELNET_USERNAME,
        password=olt.olt_admin_password or settings.DEFAULT_TELNET_PASSWORD,
        port=olt.telnet_port,
    )
    if not success:
        result['error'] = f'Telnet login failed: {message}'
        return result

    try:
        disco = telnet_service.telnet_discover_profiles(client)
    finally:
        client.disconnect()

    if not disco.get('success'):
        result['error'] = disco.get('error') or 'Profile discovery returned no results'
        return result

    olt.line_profiles = disco['line_profiles']
    olt.srv_profiles = disco['srv_profiles']
    olt.profiles_last_synced = timezone.now()
    olt.save(update_fields=['line_profiles', 'srv_profiles', 'profiles_last_synced'])

    result['success'] = True
    result['line_profiles'] = disco['line_profiles']
    result['srv_profiles'] = disco['srv_profiles']
    return result


def pick_default_profile_ids(olt) -> Tuple[int, int]:
    """
    Pick the line + service profile IDs to use when registering a new ONU.
    Returns (line_profile_id, srv_profile_id). Falls back to 1/1 if none cached.
    """
    line_id = olt.line_profiles[0]['id'] if olt.line_profiles else 1
    srv_id = olt.srv_profiles[0]['id'] if olt.srv_profiles else 1
    return line_id, srv_id


def reboot_onu(onu_id: int) -> Dict[str, Any]:
    """
    Reboot an ONU via Telnet CLI.
    Supports Huawei GPON (ont reset) and ZTE (onu reset).
    pon_port must be in "frame/slot/port" format (e.g. "0/1/0").
    Returns {'success': bool, 'message': str}
    """
    from apps.onus.models import ONU
    from services import telnet_service

    result: Dict[str, Any] = {'success': False, 'message': ''}

    try:
        onu = ONU.objects.select_related('olt').get(id=onu_id)
    except ONU.DoesNotExist:
        result['message'] = 'ONU not found'
        return result

    olt = onu.olt

    if not olt.telnet_enabled:
        result['message'] = 'Telnet is not enabled on this OLT. Enable Telnet to reboot ONUs.'
        return result

    pon_parts = onu.pon_port.split('/')
    if len(pon_parts) != 3:
        result['message'] = f'Cannot parse PON port "{onu.pon_port}" — expected frame/slot/port format.'
        return result

    frame, slot, port = pon_parts
    onu_id_str = str(onu.onu_id)
    connect_ip = _connect_ip(olt)

    success, message, client = telnet_service.telnet_login(
        host=connect_ip,
        port=olt.telnet_port,
        username=olt.olt_admin_username or settings.DEFAULT_TELNET_USERNAME,
        password=olt.olt_admin_password or settings.DEFAULT_TELNET_PASSWORD,
    )
    if not success:
        result['message'] = f'Telnet login failed: {message}'
        return result

    try:
        vendor = telnet_service._detect_vendor(client)

        if vendor == 'zte':
            # ZTE: interface gpon-olt_frame/slot/port → onu reset onu_id
            iface = f'gpon-olt_{frame}/{slot}/{port}'
            client.send_and_read(f'interface {iface}', '#', timeout=8)
            found, output = client.send_and_read(f'onu reset {onu_id_str}', '#', 'y/n', timeout=10)
            if 'y/n' in output.lower():
                client.send_and_read('y', '#', timeout=10)
            client.send_and_read('exit', '#', timeout=5)
        else:
            # Huawei (default): interface gpon frame/slot → ont reset port onu_id
            client.send_and_read(f'interface gpon {frame}/{slot}', '#', timeout=8)
            found, output = client.send_and_read(
                f'ont reset {port} {onu_id_str}', '#', 'y/n', ']', timeout=10
            )
            if 'y/n' in output.lower() or ']' in output:
                client.send_and_read('y', '#', timeout=10)
            client.send_and_read('quit', '#', timeout=5)

        result['success'] = True
        result['message'] = f'ONU {onu.serial_number} reboot command sent successfully.'
    except Exception as e:
        result['message'] = f'Reboot command failed: {e}'
    finally:
        client.disconnect()

    return result


def push_vlan_to_olt_async(vlan_db_id: int) -> None:
    from tasks import push_vlan_to_olt_task
    push_vlan_to_olt_task.delay(vlan_db_id)


def provision_onu(onu_id: int, vlan_id: Optional[int] = None,
                  line_profile_id: int = 1, srv_profile_id: int = 1) -> Dict[str, Any]:
    """
    Provision an ONU via Telnet CLI.
    Returns result dict with success, steps, error.
    """
    from apps.onus.models import ONU
    from services import telnet_service

    result: Dict[str, Any] = {'success': False, 'steps': [], 'error': None}

    try:
        onu = ONU.objects.select_related('olt', 'vlan').get(id=onu_id)
    except ONU.DoesNotExist:
        result['error'] = f'ONU {onu_id} not found'
        return result

    olt = onu.olt
    effective_vlan = vlan_id or (onu.vlan.vlan_id if onu.vlan else 0)

    onu.status = 'provisioning'
    onu.save(update_fields=['status'])
    _create_prov_log(onu, 'start', 'Starting ONU provisioning via Telnet', 'info')

    if not olt.telnet_enabled:
        result['error'] = 'Telnet not enabled on this OLT'
        onu.status = 'unregistered'
        onu.save(update_fields=['status'])
        _create_prov_log(onu, 'failed', result['error'], 'error')
        return result

    def _prov_io(direction: str, text: str):
        """Stream raw Telnet I/O into the ONU's provisioning log (credentials redacted)."""
        clean = _redact_credentials(text.strip(), olt)
        if not clean:
            return
        if direction == 'send':
            _create_prov_log(onu, 'telnet_terminal', f'> {clean}', 'info')
        elif direction == 'auto':
            _create_prov_log(onu, 'telnet_terminal', '[auto-credential sent]', 'warning')
        else:
            _create_prov_log(onu, 'telnet_terminal', clean, 'success')

    success, message, client = telnet_service.telnet_login(
        host=_connect_ip(olt),
        username=olt.olt_admin_username or settings.DEFAULT_TELNET_USERNAME,
        password=olt.olt_admin_password or settings.DEFAULT_TELNET_PASSWORD,
        port=olt.telnet_port,
        on_io=_prov_io,
    )
    if not success:
        result['error'] = f'Telnet login failed: {message}'
        onu.status = 'unregistered'
        onu.save(update_fields=['status'])
        _create_prov_log(onu, 'failed', result['error'], 'error')
        return result

    try:
        prov_result = telnet_service.telnet_provision_onu(
            client=client,
            onu_serial=onu.serial_number,
            pon_port=onu.pon_port,
            vlan_id=effective_vlan,
            onu_id=onu.onu_id or 1,
            line_profile_id=line_profile_id,
            srv_profile_id=srv_profile_id,
        )
    finally:
        client.disconnect()

    result['success'] = prov_result.get('success', False)
    result['error'] = prov_result.get('error')
    result['steps'] = prov_result.get('steps', [])
    for step in result['steps']:
        level = 'success' if step.get('success') else 'warning'
        _create_prov_log(onu, step.get('step', 'step'), step.get('message', ''), level)

    if result['success']:
        onu.status = 'active'
        onu.registered_at = timezone.now()
        onu.save(update_fields=['status', 'registered_at'])
        _create_prov_log(onu, 'complete', f'ONU {onu.serial_number} successfully provisioned', 'success')
    else:
        onu.status = 'unregistered'
        onu.save(update_fields=['status'])
        _create_prov_log(onu, 'failed',
                         f'ONU provisioning failed: {result.get("error", "Unknown error")}', 'error')

    return result
