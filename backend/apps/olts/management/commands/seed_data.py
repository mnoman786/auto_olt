"""
Management command: python manage.py seed_data
Seeds the database with realistic dummy data for development/demo.
"""
import random
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()


class Command(BaseCommand):
    help = 'Seed database with dummy OLT, ONU, VLAN, port and log data'

    def add_arguments(self, parser):
        parser.add_argument('--clear', action='store_true', help='Clear existing data before seeding')

    def handle(self, *args, **options):
        from apps.olts.models import OLT, OLTPort, SetupLog
        from apps.onus.models import ONU, ProvisioningLog
        from apps.vlans.models import VLAN

        if options['clear']:
            self.stdout.write('Clearing existing data...')
            ProvisioningLog.objects.all().delete()
            SetupLog.objects.all().delete()
            ONU.objects.all().delete()
            VLAN.objects.all().delete()
            OLTPort.objects.all().delete()
            OLT.objects.all().delete()

        # Get or create demo user
        user, created = User.objects.get_or_create(
            username='admin',
            defaults={'email': 'admin@gmail.com', 'is_staff': True, 'is_superuser': True}
        )
        if created:
            user.set_password('admin123')
            user.save()
            self.stdout.write(self.style.SUCCESS('Created admin user (password: admin123)'))

        now = timezone.now()

        # ── OLT definitions ──────────────────────────────────────────────────
        olt_configs = [
            dict(
                name='Main-OLT-01',
                ip_address='192.168.1.1',
                snmp_version='v2c',
                snmp_read_community='rd_mainolt01x',
                snmp_write_community='wr_mainolt01x',
                status='active',
                system_name='MA5608T-Main-OLT-01',
                system_description='Huawei MA5608T GPON OLT',
                system_uptime='12 days, 4:23:11',
                last_polled=now - timedelta(minutes=3),
                olt_admin_username='admin',
                olt_admin_password='Admin@123',
                telnet_username='admin',
                telnet_password='Admin@123',
                telnet_enabled=True,
                telnet_port=23,
            ),
            dict(
                name='Branch-OLT-02',
                ip_address='192.168.2.1',
                snmp_version='v2c',
                snmp_read_community='rd_brancholt02',
                snmp_write_community='wr_brancholt02',
                status='active',
                system_name='ZTE-C300-Branch-02',
                system_description='ZTE C300 GPON OLT',
                system_uptime='3 days, 17:05:44',
                last_polled=now - timedelta(minutes=8),
                olt_admin_username='admin',
                olt_admin_password='zte@2024',
                telnet_username='admin',
                telnet_password='zte@2024',
                telnet_enabled=True,
                telnet_port=23,
            ),
            dict(
                name='Tower-OLT-03',
                ip_address='10.10.5.1',
                snmp_version='v2c',
                snmp_read_community='rd_towerolt03x',
                snmp_write_community='wr_towerolt03x',
                status='error',
                system_name='',
                system_description='',
                system_uptime='',
                last_polled=now - timedelta(hours=2),
                olt_admin_username='admin',
                olt_admin_password='tower123',
                telnet_username='admin',
                telnet_password='tower123',
                telnet_enabled=True,
                telnet_port=23,
            ),
            dict(
                name='Backup-OLT-04',
                ip_address='172.16.0.1',
                snmp_version='v2c',
                snmp_read_community='rd_backupolt04',
                snmp_write_community='wr_backupolt04',
                status='offline',
                system_name='MA5683T-Backup-04',
                system_description='Huawei MA5683T GPON OLT',
                system_uptime='0 days, 0:00:00',
                last_polled=now - timedelta(hours=6),
                olt_admin_username='admin',
                olt_admin_password='backup@olt',
                telnet_username='admin',
                telnet_password='backup@olt',
                telnet_enabled=True,
                telnet_port=23,
            ),
        ]

        olts = []
        for cfg in olt_configs:
            olt, _ = OLT.objects.update_or_create(
                user=user, ip_address=cfg['ip_address'],
                defaults={**cfg, 'user': user}
            )
            olts.append(olt)
            self.stdout.write(f'  OLT: {olt.name} [{olt.status}]')

        # ── Setup logs ───────────────────────────────────────────────────────
        def make_setup_logs(olt, success=True):
            SetupLog.objects.filter(olt=olt).delete()
            steps = [
                ('setup_start',    f'Starting setup for OLT: {olt.name} ({olt.ip_address})', 'info'),
                ('telnet_connect', f'Connecting via Telnet to {olt.ip_address}:{olt.telnet_port}...', 'info'),
                ('telnet_connect', f'Telnet login: OK - Authenticated as {olt.olt_admin_username}', 'success'),
                ('create_user',    'Creating management user: autoolt', 'info'),
                ('create_user',    'Management user autoolt created successfully', 'success'),
                ('configure_snmp', 'Configuring SNMP via CLI...', 'info'),
                ('configure_snmp', f'SNMP read community "{olt.snmp_read_community}" configured', 'success'),
                ('snmp_check',     f'Testing SNMP connectivity to {olt.ip_address}...', 'info'),
            ]
            if success:
                steps += [
                    ('snmp_check',    'SNMP read connectivity: OK', 'success'),
                    ('snmp_write',    'SNMP write access: OK', 'success'),
                    ('sys_info',      f'System: {olt.system_name} | Uptime: {olt.system_uptime}', 'success'),
                    ('setup_complete', f'OLT {olt.name} setup complete. Status: ACTIVE', 'success'),
                ]
            else:
                steps.append(('snmp_check', 'SNMP connectivity FAILED: Connection timed out (UDP 161)', 'error'))
            for step, msg, level in steps:
                SetupLog.objects.create(olt=olt, step=step, message=msg, level=level)

        make_setup_logs(olts[0], success=True)
        make_setup_logs(olts[1], success=True)
        make_setup_logs(olts[2], success=False)
        make_setup_logs(olts[3], success=True)

        # ── Ports ────────────────────────────────────────────────────────────
        def make_ports(olt, pon_count=8, uplink_count=2):
            OLTPort.objects.filter(olt=olt).delete()
            ports = []
            for i in range(1, uplink_count + 1):
                ports.append(OLTPort(
                    olt=olt, if_index=i,
                    name=f'GigabitEthernet0/0/{i-1}',
                    description=f'Uplink Port {i}',
                    port_type='uplink',
                    status='up' if i == 1 else random.choice(['up', 'down']),
                    speed_mbps=1000, onu_count=0,
                ))
            ports.append(OLTPort(
                olt=olt, if_index=50,
                name='Eth-Trunk0', description='LAG to Core',
                port_type='lag', status='up', speed_mbps=2000, onu_count=0,
            ))
            for i in range(1, pon_count + 1):
                count = random.randint(0, 16)
                ports.append(OLTPort(
                    olt=olt, if_index=100 + i,
                    name=f'GPON0/{i}',
                    description=f'PON Port {i}',
                    port_type='pon',
                    status=random.choice(['up', 'up', 'up', 'down']),
                    speed_mbps=2500, onu_count=count,
                ))
            OLTPort.objects.bulk_create(ports)

        for olt in olts:
            make_ports(olt, pon_count=8, uplink_count=2)

        # ── VLANs ────────────────────────────────────────────────────────────
        vlan_defs = [
            (100, 'Management',    'OLT management VLAN'),
            (200, 'Internet',      'Customer internet service'),
            (300, 'IPTV',          'IPTV/video streaming'),
            (400, 'VoIP',          'Voice over IP'),
            (500, 'Corporate',     'Corporate clients'),
            (600, 'Backup-Link',   'Backup uplink traffic'),
        ]
        all_vlans = {}
        for olt in olts[:2]:   # active OLTs only
            all_vlans[olt.id] = {}
            for vid, name, desc in vlan_defs:
                v, _ = VLAN.objects.get_or_create(
                    olt=olt, vlan_id=vid,
                    defaults={'name': name, 'description': desc}
                )
                all_vlans[olt.id][vid] = v

        # ── ONUs ─────────────────────────────────────────────────────────────
        vendors = ['HWTC', 'ZTEG', 'FHTT', 'ALPH', 'CMSZ']
        pon_ports = [f'GPON0/{i}' for i in range(1, 9)]

        def rand_serial(vendor):
            return vendor + ''.join(random.choices('0123456789ABCDEF', k=8))

        def rand_mac():
            return ':'.join(f'{random.randint(0,255):02X}' for _ in range(6))

        def rand_signal():
            return round(random.uniform(-28.0, -14.0), 2)

        onu_statuses_weighted = (
            ['active'] * 10 + ['registered'] * 3 + ['offline'] * 2 + ['unregistered'] * 3
        )

        for olt_idx, olt in enumerate(olts[:2]):
            vlans = list(all_vlans[olt.id].values())
            onu_count = 30 if olt_idx == 0 else 18
            for i in range(onu_count):
                serial = rand_serial(random.choice(vendors))
                pon = random.choice(pon_ports)
                status = random.choice(onu_statuses_weighted)
                vlan = random.choice(vlans) if status in ('active', 'registered') else None
                method = random.choice(['snmp', 'telnet', 'hybrid']) if status == 'active' else 'none'
                ONU.objects.get_or_create(
                    olt=olt, serial_number=serial,
                    defaults=dict(
                        mac_address=rand_mac(),
                        pon_port=pon,
                        onu_index=i + 1,
                        onu_id=(i % 128) + 1,
                        status=status,
                        signal_strength=rand_signal() if status != 'unregistered' else None,
                        service_profile='HSI_1G' if vlan else '',
                        vlan=vlan,
                        provision_method=method,
                        description=f'Customer-{olt.name}-{i+1:03d}',
                        last_seen=now - timedelta(minutes=random.randint(1, 120)) if status != 'unregistered' else None,
                        registered_at=now - timedelta(days=random.randint(1, 60)) if status in ('active', 'registered') else None,
                    )
                )

        # ── Provisioning logs for active ONUs ────────────────────────────────
        for olt in olts[:2]:
            for onu in olt.onus.filter(status='active')[:5]:
                if onu.provisioning_logs.exists():
                    continue
                for step, msg, level in [
                    ('start',           f'Starting ONU provisioning via {onu.provision_method} method', 'info'),
                    ('snmp_provision',  'Attempting SNMP provisioning...', 'info'),
                    ('snmp_provision',  f'ONU {onu.serial_number} enabled via SNMP', 'success'),
                    ('bind_vlan',       f'VLAN {onu.vlan.vlan_id if onu.vlan else 200} bound', 'success'),
                    ('complete',        f'ONU {onu.serial_number} successfully provisioned', 'success'),
                ]:
                    ProvisioningLog.objects.create(onu=onu, step=step, message=msg, level=level)

        # ── Summary ──────────────────────────────────────────────────────────
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('=' * 50))
        self.stdout.write(self.style.SUCCESS('Seed complete!'))
        self.stdout.write(f'  OLTs   : {OLT.objects.filter(user=user).count()}')
        self.stdout.write(f'  ONUs   : {ONU.objects.count()}')
        self.stdout.write(f'  VLANs  : {VLAN.objects.count()}')
        self.stdout.write(f'  Ports  : {OLTPort.objects.count()}')
        self.stdout.write(self.style.SUCCESS('=' * 50))
        self.stdout.write('Login: admin / admin123')
