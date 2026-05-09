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
OID_GPON_ONU_TABLE = '1.3.6.1.4.1.2011.6.128.1.1.2'   # Huawei GPON ONU table
OID_ZTE_ONU_TABLE = '1.3.6.1.4.1.3902.1012.3.28'       # ZTE ONU table
OID_ONU_SERIAL_PREFIX = '1.3.6.1.4.1.2011.6.128.1.1.2.43'  # Huawei ONU serial

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
        sys_descr = snmp_get(host, community, OID_SYS_DESCR, port=port, version=version)
        if sys_descr is None:
            result['error'] = f'No SNMP response from {host}:{port} with community "{community}"'
            return result

        result['connected'] = True
        result['sys_descr'] = sys_descr

        sys_name = snmp_get(host, community, OID_SYS_NAME, port=port, version=version)
        result['sys_name'] = sys_name or ''

        sys_uptime = snmp_get(host, community, OID_SYS_UPTIME, port=port, version=version)
        result['sys_uptime'] = sys_uptime or ''

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
    huawei_results = snmp_walk(host, community, huawei_serial_oid, port=port, version=version)
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
        zte_onu_oid = '1.3.6.1.4.1.3902.1012.3.50.11.1.1.10'
        zte_results = snmp_walk(host, community, zte_onu_oid, port=port, version=version)
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
            # Value is typically in 0.01 dBm units
            raw = int(value)
            return raw / 100.0 if abs(raw) > 1000 else float(raw)
        except (ValueError, TypeError):
            pass
    return None


def snmp_provision_onu(host: str, write_community: str, onu_index: int,
                        vlan_id: int = 100, version: str = 'v2c', port: int = 161) -> Dict[str, Any]:
    """
    Provision/authorize an ONU via SNMP SET operations.
    Returns dict with keys: success, error, steps
    """
    steps = []
    result = {'success': False, 'error': None, 'steps': steps}

    # Step 1: Set ONU operational state to enabled (1)
    oid_onu_enable = f'1.3.6.1.4.1.2011.6.128.1.1.2.43.1.15.{onu_index}'
    success = snmp_set(host, write_community, oid_onu_enable, 1, 'Integer32', port=port, version=version)
    steps.append({'step': 'enable_onu', 'success': success,
                  'message': 'ONU enabled via SNMP' if success else 'Failed to enable ONU via SNMP'})

    # Step 2: Bind VLAN to ONU
    if vlan_id > 0:
        oid_vlan = f'1.3.6.1.4.1.2011.6.128.1.1.2.46.1.6.{onu_index}'
        vlan_success = snmp_set(host, write_community, oid_vlan, vlan_id, 'Integer32',
                                port=port, version=version)
        steps.append({'step': 'bind_vlan', 'success': vlan_success,
                      'message': f'VLAN {vlan_id} bound' if vlan_success else f'Failed to bind VLAN {vlan_id}'})

    # Consider success if ONU enable worked
    result['success'] = success
    if not success:
        result['error'] = 'SNMP ONU provisioning failed - check write community and OID support'
    return result


def _extract_pon_port(oid_str: str) -> str:
    """Extract PON port identifier from OID string."""
    parts = oid_str.split('.')
    if len(parts) >= 4:
        return f'{parts[-4]}/{parts[-3]}/{parts[-2]}' if len(parts) >= 4 else parts[-1]
    return ''
