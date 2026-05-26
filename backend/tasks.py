"""
Celery tasks for all long-running OLT/ONU operations.

Each task wraps a synchronous service function. The service functions handle
their own error logging to SetupLog/ProvisioningLog, so tasks don't need to
duplicate that — they only handle unexpected exceptions at the task boundary.

Retry policy per task:
  - run_olt_setup_task:      no retry — setup function sets olt.status='error' on failure
  - poll_olt_onus_task:      1 retry / 60s — SNMP polls can be transiently busy
  - provision_onu_task:      no retry — function handles errors internally
  - push_vlan_to_olt_task:   1 retry / 30s — Telnet connection may be momentarily down
  - sync_vlans_from_olt_task: 1 retry / 60s
"""
import logging
from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=0, name='tasks.run_olt_setup')
def run_olt_setup_task(self, olt_id: int) -> None:
    from services.provisioning_service import run_olt_setup
    try:
        run_olt_setup(olt_id)
    except Exception as exc:
        # Unexpected crash outside the function's own error handling —
        # mark OLT as error so it doesn't stay stuck in 'configuring'.
        logger.exception(f"Unhandled exception in run_olt_setup for OLT {olt_id}: {exc}")
        try:
            from apps.olts.models import OLT
            OLT.objects.filter(id=olt_id, status='configuring').update(status='error')
        except Exception:
            pass
        raise


@shared_task(bind=True, max_retries=1, default_retry_delay=60, name='tasks.poll_olt_onus')
def poll_olt_onus_task(self, olt_id: int) -> dict:
    from django.core.cache import cache
    from services.provisioning_service import poll_olt_onus

    lock_key = f'poll_lock:olt:{olt_id}'
    lock_ttl = 120  # seconds — longer than a normal poll but shorter than task timeout

    # Acquire a Redis lock so only one poll runs per OLT at a time.
    # cache.add() is atomic: returns True only if the key didn't exist.
    if not cache.add(lock_key, '1', lock_ttl):
        logger.info(f"poll_olt_onus skipped for OLT {olt_id} — another poll is already running")
        return {'discovered': 0, 'new': 0, 'updated': 0, 'skipped': 0, 'error': 'poll_already_running'}

    try:
        return poll_olt_onus(olt_id)
    except Exception as exc:
        logger.warning(f"poll_olt_onus failed for OLT {olt_id}, retrying: {exc}")
        raise self.retry(exc=exc)
    finally:
        cache.delete(lock_key)


@shared_task(bind=True, max_retries=0, name='tasks.provision_onu')
def provision_onu_task(self, onu_id: int, vlan_id=None,
                       line_profile_id: int = 1, srv_profile_id: int = 1) -> dict:
    from services.provisioning_service import provision_onu
    return provision_onu(
        onu_id,
        vlan_id=vlan_id,
        line_profile_id=line_profile_id,
        srv_profile_id=srv_profile_id,
    )


@shared_task(bind=True, max_retries=1, default_retry_delay=30, name='tasks.push_vlan_to_olt')
def push_vlan_to_olt_task(self, vlan_db_id: int) -> dict:
    from services.provisioning_service import push_vlan_to_olt
    try:
        return push_vlan_to_olt(vlan_db_id)
    except Exception as exc:
        logger.warning(f"push_vlan_to_olt failed for VLAN {vlan_db_id}, retrying: {exc}")
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=1, default_retry_delay=60, name='tasks.sync_vlans_from_olt')
def sync_vlans_from_olt_task(self, olt_id: int) -> dict:
    from services.provisioning_service import sync_vlans_from_olt
    try:
        return sync_vlans_from_olt(olt_id)
    except Exception as exc:
        logger.warning(f"sync_vlans_from_olt failed for OLT {olt_id}, retrying: {exc}")
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=1, default_retry_delay=30, name='tasks.discover_ports')
def discover_ports_task(self, olt_id: int) -> dict:
    """
    Discover OLT ports via SNMP and save to DB.
    Runs in background — 5 parallel SNMP walks take ~10s total.
    """
    from apps.olts.models import OLT, OLTPort
    from services import snmp_service
    from services.provisioning_service import _connect_ip

    result = {'success': False, 'count': 0, 'error': None}
    try:
        olt = OLT.objects.get(id=olt_id)
    except OLT.DoesNotExist:
        result['error'] = f'OLT {olt_id} not found'
        return result

    try:
        discovered = snmp_service.discover_ports_snmp(
            host=_connect_ip(olt),
            community=olt.snmp_read_community,
            version=olt.snmp_version,
        )
        # Count ONUs per PON port via DB query (one query total)
        onu_port_counts = dict(
            olt.onus.values_list('pon_port')
                     .annotate(n=__import__('django.db.models', fromlist=['Count']).Count('id'))
                     .values_list('pon_port', 'n')
        )
        port_objs = []
        for p in discovered:
            onu_count = 0
            if p['port_type'] == 'pon':
                name_lower = p['name'].lower()
                onu_count = sum(v for k, v in onu_port_counts.items()
                                if name_lower in k.lower())
            port_objs.append(OLTPort(
                olt=olt,
                if_index=p['if_index'],
                name=p.get('name', ''),
                description=p.get('description', ''),
                port_type=p.get('port_type', 'other'),
                status=p.get('status', 'unknown'),
                speed_mbps=p.get('speed_mbps', 0),
                onu_count=onu_count,
            ))
        if port_objs:
            OLTPort.objects.bulk_create(
                port_objs,
                update_conflicts=True,
                unique_fields=['olt', 'if_index'],
                update_fields=['name', 'description', 'port_type', 'status',
                               'speed_mbps', 'onu_count', 'updated_at'],
            )
        result['success'] = True
        result['count'] = len(port_objs)
    except Exception as exc:
        logger.warning(f"discover_ports failed for OLT {olt_id}, retrying: {exc}")
        raise self.retry(exc=exc)

    return result
