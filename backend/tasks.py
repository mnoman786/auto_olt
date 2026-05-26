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
  - dispatch_bandwidth_poll_task: no retry — just dispatches per-OLT tasks
  - poll_bandwidth_olt_task: 1 retry / 60s — SNMP walk can be transiently busy
  - cleanup_old_logs_task:   no retry — runs daily, failure is non-critical
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
        result = poll_olt_onus(olt_id)
        _trigger_auto_provision(olt_id)
        return result
    except Exception as exc:
        logger.warning(f"poll_olt_onus failed for OLT {olt_id}, retrying: {exc}")
        raise self.retry(exc=exc)
    finally:
        cache.delete(lock_key)


def _trigger_auto_provision(olt_id: int) -> None:
    """After a successful ONU poll, auto-register any unregistered ONUs if enabled."""
    try:
        from apps.olts.models import AutoProvisionConfig
        from apps.onus.models import ONU
        config = AutoProvisionConfig.objects.filter(olt_id=olt_id, enabled=True).select_related('default_vlan').first()
        if not config:
            return
        unregistered = ONU.objects.filter(olt_id=olt_id, status='unregistered').values_list('id', flat=True)
        for onu_id in unregistered:
            provision_onu_task.delay(
                onu_id,
                vlan_id=config.default_vlan_id,
                line_profile_id=config.line_profile_id,
                srv_profile_id=config.srv_profile_id,
            )
            logger.info(f"Auto-provision queued for ONU {onu_id} (OLT {olt_id})")
    except Exception as exc:
        logger.warning(f"_trigger_auto_provision failed for OLT {olt_id}: {exc}")


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


@shared_task(bind=True, max_retries=0, name='tasks.dispatch_bandwidth_poll')
def dispatch_bandwidth_poll_task(self) -> dict:
    """
    Fired by Beat every 5 minutes.
    Dispatches one poll_bandwidth_olt_task per active OLT so all OLTs
    are polled in parallel by the worker pool instead of sequentially.
    Scales to thousands of OLTs — dispatcher finishes in milliseconds.
    """
    from apps.olts.models import OLT
    olt_ids = list(OLT.objects.filter(status='active').values_list('id', flat=True))
    for olt_id in olt_ids:
        poll_bandwidth_olt_task.delay(olt_id)
    return {'dispatched': len(olt_ids)}


@shared_task(bind=True, max_retries=1, default_retry_delay=60, name='tasks.poll_bandwidth_olt')
def poll_bandwidth_olt_task(self, olt_id: int) -> dict:
    """
    Poll bandwidth for a single OLT.
    A Redis lock ensures only one poll runs per OLT at a time — if Beat fires
    again before the previous poll finished (e.g. slow SNMP), the new task
    exits immediately rather than queuing behind it.
    """
    from django.core.cache import cache
    from django.db.models import Max
    from django.utils import timezone
    from apps.olts.models import OLT, BandwidthSample
    from services import snmp_service
    from services.provisioning_service import _connect_ip

    lock_key = f'bw_poll_lock:olt:{olt_id}'
    # TTL slightly under 5 min so a crashed task doesn't block the next cycle
    if not cache.add(lock_key, '1', 270):
        logger.info(f"poll_bandwidth_olt skipped for OLT {olt_id} — previous poll still running")
        return {'skipped': True}

    OID_IN  = '1.3.6.1.2.1.31.1.1.1.6'   # ifHCInOctets
    OID_OUT = '1.3.6.1.2.1.31.1.1.1.10'  # ifHCOutOctets

    try:
        try:
            olt = OLT.objects.get(id=olt_id, status='active')
        except OLT.DoesNotExist:
            return {'skipped': True, 'reason': 'OLT not found or inactive'}

        host = _connect_ip(olt)
        in_map  = snmp_service.snmp_bulk_walk(host, olt.snmp_read_community, OID_IN,  version=olt.snmp_version)
        out_map = snmp_service.snmp_bulk_walk(host, olt.snmp_read_community, OID_OUT, version=olt.snmp_version)

        def _to_index_map(walk_result: dict) -> dict:
            out = {}
            for oid, val in walk_result.items():
                try:
                    out[int(oid.rsplit('.', 1)[-1])] = int(val)
                except (ValueError, TypeError):
                    pass
            return out

        in_raw  = _to_index_map(in_map)
        out_raw = _to_index_map(out_map)

        ports = {p.if_index: p for p in olt.ports.all()}
        if not ports:
            return {'samples_created': 0}

        latest_ids = (
            BandwidthSample.objects
            .filter(port__olt=olt)
            .values('port_id')
            .annotate(max_id=Max('id'))
            .values_list('max_id', flat=True)
        )
        prev_samples = {s.port_id: s for s in BandwidthSample.objects.filter(id__in=latest_ids)}

        now = timezone.now()
        new_samples = []

        for if_index, port in ports.items():
            cur_in  = in_raw.get(if_index)
            cur_out = out_raw.get(if_index)
            if cur_in is None or cur_out is None:
                continue

            prev = prev_samples.get(port.id)
            if prev is not None:
                interval = (now - prev.timestamp).total_seconds()
                if interval < 1:
                    continue
                delta_in  = cur_in  - prev.in_octets_raw
                delta_out = cur_out - prev.out_octets_raw
                if delta_in  < 0: delta_in  += 2 ** 64
                if delta_out < 0: delta_out += 2 ** 64
                in_mbps  = delta_in  * 8 / interval / 1_000_000
                out_mbps = delta_out * 8 / interval / 1_000_000
            else:
                in_mbps = out_mbps = 0.0

            new_samples.append(BandwidthSample(
                port=port,
                timestamp=now,
                in_mbps=round(in_mbps, 4),
                out_mbps=round(out_mbps, 4),
                in_octets_raw=cur_in,
                out_octets_raw=cur_out,
            ))

        if new_samples:
            BandwidthSample.objects.bulk_create(new_samples)
            # Bust cached API responses for this OLT so next page load is fresh
            for h in (1, 3, 6, 12, 24, 48, 168):
                cache.delete(f'bw_api:{olt_id}:h{h}')

        return {'samples_created': len(new_samples)}

    except Exception as exc:
        logger.warning(f"poll_bandwidth_olt failed for OLT {olt_id}, retrying: {exc}")
        raise self.retry(exc=exc)
    finally:
        cache.delete(lock_key)


@shared_task(bind=True, max_retries=0, name='tasks.cleanup_old_logs')
def cleanup_old_logs_task(self) -> dict:
    """Delete old provisioning/setup logs and bandwidth samples to keep DB lean."""
    from django.utils import timezone
    from datetime import timedelta
    from django.db.models import OuterRef, Subquery

    now = timezone.now()
    result = {}

    # ProvisioningLog: keep 30 days, always keep latest 50 per ONU
    try:
        from apps.onus.models import ProvisioningLog, ONU
        cutoff = now - timedelta(days=30)
        # Keep the 50 newest per ONU regardless of age
        keep_ids = (
            ProvisioningLog.objects
            .filter(onu=OuterRef('onu'))
            .order_by('-created_at')
            .values('id')[:50]
        )
        deleted, _ = (
            ProvisioningLog.objects
            .filter(created_at__lt=cutoff)
            .exclude(id__in=Subquery(keep_ids))
            .delete()
        )
        result['provisioning_logs_deleted'] = deleted
    except Exception as exc:
        logger.warning(f"cleanup: ProvisioningLog delete failed: {exc}")
        result['provisioning_logs_error'] = str(exc)

    # SetupLog: keep 90 days
    try:
        from apps.olts.models import SetupLog
        cutoff = now - timedelta(days=90)
        deleted, _ = SetupLog.objects.filter(created_at__lt=cutoff).delete()
        result['setup_logs_deleted'] = deleted
    except Exception as exc:
        logger.warning(f"cleanup: SetupLog delete failed: {exc}")
        result['setup_logs_error'] = str(exc)

    # BandwidthSample: keep 7 days
    try:
        from apps.olts.models import BandwidthSample
        cutoff = now - timedelta(days=7)
        deleted, _ = BandwidthSample.objects.filter(timestamp__lt=cutoff).delete()
        result['bandwidth_samples_deleted'] = deleted
    except Exception as exc:
        logger.warning(f"cleanup: BandwidthSample delete failed: {exc}")
        result['bandwidth_samples_error'] = str(exc)

    return result
