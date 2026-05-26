"""
Management command — verify Celery + Redis are working end-to-end.

Usage:
    python manage.py check_celery
    python manage.py check_celery --olt-id 55   # also fire per-OLT tasks
    python manage.py check_celery --timeout 30  # wait longer for slow workers
"""
import time
from django.core.management.base import BaseCommand


GREEN  = '\033[0;32m'
YELLOW = '\033[1;33m'
RED    = '\033[0;31m'
CYAN   = '\033[0;36m'
BOLD   = '\033[1m'
NC     = '\033[0m'

OK   = f'{GREEN}  ✓  PASS{NC}'
FAIL = f'{RED}  ✗  FAIL{NC}'
WARN = f'{YELLOW}  ⚠  WARN{NC}'
INFO = f'{CYAN}  →{NC}'


def _fmt(label: str, result: str, detail: str = '') -> str:
    pad = 42
    line = f'  {label:<{pad}} {result}'
    if detail:
        line += f'  {CYAN}({detail}){NC}'
    return line


class Command(BaseCommand):
    help = 'Verify Celery worker + Redis are operational'

    def add_arguments(self, parser):
        parser.add_argument('--olt-id', type=int, default=None,
                            help='OLT id to use for per-OLT task tests')
        parser.add_argument('--timeout', type=int, default=15,
                            help='Seconds to wait for each task result (default 15)')

    def handle(self, *args, **options):
        olt_id  = options['olt_id']
        timeout = options['timeout']
        results = []

        self.stdout.write(f'\n{BOLD}Auto OLT — Celery Health Check{NC}')
        self.stdout.write('=' * 50)

        # ── 1. Redis connectivity ─────────────────────────────────────────────
        self.stdout.write(f'\n{BOLD}1. Redis{NC}')
        try:
            import redis as redis_lib
            from django.conf import settings
            url = getattr(settings, 'CELERY_BROKER_URL', 'redis://127.0.0.1:6379/0')
            r = redis_lib.from_url(url)
            pong = r.ping()
            assert pong
            info = r.info('server')
            ver  = info.get('redis_version', '?')
            mem  = info.get('used_memory_human', '?')
            self.stdout.write(_fmt('Redis ping', OK, f'v{ver}, mem={mem}'))
            results.append(True)
        except Exception as exc:
            self.stdout.write(_fmt('Redis ping', FAIL, str(exc)[:80]))
            results.append(False)

        # ── 2. Celery worker ping ─────────────────────────────────────────────
        self.stdout.write(f'\n{BOLD}2. Celery Worker{NC}')
        try:
            from auto_olt.celery import app
            response = app.control.ping(timeout=5)
            if response:
                workers = list(response[0].keys()) if response else []
                for w in workers:
                    self.stdout.write(_fmt(f'Worker: {w}', OK, 'responded to ping'))
                results.append(True)
            else:
                self.stdout.write(_fmt('Worker ping', FAIL, 'no workers responded — is celery running?'))
                results.append(False)
        except Exception as exc:
            self.stdout.write(_fmt('Worker ping', FAIL, str(exc)[:80]))
            results.append(False)

        # ── 3. Celery Beat schedule ───────────────────────────────────────────
        self.stdout.write(f'\n{BOLD}3. Beat Schedule{NC}')
        try:
            from django.conf import settings
            schedule = getattr(settings, 'CELERY_BEAT_SCHEDULE', {})
            if schedule:
                for name, entry in schedule.items():
                    self.stdout.write(_fmt(
                        f'  {name}',
                        OK,
                        f"task={entry['task']}, every {entry['schedule']}s"
                    ))
                results.append(True)
            else:
                self.stdout.write(_fmt('Beat schedule', WARN, 'CELERY_BEAT_SCHEDULE is empty'))
                results.append(False)
        except Exception as exc:
            self.stdout.write(_fmt('Beat schedule', FAIL, str(exc)[:80]))
            results.append(False)

        # ── 4. Fire dispatch_bandwidth_poll (dispatcher) ──────────────────────
        self.stdout.write(f'\n{BOLD}4. Task Execution{NC}')
        try:
            from tasks import dispatch_bandwidth_poll_task
            t0     = time.time()
            result = dispatch_bandwidth_poll_task.apply_async()
            value  = result.get(timeout=timeout)
            ms     = int((time.time() - t0) * 1000)
            dispatched = value.get('dispatched', 0)
            self.stdout.write(_fmt(
                'dispatch_bandwidth_poll',
                OK,
                f'dispatched={dispatched} OLTs, took {ms}ms'
            ))
            results.append(True)
        except Exception as exc:
            self.stdout.write(_fmt('dispatch_bandwidth_poll', FAIL, str(exc)[:80]))
            results.append(False)

        # ── 5. Fire cleanup_old_logs ──────────────────────────────────────────
        try:
            from tasks import cleanup_old_logs_task
            t0     = time.time()
            result = cleanup_old_logs_task.apply_async()
            value  = result.get(timeout=timeout)
            ms     = int((time.time() - t0) * 1000)
            deleted = sum(v for k, v in value.items() if k.endswith('_deleted') and isinstance(v, int))
            self.stdout.write(_fmt(
                'cleanup_old_logs',
                OK,
                f'deleted={deleted} old records, took {ms}ms'
            ))
            results.append(True)
        except Exception as exc:
            self.stdout.write(_fmt('cleanup_old_logs', FAIL, str(exc)[:80]))
            results.append(False)

        # ── 6. Per-OLT bandwidth poll (only if --olt-id given) ────────────────
        if olt_id:
            try:
                from tasks import poll_bandwidth_olt_task
                t0     = time.time()
                result = poll_bandwidth_olt_task.apply_async(args=[olt_id])
                value  = result.get(timeout=timeout)
                ms     = int((time.time() - t0) * 1000)
                if value.get('skipped'):
                    self.stdout.write(_fmt(
                        f'poll_bandwidth_olt (OLT {olt_id})',
                        WARN,
                        f"skipped: {value.get('reason', 'lock held or OLT inactive')}"
                    ))
                else:
                    samples = value.get('samples_created', 0)
                    self.stdout.write(_fmt(
                        f'poll_bandwidth_olt (OLT {olt_id})',
                        OK,
                        f'samples_created={samples}, took {ms}ms'
                    ))
                results.append(True)
            except Exception as exc:
                self.stdout.write(_fmt(
                    f'poll_bandwidth_olt (OLT {olt_id})',
                    FAIL, str(exc)[:80]
                ))
                results.append(False)

            # ── 7. poll_olt_onus ──────────────────────────────────────────────
            try:
                from tasks import poll_olt_onus_task
                t0     = time.time()
                result = poll_olt_onus_task.apply_async(args=[olt_id])
                value  = result.get(timeout=timeout)
                ms     = int((time.time() - t0) * 1000)
                if value.get('error') == 'poll_already_running':
                    self.stdout.write(_fmt(
                        f'poll_olt_onus (OLT {olt_id})',
                        WARN, 'skipped — poll already running'
                    ))
                else:
                    discovered = value.get('discovered', 0)
                    self.stdout.write(_fmt(
                        f'poll_olt_onus (OLT {olt_id})',
                        OK,
                        f'discovered={discovered}, took {ms}ms'
                    ))
                results.append(True)
            except Exception as exc:
                self.stdout.write(_fmt(
                    f'poll_olt_onus (OLT {olt_id})',
                    FAIL, str(exc)[:80]
                ))
                results.append(False)

        # ── 8. Redis cache round-trip ─────────────────────────────────────────
        self.stdout.write(f'\n{BOLD}5. Redis Cache (Django){NC}')
        try:
            from django.core.cache import cache
            key = '_celery_check_test_key'
            cache.set(key, 'autoolt_ok', timeout=10)
            val = cache.get(key)
            assert val == 'autoolt_ok'
            cache.delete(key)
            self.stdout.write(_fmt('Cache set/get/delete', OK, 'round-trip works'))
            results.append(True)
        except Exception as exc:
            self.stdout.write(_fmt('Cache set/get/delete', FAIL, str(exc)[:80]))
            results.append(False)

        # ── Summary ───────────────────────────────────────────────────────────
        passed = sum(results)
        total  = len(results)
        self.stdout.write('\n' + '=' * 50)
        if passed == total:
            self.stdout.write(f'{GREEN}{BOLD}  All {total} checks passed — Celery is healthy ✓{NC}\n')
        else:
            failed = total - passed
            self.stdout.write(f'{RED}{BOLD}  {failed}/{total} checks FAILED — see above for details{NC}\n')
