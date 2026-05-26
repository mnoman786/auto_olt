import random
import math
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.onus.models import ONU, SignalSample


class Command(BaseCommand):
    help = 'Seed dummy signal history for an ONU'

    def add_arguments(self, parser):
        parser.add_argument('onu_id', type=int)
        parser.add_argument('--hours', type=int, default=48)
        parser.add_argument('--interval', type=int, default=15, help='Minutes between samples')

    def handle(self, *args, **options):
        onu_id = options['onu_id']
        hours = options['hours']
        interval = options['interval']

        try:
            onu = ONU.objects.get(pk=onu_id)
        except ONU.DoesNotExist:
            self.stderr.write(f'ONU {onu_id} not found')
            return

        now = timezone.now()
        total_samples = (hours * 60) // interval
        base = -23.0  # healthy starting point (dBm)

        samples = []
        for i in range(total_samples):
            t = now - timedelta(minutes=interval * (total_samples - i))
            # Gentle sine drift + noise, with a dip around 1/3 of the way
            drift = 3.0 * math.sin(2 * math.pi * i / total_samples)
            dip = -4.0 * math.exp(-((i - total_samples // 3) ** 2) / (2 * (total_samples // 12) ** 2))
            noise = random.gauss(0, 0.4)
            rx = round(base + drift + dip + noise, 2)
            samples.append(SignalSample(onu=onu, timestamp=t, rx_power=rx))

        SignalSample.objects.filter(onu=onu).delete()
        SignalSample.objects.bulk_create(samples)
        self.stdout.write(self.style.SUCCESS(
            f'Created {len(samples)} signal samples for ONU {onu_id} ({onu.serial_number})'
        ))
