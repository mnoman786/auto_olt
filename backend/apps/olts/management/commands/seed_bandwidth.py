"""
Management command — seed fake bandwidth samples for testing the traffic graphs UI.

Usage:
    python manage.py seed_bandwidth <olt_id>          # 24 hours of data
    python manage.py seed_bandwidth <olt_id> --hours 48
    python manage.py seed_bandwidth <olt_id> --clear  # wipe existing samples first
"""
import math
import random
from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.olts.models import OLT, OLTPort, BandwidthSample


# Realistic traffic patterns per port type
PORT_PROFILES = [
    {'name': 'GPON 0/1', 'type': 'pon',    'peak_in': 800,  'peak_out': 400},
    {'name': 'GPON 0/2', 'type': 'pon',    'peak_in': 600,  'peak_out': 300},
    {'name': 'GPON 0/3', 'type': 'pon',    'peak_in': 950,  'peak_out': 500},
    {'name': 'GPON 0/4', 'type': 'pon',    'peak_in': 450,  'peak_out': 200},
    {'name': 'GE 0/1',   'type': 'uplink', 'peak_in': 2800, 'peak_out': 1400},
    {'name': 'GE 0/2',   'type': 'uplink', 'peak_in': 1200, 'peak_out': 600},
]


def _traffic(t: float, peak: float, phase: float = 0.0) -> float:
    """
    Simulate realistic diurnal traffic curve:
      - Low at night (2–6 AM)
      - Morning ramp (7–9 AM)
      - Daytime plateau (~40–60% of peak)
      - Evening peak (8–10 PM)
    t = hour of day (0–24), peak = max Mbps
    """
    # Diurnal sine curve centred at 20:00
    hour_angle = (t - 20) * math.pi / 12
    base = 0.5 + 0.45 * math.sin(hour_angle - math.pi / 2 + phase)
    base = max(0.05, base)
    # Add jitter (±10%)
    jitter = random.uniform(0.90, 1.10)
    return round(base * peak * jitter, 4)


class Command(BaseCommand):
    help = 'Seed fake bandwidth samples for the traffic graphs UI'

    def add_arguments(self, parser):
        parser.add_argument('olt_id', type=int)
        parser.add_argument('--hours', type=int, default=24)
        parser.add_argument('--interval', type=int, default=5,
                            help='Sample interval in minutes (default 5)')
        parser.add_argument('--clear', action='store_true',
                            help='Delete existing samples for this OLT first')

    def handle(self, *args, **options):
        olt_id   = options['olt_id']
        hours    = options['hours']
        interval = options['interval']
        clear    = options['clear']

        try:
            olt = OLT.objects.get(id=olt_id)
        except OLT.DoesNotExist:
            raise CommandError(f'OLT with id={olt_id} not found.')

        self.stdout.write(f'OLT: {olt.name} ({olt.ip_address})')

        # Create ports if none exist
        if not olt.ports.exists():
            self.stdout.write('  No ports found — creating demo ports...')
            for p in PORT_PROFILES:
                OLTPort.objects.get_or_create(
                    olt=olt,
                    name=p['name'],
                    defaults={
                        'if_index': PORT_PROFILES.index(p) + 1,
                        'port_type': p['type'],
                        'status': 'up',
                        'speed_mbps': 10000 if p['type'] == 'uplink' else 2500,
                    },
                )
            self.stdout.write(self.style.SUCCESS(f'  Created {len(PORT_PROFILES)} demo ports'))

        ports = list(olt.ports.all())
        if not ports:
            raise CommandError('No ports available.')

        if clear:
            deleted, _ = BandwidthSample.objects.filter(port__olt=olt).delete()
            self.stdout.write(f'  Cleared {deleted} existing samples')

        # Build time series
        now       = timezone.now().replace(second=0, microsecond=0)
        step      = timedelta(minutes=interval)
        total_pts = (hours * 60) // interval
        start     = now - step * total_pts

        samples = []
        prev_octets: dict[int, tuple[int, int]] = {}  # port_id -> (in, out)

        for i in range(total_pts + 1):
            ts      = start + step * i
            hour_of_day = (ts.hour + ts.minute / 60)

            for port in ports:
                profile = next(
                    (p for p in PORT_PROFILES if p['name'] == port.name),
                    PORT_PROFILES[0],
                )
                phase = PORT_PROFILES.index(profile) * 0.3

                in_mbps  = _traffic(hour_of_day, profile['peak_in'],  phase)
                out_mbps = _traffic(hour_of_day, profile['peak_out'], phase + 0.5)

                interval_sec = interval * 60
                in_bytes  = int(in_mbps  * 1_000_000 / 8 * interval_sec)
                out_bytes = int(out_mbps * 1_000_000 / 8 * interval_sec)

                prev_in, prev_out = prev_octets.get(port.id, (0, 0))
                cur_in  = prev_in  + in_bytes
                cur_out = prev_out + out_bytes
                prev_octets[port.id] = (cur_in, cur_out)

                if i > 0:  # skip first point (no delta yet)
                    samples.append(BandwidthSample(
                        port=port,
                        timestamp=ts,
                        in_mbps=in_mbps,
                        out_mbps=out_mbps,
                        in_octets_raw=cur_in,
                        out_octets_raw=cur_out,
                    ))

        BandwidthSample.objects.bulk_create(samples, batch_size=500)

        self.stdout.write(self.style.SUCCESS(
            f'  Seeded {len(samples)} samples across {len(ports)} ports '
            f'({hours}h at {interval}-min intervals)'
        ))
        self.stdout.write(f'  View at: /olts/{olt_id}/bandwidth')
