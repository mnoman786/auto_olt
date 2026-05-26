"""
SNMP Service for OLT management.
Wraps pysnmp-lextudio 6.x asyncio API for synchronous use via asyncio.run().
Python 3.12 removed asyncore, which pysnmp 5.x relied on; 6.x uses asyncio instead.
"""
import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional, Dict, List, Tuple, Any

logger = logging.getLogger(__name__)

OID_SYS_DESCR    = '1.3.6.1.2.1.1.1.0'
OID_SYS_UPTIME   = '1.3.6.1.2.1.1.3.0'
OID_SYS_NAME     = '1.3.6.1.2.1.1.5.0'
OID_SYS_CONTACT  = '1.3.6.1.2.1.1.4.0'
OID_SYS_LOCATION = '1.3.6.1.2.1.1.6.0'

OID_GPON_ONU_TABLE    = '1.3.6.1.4.1.2011.6.128.1.1.2'
OID_ZTE_ONU_TABLE     = '1.3.6.1.4.1.3902.1012.3.28'
OID_ZTE_ONU_SERIAL    = '1.3.6.1.4.1.3902.1012.3.28.1.1.3'
OID_ONU_SERIAL_PREFIX = '1.3.6.1.4.1.2011.6.128.1.1.2.43'

OID_SNMP_COMMUNITY_RO = '1.3.6.1.6.3.18.1.1.1.2'
OID_SNMP_COMMUNITY_RW = '1.3.6.1.6.3.18.1.1.1.3'


def _mp(version: str) -> int:
    return 0 if version == 'v1' else 1


def _in_subtree(oid_str: str, base: str) -> bool:
    return oid_str == base or oid_str.startswith(base + '.')


def snmp_get(host: str, community: str, oid: str, port: int = 161,
             version: str = 'v2c', timeout: int = 5, retries: int = 2) -> Optional[str]:
    async def _run():
        from pysnmp.hlapi.asyncio import (
            getCmd, SnmpEngine, CommunityData, UdpTransportTarget,
            ContextData, ObjectType, ObjectIdentity
        )
        errInd, errStat, _, varBinds = await getCmd(
            SnmpEngine(),
            CommunityData(community, mpModel=_mp(version)),
            UdpTransportTarget((host, port), timeout=timeout, retries=retries),
            ContextData(),
            ObjectType(ObjectIdentity(oid)),
        )
        if errInd:
            logger.debug(f"SNMP GET error for {host} OID {oid}: {errInd}")
            return None
        if errStat:
            logger.debug(f"SNMP GET status error: {errStat.prettyPrint()}")
            return None
        for vb in varBinds:
            return str(vb[1])
        return None

    try:
        return asyncio.run(_run())
    except Exception as e:
        logger.debug(f"SNMP GET exception for {host}: {e}")
        return None


def snmp_set(host: str, community: str, oid: str, value: Any,
             value_type: str = 'OctetString', port: int = 161,
             version: str = 'v2c', timeout: int = 5) -> bool:
    async def _run():
        from pysnmp.hlapi.asyncio import (
            setCmd, SnmpEngine, CommunityData, UdpTransportTarget,
            ContextData, ObjectType, ObjectIdentity
        )
        from pysnmp.proto.rfc1902 import (
            OctetString, Integer32, Gauge32, Counter32, IpAddress, TimeTicks
        )
        type_map = {
            'OctetString': OctetString, 'Integer': Integer32, 'Integer32': Integer32,
            'Gauge32': Gauge32, 'Counter32': Counter32,
            'IpAddress': IpAddress, 'TimeTicks': TimeTicks,
        }
        snmp_type = type_map.get(value_type, OctetString)
        errInd, errStat, _, _vb = await setCmd(
            SnmpEngine(),
            CommunityData(community, mpModel=_mp(version)),
            UdpTransportTarget((host, port), timeout=timeout, retries=1),
            ContextData(),
            ObjectType(ObjectIdentity(oid), snmp_type(value)),
        )
        if errInd:
            logger.debug(f"SNMP SET error for {host}: {errInd}")
            return False
        if errStat:
            logger.debug(f"SNMP SET status error: {errStat.prettyPrint()}")
            return False
        return True

    try:
        return asyncio.run(_run())
    except Exception as e:
        logger.debug(f"SNMP SET exception for {host}: {e}")
        return False


def snmp_walk(host: str, community: str, oid: str, port: int = 161,
              version: str = 'v2c', timeout: int = 10,
              max_rows: int = 500) -> List[Tuple[str, str]]:
    async def _run():
        from pysnmp.hlapi.asyncio import (
            nextCmd, SnmpEngine, CommunityData, UdpTransportTarget,
            ContextData, ObjectType, ObjectIdentity
        )
        results = []
        count = 0
        async for errInd, errStat, _, varBinds in nextCmd(
            SnmpEngine(),
            CommunityData(community, mpModel=_mp(version)),
            UdpTransportTarget((host, port), timeout=timeout, retries=1),
            ContextData(),
            ObjectType(ObjectIdentity(oid)),
        ):
            if errInd or errStat:
                break
            done = False
            for vb in varBinds:
                r_oid = str(vb[0])
                if not _in_subtree(r_oid, oid):
                    done = True
                    break
                results.append((r_oid, str(vb[1])))
            if done:
                break
            count += 1
            if count >= max_rows:
                break
        return results

    try:
        return asyncio.run(_run())
    except Exception as e:
        logger.debug(f"SNMP WALK exception for {host}: {e}")
        return []


def snmp_bulk_walk(host: str, community: str, oid: str, port: int = 161,
                   version: str = 'v2c', timeout: int = 10, max_rows: int = 1000,
                   max_repetitions: int = 25) -> List[Tuple[str, str]]:
    if version == 'v1':
        return snmp_walk(host, community, oid, port=port, version=version,
                         timeout=timeout, max_rows=max_rows)

    async def _run():
        from pysnmp.hlapi.asyncio import (
            bulkCmd, SnmpEngine, CommunityData, UdpTransportTarget,
            ContextData, ObjectType, ObjectIdentity
        )
        results = []
        async for errInd, errStat, _, varBinds in bulkCmd(
            SnmpEngine(),
            CommunityData(community, mpModel=1),
            UdpTransportTarget((host, port), timeout=timeout, retries=1),
            ContextData(),
            0, max_repetitions,
            ObjectType(ObjectIdentity(oid)),
        ):
            if errInd or errStat:
                break
            done = False
            for vb in varBinds:
                r_oid = str(vb[0])
                if not _in_subtree(r_oid, oid):
                    done = True
                    break
                results.append((r_oid, str(vb[1])))
                if len(results) >= max_rows:
                    done = True
                    break
            if done:
                break
        return results

    try:
        return asyncio.run(_run())
    except Exception as e:
        logger.debug(f"SNMP BULK WALK exception for {host}: {e}")
        return []


def validate_snmp_connectivity(host: str, community: str, version: str = 'v2c',
                                port: int = 161) -> Dict[str, Any]:
    result = {'connected': False, 'sys_name': '', 'sys_descr': '', 'sys_uptime': '', 'error': None}

    async def _run():
        from pysnmp.hlapi.asyncio import (
            getCmd, SnmpEngine, CommunityData, UdpTransportTarget,
            ContextData, ObjectType, ObjectIdentity
        )
        errInd, errStat, _, varBinds = await getCmd(
            SnmpEngine(),
            CommunityData(community, mpModel=_mp(version)),
            UdpTransportTarget((host, port), timeout=5, retries=2),
            ContextData(),
            ObjectType(ObjectIdentity(OID_SYS_DESCR)),
            ObjectType(ObjectIdentity(OID_SYS_NAME)),
            ObjectType(ObjectIdentity(OID_SYS_UPTIME)),
        )
        return errInd, errStat, varBinds

    try:
        errInd, errStat, varBinds = asyncio.run(_run())
        if errInd:
            result['error'] = f'No SNMP response from {host}:{port} with community "{community}"'
            return result
        if errStat:
            result['error'] = f'SNMP error: {errStat.prettyPrint()}'
            return result
        values = [str(vb[1]) for vb in varBinds]
        result['connected'] = True
        result['sys_descr']  = values[0] if len(values) > 0 else ''
        result['sys_name']   = values[1] if len(values) > 1 else ''
        result['sys_uptime'] = values[2] if len(values) > 2 else ''
    except Exception as e:
        result['error'] = str(e)
    return result


def validate_snmp_write_access(host: str, write_community: str, version: str = 'v2c',
                                port: int = 161) -> Dict[str, Any]:
    result = {'writable': False, 'error': None}
    if not write_community:
        result['error'] = 'No write community provided'
        return result
    try:
        current_name = snmp_get(host, write_community, OID_SYS_NAME, port=port, version=version)
        if current_name is None:
            result['error'] = 'Cannot read with write community - check community string'
            return result
        success = snmp_set(host, write_community, OID_SYS_NAME, current_name,
                           'OctetString', port=port, version=version)
        if success:
            result['writable'] = True
        else:
            result['error'] = 'SNMP SET failed - write community may be read-only'
    except Exception as e:
        result['error'] = str(e)
    return result


def discover_onus_snmp(host: str, community: str, version: str = 'v2c',
                        port: int = 161) -> List[Dict[str, Any]]:
    onus = []
    discovered_serials: set = set()

    huawei_serial_oid = '1.3.6.1.4.1.2011.6.128.1.1.2.43.1.3'
    huawei_results = snmp_bulk_walk(host, community, huawei_serial_oid, port=port, version=version)
    if huawei_results:
        for oid_str, value in huawei_results:
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
                        'vendor': 'huawei',
                        'mac_address': '',
                        'signal_strength': None,
                    })

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

    if not onus:
        if_oid = '1.3.6.1.2.1.2.2.1.2'
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
    oid = f'1.3.6.1.4.1.2011.6.128.1.1.2.51.1.4.{onu_index}'
    value = snmp_get(host, community, oid, port=port, version=version)
    if value and value not in ('No Such Object', 'No Such Instance', 'None'):
        try:
            return int(value) / 100.0
        except (ValueError, TypeError):
            pass
    return None


def get_onu_admin_state(host: str, community: str, onu_index: int,
                        version: str = 'v2c', port: int = 161) -> bool:
    oid = f'1.3.6.1.4.1.2011.6.128.1.1.2.43.1.15.{onu_index}'
    value = snmp_get(host, community, oid, port=port, version=version)
    if value and value not in ('No Such Object', 'No Such Instance', 'None'):
        try:
            return int(value) == 1
        except (ValueError, TypeError):
            pass
    return False


def discover_ports_snmp(host: str, community: str, version: str = 'v2c') -> List[Dict[str, Any]]:
    OID_IF_DESCR  = '1.3.6.1.2.1.2.2.1.2'
    OID_IF_TYPE   = '1.3.6.1.2.1.2.2.1.3'
    OID_IF_SPEED  = '1.3.6.1.2.1.2.2.1.5'
    OID_IF_STATUS = '1.3.6.1.2.1.2.2.1.8'
    OID_IF_ALIAS  = '1.3.6.1.2.1.31.1.1.1.18'

    ports = []
    try:
        walk_targets = {
            'descr': OID_IF_DESCR, 'type': OID_IF_TYPE, 'speed': OID_IF_SPEED,
            'status': OID_IF_STATUS, 'alias': OID_IF_ALIAS,
        }
        walk_results: Dict[str, List] = {}
        with ThreadPoolExecutor(max_workers=5) as pool:
            futures = {
                pool.submit(snmp_bulk_walk, host, community, oid,
                            version=version, max_rows=256): key
                for key, oid in walk_targets.items()
            }
            for future in as_completed(futures):
                walk_results[futures[future]] = future.result()

        def index_by(rows):
            return {oid.split('.')[-1]: val for oid, val in rows}

        descr_map  = index_by(walk_results.get('descr',  []))
        type_map   = index_by(walk_results.get('type',   []))
        speed_map  = index_by(walk_results.get('speed',  []))
        status_map = index_by(walk_results.get('status', []))
        alias_map  = index_by(walk_results.get('alias',  []))

        IF_TYPE_PON    = {'166', '250', '251', '252'}
        IF_TYPE_UPLINK = {'6', '117', '26'}
        IF_TYPE_LAG    = {'161'}

        for idx, name in descr_map.items():
            if not name:
                continue
            if_type    = type_map.get(idx, '0')
            speed_bps  = int(speed_map.get(idx, 0) or 0)
            oper_status= status_map.get(idx, '2')
            alias      = alias_map.get(idx, '')

            if if_type in IF_TYPE_PON or 'gpon' in name.lower() or 'pon' in name.lower():
                port_type = 'pon'
            elif if_type in IF_TYPE_LAG or 'lag' in name.lower() or 'trunk' in name.lower():
                port_type = 'lag'
            elif if_type in IF_TYPE_UPLINK or 'eth' in name.lower() or 'ge' in name.lower() or 'xge' in name.lower():
                port_type = 'uplink'
            else:
                port_type = 'other'

            if if_type in ('24', '131', '53') or 'loop' in name.lower() or 'null' in name.lower():
                continue

            ports.append({
                'if_index'   : int(idx),
                'name'       : name,
                'description': alias or '',
                'port_type'  : port_type,
                'status'     : 'up' if oper_status == '1' else 'down',
                'speed_mbps' : speed_bps // 1_000_000,
            })
    except Exception as e:
        logger.error(f"Port discovery error for {host}: {e}")

    return sorted(ports, key=lambda p: (p['port_type'], p['name']))


def _extract_pon_port(oid_str: str) -> str:
    parts = oid_str.split('.')
    if len(parts) >= 4:
        return f'{parts[-4]}/{parts[-3]}/{parts[-2]}'
    return parts[-1] if parts else ''


# ─── VLAN discovery ──────────────────────────────────────────────────────────

OID_DOT1Q_VLAN_NAME       = '1.3.6.1.2.1.17.7.1.4.3.1.1'
OID_DOT1Q_VLAN_ROW_STATUS = '1.3.6.1.2.1.17.7.1.4.3.1.5'
OID_HUAWEI_VLAN_DESCR     = '1.3.6.1.4.1.2011.5.25.42.1.1.2.1.1'


def discover_vlans_snmp(host: str, community: str, version: str = 'v2c',
                        port: int = 161) -> List[Dict[str, Any]]:
    vlans: Dict[int, Dict[str, Any]] = {}

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
