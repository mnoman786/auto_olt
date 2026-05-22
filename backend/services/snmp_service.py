"""
SNMP Service for OLT management.
Handles SNMP GET, GETNEXT, WALK, and SET operations.
Uses pysnmp library for SNMP communication.
"""
import logging
from typing import Optional, Dict, List, Tuple, Any

logger = logging.getLogger(__name__)

# Standard OID definitions
OID_SYS_DESCR = '1.3.6.1.2.1.1.1.0'
OID_SYS_UPTIME = '1.3.6.1.2.1.1.3.0'
OID_SYS_NAME = '1.3.6.1.2.1.1.5.0'
OID_SYS_CONTACT = '1.3.6.1.2.1.1.4.0'
OID_SYS_LOCATION = '1.3.6.1.2.1.1.6.0'

# GPON ONU OIDs (generic - covers common OLT vendors like Huawei, ZTE, FiberHome)
OID_GPON_ONU_TABLE   = '1.3.6.1.4.1.2011.6.128.1.1.2'        # Huawei GPON ONU table
OID_ZTE_ONU_TABLE    = '1.3.6.1.4.1.3902.1012.3.28'          # ZTE hwGponOnuTable base
OID_ZTE_ONU_SERIAL   = '1.3.6.1.4.1.3902.1012.3.28.1.1.3'   # ZTE ONU serial number column
OID_ONU_SERIAL_PREFIX = '1.3.6.1.4.1.2011.6.128.1.1.2.43'   # Huawei ONU serial

# SNMP community OIDs (for configuration)
OID_SNMP_COMMUNITY_RO = '1.3.6.1.6.3.18.1.1.1.2'
OID_SNMP_COMMUNITY_RW = '1.3.6.1.6.3.18.1.1.1.3'


def _get_snmp_engine():
    """Get or create SNMP engine."""
    try:
        from pysnmp.hlapi import SnmpEngine
        return SnmpEngine()
    except ImportError:
        logger.warning("pysnmp not installed, using mock SNMP engine")
        return None


def snmp_get(host: str, community: str, oid: str, port: int = 161,
             version: str = 'v2c', timeout: int = 5, retries: int = 2) -> Optional[str]:
    """Perform SNMP GET operation."""
    try:
        from pysnmp.hlapi import (
            getCmd, SnmpEngine, CommunityData, UdpTransportTarget,
            ContextData, ObjectType, ObjectIdentity
        )
        version_map = {'v1': 0, 'v2c': 1}
        mp_model = version_map.get(version, 1)

        error_indication, error_status, error_index, var_binds = next(
            getCmd(
                SnmpEngine(),
                CommunityData(community, mpModel=mp_model),
                UdpTransportTarget((host, port), timeout=timeout, retries=retries),
                ContextData(),
                ObjectType(ObjectIdentity(oid))
            )
        )
        if error_indication:
            logger.debug(f"SNMP GET error for {host} OID {oid}: {error_indication}")
            return None
        if error_status:
            logger.debug(f"SNMP GET status error: {error_status.prettyPrint()}")
            return None
        for var_bind in var_binds:
            return str(var_bind[1])
    except Exception as e:
        logger.debug(f"SNMP GET exception for {host}: {e}")
        return None


def snmp_set(host: str, community: str, oid: str, value: Any, value_type: str = 'OctetString',
             port: int = 161, version: str = 'v2c', timeout: int = 5) -> bool:
    """Perform SNMP SET operation."""
    try:
        from pysnmp.hlapi import (
            setCmd, SnmpEngine, CommunityData, UdpTransportTarget,
            ContextData, ObjectType, ObjectIdentity
        )
        from pysnmp.proto.rfc1902 import (
            OctetString, Integer, Integer32, Gauge32, Counter32, IpAddress, TimeTicks
        )

        type_map = {
            'OctetString': OctetString,
            'Integer': Integer32,
            'Integer32': Integer32,
            'Gauge32': Gauge32,
            'Counter32': Counter32,
            'IpAddress': IpAddress,
            'TimeTicks': TimeTicks,
        }
        snmp_type = type_map.get(value_type, OctetString)
        version_map = {'v1': 0, 'v2c': 1}
        mp_model = version_map.get(version, 1)

        error_indication, error_status, error_index, var_binds = next(
            setCmd(
                SnmpEngine(),
                CommunityData(community, mpModel=mp_model),
                UdpTransportTarget((host, port), timeout=timeout, retries=1),
                ContextData(),
                ObjectType(ObjectIdentity(oid), snmp_type(value))
            )
        )
        if error_indication:
            logger.debug(f"SNMP SET error for {host}: {error_indication}")
            return False
        if error_status:
            logger.debug(f"SNMP SET status error: {error_status.prettyPrint()}")
            return False
        return True
    except Exception as e:
        logger.debug(f"SNMP SET exception for {host}: {e}")
        return False


def snmp_walk(host: str, community: str, oid: str, port: int = 161,
              version: str = 'v2c', timeout: int = 10, max_rows: int = 500) -> List[Tuple[str, str]]:
    """Perform SNMP WALK operation, returns list of (oid, value) tuples."""
    results = []
    try:
        from pysnmp.hlapi import (
            nextCmd, SnmpEngine, CommunityData, UdpTransportTarget,
            ContextData, ObjectType, ObjectIdentity
        )
        version_map = {'v1': 0, 'v2c': 1}
        mp_model = version_map.get(version, 1)

        for error_indication, error_status, error_index, var_binds in nextCmd(
            SnmpEngine(),
            CommunityData(community, mpModel=mp_model),
            UdpTransportTarget((host, port), timeout=timeout, retries=1),
            ContextData(),
            ObjectType(ObjectIdentity(oid)),
            lexicographicMode=False,
            maxRows=max_rows
        ):
            if error_indication:
                break
            if error_status:
                break
            for var_bind in var_binds:
                results.append((str(var_bind[0]), str(var_bind[1])))
    except Exception as e:
        logger.debug(f"SNMP WALK exception for {host}: {e}")
    return results


def snmp_bulk_walk(host: str, community: str, oid: str, port: int = 161,
                   version: str = 'v2c', timeout: int = 10, max_rows: int = 1000,
                   max_repetitions: int = 25) -> List[Tuple[str, str]]:
    """SNMP GETBULK walk — fetches max_repetitions rows per PDU instead of one.
    Falls back to snmp_walk for v1 (GETBULK is v2c+ only).
    """
    if version == 'v1':
        return snmp_walk(host, community, oid, port=port, version=version,
                         timeout=timeout, max_rows=max_rows)
    results = []
    try:
        from pysnmp.hlapi import (
            bulkCmd, SnmpEngine, CommunityData, UdpTransportTarget,
            ContextData, ObjectType, ObjectIdentity
        )
        for error_indication, error_status, error_index, var_binds in bulkCmd(
            SnmpEngine(),
            CommunityData(community, mpModel=1),
            UdpTransportTarget((host, port), timeout=timeout, retries=1),
            ContextData(),
            0,                 # nonRepeaters
            max_repetitions,   # rows per PDU response
            ObjectType(ObjectIdentity(oid)),
            lexicographicMode=False,
            maxRows=max_rows
        ):
            if error_indication:
                break
            if error_status:
                break
            for var_bind in var_binds:
                results.append((str(var_bind[0]), str(var_bind[1])))
    except Exception as e:
        logger.debug(f"SNMP BULK WALK exception for {host}: {e}")
    return results


def validate_snmp_connectivity(host: str, community: str, version: str = 'v2c',
                                port: int = 161) -> Dict[str, Any]:
    """
    Validate SNMP connectivity and return system info.
    Returns dict with keys: connected, sys_name, sys_descr, sys_uptime, error
    """
    result = {
        'connected': False,
        'sys_name': '',
        'sys_descr': '',
        'sys_uptime': '',
        'error': None,
    }
    try:
        from pysnmp.hlapi import (
            getCmd, SnmpEngine, CommunityData, UdpTransportTarget,
            ContextData, ObjectType, ObjectIdentity
        )
        version_map = {'v1': 0, 'v2c': 1}
        mp_model = version_map.get(version, 1)

        # Fetch sysDescr, sysName, sysUptime in a single GET PDU (3 OIDs → 1 round trip)
        error_indication, error_status, error_index, var_binds = next(
            getCmd(
                SnmpEngine(),
                CommunityData(community, mpModel=mp_model),
                UdpTransportTarget((host, port), timeout=5, retries=2),
                ContextData(),
                ObjectType(ObjectIdentity(OID_SYS_DESCR)),
                ObjectType(ObjectIdentity(OID_SYS_NAME)),
                ObjectType(ObjectIdentity(OID_SYS_UPTIME)),
            )
        )
        if error_indication:
            result['error'] = f'No SNMP response from {host}:{port} with community "{community}"'
            return result
        if error_status:
            result['error'] = f'SNMP error: {error_status.prettyPrint()}'
            return result

        values = [str(vb[1]) for vb in var_binds]
        result['connected'] = True
        result['sys_descr'] = values[0] if len(values) > 0 else ''
        result['sys_name']  = values[1] if len(values) > 1 else ''
        result['sys_uptime'] = values[2] if len(values) > 2 else ''

    except Exception as e:
        result['error'] = str(e)
    return result


def validate_snmp_write_access(host: str, write_community: str, version: str = 'v2c',
                                port: int = 161) -> Dict[str, Any]:
    """
    Validate SNMP write access by attempting a harmless SET (sysName or sysContact).
    Returns dict with keys: writable, error
    """
    result = {'writable': False, 'error': None}
    if not write_community:
        result['error'] = 'No write community provided'
        return result
    try:
        current_name = snmp_get(host, write_community, OID_SYS_NAME, port=port, version=version)
        if current_name is None:
            result['error'] = 'Cannot read with write community - check community string'
            return result
        success = snmp_set(host, write_community, OID_SYS_NAME, current_name, 'OctetString',
                           port=port, version=version)
        if success:
            result['writable'] = True
        else:
            result['error'] = 'SNMP SET failed - write community may be read-only'
    except Exception as e:
        result['error'] = str(e)
    return result


def discover_onus_snmp(host: str, community: str, version: str = 'v2c',
                        port: int = 161) -> List[Dict[str, Any]]:
    """
    Discover ONUs via SNMP walk on GPON ONU tables.
    Tries multiple vendor OID tables and returns normalized ONU list.
    """
    onus = []
    discovered_serials = set()

    # Try Huawei ONU serial table
    huawei_serial_oid = '1.3.6.1.4.1.2011.6.128.1.1.2.43.1.3'
    huawei_results = snmp_bulk_walk(host, community, huawei_serial_oid, port=port, version=version)
    if huawei_results:
        for oid_str, value in huawei_results:
            if value and value not in ('No Such Object', 'No Such Instance', ''):
                parts = oid_str.split('.')
                # Last two parts are typically frame.slot.port.onuid or similar
                onu_index = int(parts[-1]) if parts[-1].isdigit() else 0
                serial = value.strip()
                if serial and serial not in discovered_serials:
                    discovered_serials.add(serial)
                    onus.append({
                        'serial_number': serial,
                        'onu_index': onu_index,
                        'pon_port': _extract_pon_port(oid_str),
                        'vendor': 'huawei',
                        'mac_address': '',
                        'signal_strength': None,
                    })

    # Try ZTE-style ONU discovery if no Huawei results
    if not onus:
        zte_results = snmp_bulk_walk(host, community, OID_ZTE_ONU_SERIAL, port=port, version=version)
        for oid_str, value in zte_results:
            if value and value not in ('No Such Object', 'No Such Instance', ''):
                parts = oid_str.split('.')
                onu_index = int(parts[-1]) if parts[-1].isdigit() else 0
                serial = value.strip()
                if serial and serial not in discovered_serials:
                    discovered_serials.add(serial)
                    onus.append({
                        'serial_number': serial,
                        'onu_index': onu_index,
                        'pon_port': _extract_pon_port(oid_str),
                        'vendor': 'zte',
                        'mac_address': '',
                        'signal_strength': None,
                    })

    # Fallback: try ifDescr walk to detect any ONT interfaces
    if not onus:
        if_oid = '1.3.6.1.2.1.2.2.1.2'  # ifDescr
        if_results = snmp_walk(host, community, if_oid, port=port, version=version)
        for oid_str, value in if_results:
            if 'gpon' in value.lower() or 'ont' in value.lower() or 'onu' in value.lower():
                parts = oid_str.split('.')
                if_index = int(parts[-1]) if parts[-1].isdigit() else 0
                fake_serial = f'SIM{if_index:08d}'
                if fake_serial not in discovered_serials:
                    discovered_serials.add(fake_serial)
                    onus.append({
                        'serial_number': fake_serial,
                        'onu_index': if_index,
                        'pon_port': value,
                        'vendor': 'generic',
                        'mac_address': '',
                        'signal_strength': None,
                    })

    return onus


def get_onu_signal_strength(host: str, community: str, onu_index: int,
                             version: str = 'v2c', port: int = 161) -> Optional[float]:
    """Get ONU optical receive power (signal strength) in dBm."""
    # Huawei ONU Rx power OID
    oid = f'1.3.6.1.4.1.2011.6.128.1.1.2.51.1.4.{onu_index}'
    value = snmp_get(host, community, oid, port=port, version=version)
    if value and value not in ('No Such Object', 'No Such Instance', 'None'):
        try:
            raw = int(value)
            return raw / 100.0  # Huawei reports in 0.01 dBm units
        except (ValueError, TypeError):
            pass
    return None


def get_onu_admin_state(host: str, community: str, onu_index: int,
                        version: str = 'v2c', port: int = 161) -> bool:
    """
    Check if an ONU is already enabled/registered on the OLT via SNMP.
    Huawei hwGponDeviceOntAdminState: 1 = enabled, 0 = disabled.
    Returns True if ONU is enabled (already registered on OLT).
    """
    oid = f'1.3.6.1.4.1.2011.6.128.1.1.2.43.1.15.{onu_index}'
    value = snmp_get(host, community, oid, port=port, version=version)
    if value and value not in ('No Such Object', 'No Such Instance', 'None'):
        try:
            return int(value) == 1
        except (ValueError, TypeError):
            pass
    return False


def discover_ports_snmp(host: str, community: str, version: str = 'v2c') -> List[Dict[str, Any]]:
    """
    Discover OLT ports via SNMP ifTable.
    Returns list of dicts: {if_index, name, description, port_type, status, speed_mbps}

    ifType values used:
      6   = ethernetCsmacd  → uplink
      161 = ieee8023adLag   → lag/trunk
      166 = mpls / gpon     → pon (Huawei uses 166 for GPON)
      53  = propVirtual     → virtual/other
    """
    OID_IF_DESCR   = '1.3.6.1.2.1.2.2.1.2'   # ifDescr
    OID_IF_TYPE    = '1.3.6.1.2.1.2.2.1.3'   # ifType
    OID_IF_SPEED   = '1.3.6.1.2.1.2.2.1.5'   # ifSpeed (bps)
    OID_IF_STATUS  = '1.3.6.1.2.1.2.2.1.8'   # ifOperStatus (1=up,2=down)
    OID_IF_ALIAS   = '1.3.6.1.2.1.31.1.1.1.18'  # ifAlias (description)

    ports = []
    try:
        descr_rows  = snmp_bulk_walk(host, community, OID_IF_DESCR,  version=version, max_rows=256)
        type_rows   = snmp_bulk_walk(host, community, OID_IF_TYPE,   version=version, max_rows=256)
        speed_rows  = snmp_bulk_walk(host, community, OID_IF_SPEED,  version=version, max_rows=256)
        status_rows = snmp_bulk_walk(host, community, OID_IF_STATUS, version=version, max_rows=256)
        alias_rows  = snmp_bulk_walk(host, community, OID_IF_ALIAS,  version=version, max_rows=256)

        # Index by if_index (last OID segment)
        def index_by(rows):
            result = {}
            for oid, val in rows:
                idx = oid.split('.')[-1]
                result[idx] = val
            return result

        descr_map  = index_by(descr_rows)
        type_map   = index_by(type_rows)
        speed_map  = index_by(speed_rows)
        status_map = index_by(status_rows)
        alias_map  = index_by(alias_rows)

        IF_TYPE_PON    = {'166', '250', '251', '252'}  # gpon/xgpon variants
        IF_TYPE_UPLINK = {'6', '117', '26'}            # ethernet / fastEther / fibre
        IF_TYPE_LAG    = {'161'}                       # ieee8023adLag

        for idx, name in descr_map.items():
            if not name:
                continue
            if_type = type_map.get(idx, '0')
            speed_bps = int(speed_map.get(idx, 0) or 0)
            oper_status = status_map.get(idx, '2')
            alias = alias_map.get(idx, '')

            # Classify port type
            if if_type in IF_TYPE_PON or 'gpon' in name.lower() or 'pon' in name.lower():
                port_type = 'pon'
            elif if_type in IF_TYPE_LAG or 'lag' in name.lower() or 'trunk' in name.lower():
                port_type = 'lag'
            elif if_type in IF_TYPE_UPLINK or 'eth' in name.lower() or 'ge' in name.lower() or 'xge' in name.lower():
                port_type = 'uplink'
            else:
                port_type = 'other'

            # Skip loopback / virtual / management
            if if_type in ('24', '131', '53') or 'loop' in name.lower() or 'null' in name.lower():
                continue

            ports.append({
                'if_index': int(idx),
                'name': name,
                'description': alias or '',
                'port_type': port_type,
                'status': 'up' if oper_status == '1' else 'down',
                'speed_mbps': speed_bps // 1_000_000,
            })
    except Exception as e:
        logger.error(f"Port discovery error for {host}: {e}")

    return sorted(ports, key=lambda p: (p['port_type'], p['name']))


def _extract_pon_port(oid_str: str) -> str:
    """Extract PON port identifier from OID string.
    Huawei ONU table index is frame.slot.port.onu — last 4 segments of OID.
    Returns frame/slot/port string (e.g. '0/1/0').
    """
    parts = oid_str.split('.')
    if len(parts) >= 4:
        return f'{parts[-4]}/{parts[-3]}/{parts[-2]}'
    return parts[-1] if parts else ''


# ─── VLAN discovery ──────────────────────────────────────────────────────────
#
# Q-BRIDGE-MIB (RFC 4363) — vendor-neutral, supported by most modern OLTs.
#   dot1qVlanStaticName  : 1.3.6.1.2.1.17.7.1.4.3.1.1.<vid>  → octet string
#   dot1qVlanStaticRowStatus: 1.3.6.1.2.1.17.7.1.4.3.1.5.<vid>  → row status (1=active)
#
# Huawei-specific fallback (HUAWEI-VLAN-MIB):
#   hwL2VlanDescription  : 1.3.6.1.4.1.2011.5.25.42.1.1.2.1.1.<vid>
OID_DOT1Q_VLAN_NAME       = '1.3.6.1.2.1.17.7.1.4.3.1.1'
OID_DOT1Q_VLAN_ROW_STATUS = '1.3.6.1.2.1.17.7.1.4.3.1.5'
OID_HUAWEI_VLAN_DESCR     = '1.3.6.1.4.1.2011.5.25.42.1.1.2.1.1'


def discover_vlans_snmp(host: str, community: str, version: str = 'v2c',
                        port: int = 161) -> List[Dict[str, Any]]:
    """
    Discover VLANs on the OLT via Q-BRIDGE-MIB (RFC 4363) with a Huawei fallback.

    Returns a list of dicts: {'vlan_id': int, 'name': str, 'description': str}.
    Returns an empty list if the OLT does not respond on either MIB — caller
    should fall back to telnet discovery in that case.
    """
    vlans: Dict[int, Dict[str, Any]] = {}

    # ── Try Q-BRIDGE-MIB (vendor-neutral) ───────────────────────────────────
    name_rows = snmp_walk(host, community, OID_DOT1Q_VLAN_NAME,
                          version=version, port=port, max_rows=4096)
    for oid, value in name_rows:
        try:
            vid = int(oid.split('.')[-1])
        except (ValueError, IndexError):
            continue
        if not (1 <= vid <= 4094):
            continue
        vlans[vid] = {'vlan_id': vid, 'name': value or f'VLAN{vid}', 'description': ''}

    # ── Huawei fallback / enrichment ────────────────────────────────────────
    if not vlans:
        huawei_rows = snmp_walk(host, community, OID_HUAWEI_VLAN_DESCR,
                                version=version, port=port, max_rows=4096)
        for oid, value in huawei_rows:
            try:
                vid = int(oid.split('.')[-1])
            except (ValueError, IndexError):
                continue
            if not (1 <= vid <= 4094):
                continue
            vlans[vid] = {'vlan_id': vid, 'name': f'VLAN{vid}', 'description': value or ''}
    return sorted(vlans.values(), key=lambda v: v['vlan_id'])
