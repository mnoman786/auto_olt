"""
Seed command — generates a large realistic dataset for UI testing.

Usage:
    python manage.py seed_data             # default scale
    python manage.py seed_data --flush     # wipe everything first, then seed
    python manage.py seed_data --users 15 --olts-per-user 8 --onus-per-olt 150

What gets created
-----------------
  • 10 ISP users  (isp_user_01 … isp_user_10)  password: Test@1234
  • 1  admin user (admin)                        password: Admin@1234
  • 3–8 OLTs per user  (Huawei + ZTE mix, direct + VPN)
  • 10–20 VLANs per OLT
  • 80–200 ONUs per OLT  (realistic serials, mixed statuses, signal strengths)
  • Setup logs per OLT
  • Provisioning logs per registered ONU
  • 2–5 support tickets per user, some with replies
"""
import random
import string
import ipaddress
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction

from apps.accounts.models import User
from apps.olts.models import OLT, SetupLog, OLTPort
from apps.onus.models import ONU, ProvisioningLog
from apps.vlans.models import VLAN
from apps.tickets.models import Ticket, TicketReply


# ── Realistic-looking data pools ──────────────────────────────────────────────

OLT_NAMES = [
    "Core-OLT-{}", "Fiber-Hub-{}", "PON-Node-{}", "GPON-{}", "Backbone-{}",
    "Access-OLT-{}", "ISP-Node-{}", "District-{}", "Zone-{}-OLT", "Sector-{}",
]

PAKISTAN_CITIES = [
    "Lahore", "Karachi", "Islamabad", "Rawalpindi", "Faisalabad",
    "Multan", "Peshawar", "Quetta", "Gujranwala", "Sialkot",
    "Hyderabad", "Abbottabad", "Bahawalpur", "Sargodha", "Sukkur",
]

VENDORS = ["Huawei", "ZTE", "C-Data", "V-SOL"]

SYSTEM_DESCRIPTIONS = [
    "Huawei Technologies Co. MA5800-X7 V800R021C10SPC300",
    "Huawei Technologies Co. MA5600T V800R015C10",
    "ZTE Corporation. ZXAN C300 V2.1.3P1",
    "ZTE Corporation. ZXAN C600 V3.2.1",
    "C-Data FD1608GS GPON OLT v2.0.5",
    "V-SOL V1600G-16 GPON OLT v3.1.2",
]

PON_PORTS = [
    "0/1/0", "0/1/1", "0/1/2", "0/1/3", "0/1/4", "0/1/5", "0/1/6", "0/1/7",
    "0/2/0", "0/2/1", "0/2/2", "0/2/3", "0/2/4", "0/2/5", "0/2/6", "0/2/7",
]

VLAN_NAMES = [
    "Internet", "IPTV", "VoIP", "Management", "Customers",
    "Business", "Gaming", "CCTV", "Corporate", "Residential",
    "Fiber-BB", "4K-IPTV", "Guest-WiFi", "IoT", "Backup",
    "Transit", "Peering", "DMZ", "Admin", "Monitoring",
]

ONU_DESCRIPTIONS = [
    "Customer - {city} Flat {n}",
    "Shop - {city} Market",
    "Office - Floor {n}",
    "Residence - Block {n}",
    "ISP Client #{n}",
    "Corporate - {city}",
    "Home User {n}",
    "Small Business #{n}",
    "Fiber Customer {n}",
    "",  # some have no description
]

TICKET_SUBJECTS = [
    "OLT unreachable after power outage",
    "ONUs showing offline after firmware update",
    "SNMP polling not working",
    "Cannot provision new ONUs",
    "Signal strength fluctuating",
    "VLAN sync failing",
    "WireGuard VPN disconnecting frequently",
    "Setup wizard stuck at 'Configuring SNMP'",
    "Bulk registration timing out",
    "Dashboard showing wrong ONU count",
    "Telnet connection refused",
    "GPON port showing no ONUs",
    "High latency on provisioned ONUs",
    "OLT status stuck in 'configuring'",
    "Need help adding second OLT",
]

TICKET_MESSAGES = [
    "Since the power outage yesterday, our OLT at {} is showing as offline. "
    "All ONUs went unregistered. Please advise.",

    "After the firmware update last night, {} ONUs went offline. "
    "SNMP is returning errors. The OLT IP is still reachable via ping.",

    "The SNMP polling is not discovering any new ONUs on {}. "
    "We verified the community string is correct.",

    "We're unable to provision new ONUs on {}. "
    "The provisioning starts but fails at the Telnet step with 'Login timed out'.",

    "Signal strength on several ONUs connected to {} has been fluctuating "
    "between -22 and -30 dBm over the past 48 hours.",
]

TICKET_REPLIES = [
    "We've looked into your issue. Please check if the SNMP agent is enabled on the OLT.",
    "Can you share the setup logs from the dashboard? That will help us diagnose the issue.",
    "This is a known issue with that firmware version. Please downgrade to v800R018.",
    "Resolved — the issue was caused by an incorrect VLAN configuration.",
    "We've escalated this to our tier-2 team. You'll hear back within 24 hours.",
    "Please try clicking 'Retry Setup' on the OLT detail page and let us know if the error persists.",
]

SETUP_LOG_STEPS = [
    ("telnet_connect",      "Connecting to OLT via Telnet…",           "info"),
    ("telnet_login",        "Telnet login successful",                  "success"),
    ("create_mgmt_user",    "Management user 'autoolt' created",        "success"),
    ("snmp_configure",      "SNMP communities configured on device",    "success"),
    ("snmp_validate",       "SNMP connectivity validated",              "success"),
    ("snmp_write",          "SNMP write access confirmed",              "success"),
    ("system_info",         "System info fetched via SNMP",             "success"),
    ("onu_discovery",       "Initial ONU discovery completed",          "success"),
    ("setup_complete",      "OLT setup complete and marked active",     "success"),
]

PROV_LOG_STEPS = [
    ("telnet_connect",  "Connected to OLT via Telnet",                       "success"),
    ("snmp_provision",  "ONU added via SNMP",                                 "success"),
    ("vlan_bind",       "VLAN bound to ONU port",                             "success"),
    ("verify",          "ONU verified as active on PON port",                 "success"),
    ("complete",        "Provisioning complete",                              "success"),
]


# ── Helpers ───────────────────────────────────────────────────────────────────

def rand_ip(prefix="192.168"):
    return f"{prefix}.{random.randint(1,254)}.{random.randint(1,254)}"

def rand_huawei_serial():
    return "HWTC" + "".join(random.choices(string.hexdigits.upper(), k=8))

def rand_zte_serial():
    return "ZTEG" + "".join(random.choices(string.hexdigits.upper(), k=8))

def rand_cdata_serial():
    return "CDAT" + "".join(random.choices(string.hexdigits.upper(), k=8))

def rand_mac():
    return ":".join(f"{random.randint(0,255):02X}" for _ in range(6))

def rand_signal():
    # realistic GPON rx power: -8 to -28 dBm
    return round(random.uniform(-28.0, -8.0), 2)

def rand_uptime():
    days = random.randint(0, 400)
    hours = random.randint(0, 23)
    mins = random.randint(0, 59)
    return f"{days} days, {hours}:{mins:02d}:00"

def _vpn_pool():
    """Yield unique VPN virtual IPs from 10.100.0.0/16."""
    used = set(OLT.objects.filter(vpn_virtual_ip__isnull=False)
                          .values_list('vpn_virtual_ip', flat=True))
    for ip in ipaddress.IPv4Network('10.100.0.0/16').hosts():
        candidate = str(ip)
        if candidate not in used:
            used.add(candidate)
            yield candidate


# ── Main command ──────────────────────────────────────────────────────────────

class Command(BaseCommand):
    help = 'Seed the database with realistic dummy data for UI testing.'

    def add_arguments(self, parser):
        parser.add_argument('--flush',          action='store_true',
                            help='Delete all existing seeded data before creating new data')
        parser.add_argument('--users',          type=int, default=10)
        parser.add_argument('--olts-per-user',  type=int, default=5)
        parser.add_argument('--onus-per-olt',   type=int, default=120)

    def handle(self, *args, **opts):
        if opts['flush']:
            self._flush()

        n_users   = opts['users']
        n_olts    = opts['olts_per_user']
        n_onus    = opts['onus_per_olt']

        self.stdout.write(self.style.MIGRATE_HEADING(
            f'\nSeeding: {n_users} users x {n_olts} OLTs x {n_onus} ONUs...\n'
        ))

        admin = self._ensure_admin()
        users = self._create_users(n_users)
        vpn_gen = _vpn_pool()

        total_olts = total_onus = total_vlans = total_tickets = 0

        for user in users:
            num_olts = random.randint(max(1, n_olts - 2), n_olts + 2)
            for i in range(num_olts):
                with transaction.atomic():
                    olt = self._create_olt(user, i, vpn_gen)
                    vlans = self._create_vlans(olt)
                    self._create_setup_logs(olt)
                    self._create_ports(olt)
                    num_onus = random.randint(max(10, n_onus - 30), n_onus + 30)
                    self._create_onus(olt, vlans, num_onus)
                    total_olts  += 1
                    total_vlans += len(vlans)
                    total_onus  += num_onus
                    self.stdout.write(f"  OK {user.username} -> {olt.name}  "
                                      f"({num_onus} ONUs, {len(vlans)} VLANs)")

            tickets = self._create_tickets(user, admin)
            total_tickets += len(tickets)

        self.stdout.write(self.style.SUCCESS(
            f'\nDone!  {n_users} users | {total_olts} OLTs | '
            f'{total_onus} ONUs | {total_vlans} VLANs | {total_tickets} tickets\n'
        ))
        self.stdout.write('  Login credentials:')
        self.stdout.write('    isp_user_01 .. isp_user_{:02d}  =>  Test@1234'.format(n_users))
        self.stdout.write('    admin (superuser)              =>  Admin@1234\n')

    # ── Flush ──────────────────────────────────────────────────────────────────

    def _flush(self):
        self.stdout.write(self.style.WARNING('Flushing seeded data...'))
        User.objects.filter(username__startswith='isp_user_').delete()
        self.stdout.write('  Seeded users deleted (OLTs/ONUs/VLANs cascade-deleted).')

    # ── Users ─────────────────────────────────────────────────────────────────

    def _ensure_admin(self):
        admin, created = User.objects.get_or_create(
            username='admin',
            defaults={
                'email': 'admin@autoolt.local',
                'is_staff': True,
                'is_superuser': True,
            }
        )
        if created:
            admin.set_password('Admin@1234')
            admin.save()
            self.stdout.write(self.style.SUCCESS('  Created admin user'))
        return admin

    def _create_users(self, n):
        users = []
        for i in range(1, n + 1):
            username = f'isp_user_{i:02d}'
            city = random.choice(PAKISTAN_CITIES)
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    'email': f'{username}@isp-{city.lower()}.pk',
                    'first_name': random.choice(
                        ['Ali', 'Ahmed', 'Hassan', 'Usman', 'Bilal',
                         'Sara', 'Fatima', 'Ayesha', 'Zara', 'Hira']
                    ),
                    'last_name': random.choice(
                        ['Khan', 'Ahmed', 'Ali', 'Malik', 'Chaudhry',
                         'Sheikh', 'Qureshi', 'Siddiqui', 'Butt', 'Rana']
                    ),
                }
            )
            if created:
                user.set_password('Test@1234')
                user.save()
            users.append(user)
        self.stdout.write(f'  {len(users)} ISP users ready')
        return users

    # ── OLTs ─────────────────────────────────────────────────────────────────

    def _create_olt(self, user, index, vpn_gen):
        city   = random.choice(PAKISTAN_CITIES)
        vendor = random.choice(VENDORS)
        name   = random.choice(OLT_NAMES).format(city) + f'-{index+1}'
        conn   = random.choices(['direct', 'vpn'], weights=[70, 30])[0]
        status = random.choices(
            ['active', 'active', 'active', 'error', 'pending', 'configuring'],
            weights=[60, 60, 60, 10, 5, 5]
        )[0]

        vpn_ip = None
        if conn == 'vpn':
            try:
                vpn_ip = next(vpn_gen)
            except StopIteration:
                conn = 'direct'

        snmp_ver = random.choice(['v2c', 'v2c', 'v2c', 'v1'])
        polled_at = (timezone.now() - timedelta(minutes=random.randint(1, 120))
                     if status == 'active' else None)

        olt = OLT.objects.create(
            user=user,
            name=name,
            ip_address=rand_ip(),
            connection_type=conn,
            vpn_virtual_ip=vpn_ip,
            snmp_version=snmp_ver,
            snmp_read_community=f'public_{random.randint(100,999)}',
            snmp_write_community=f'private_{random.randint(100,999)}',
            telnet_enabled=random.choice([True, True, False]),
            telnet_port=random.choice([23, 23, 23, 2323]),
            olt_admin_username='admin',
            olt_admin_password='Admin123!',
            status=status,
            system_name=f'{vendor}-{city[:3].upper()}-{index+1}',
            system_description=random.choice(SYSTEM_DESCRIPTIONS),
            system_uptime=rand_uptime() if status == 'active' else '',
            last_polled=polled_at,
            line_profiles=[
                {'id': 1, 'name': 'default'},
                {'id': 2, 'name': 'hsi-100m'},
                {'id': 3, 'name': 'hsi-1g'},
            ],
            srv_profiles=[
                {'id': 1, 'name': 'default'},
                {'id': 2, 'name': 'tr069'},
            ],
        )
        return olt

    # ── VLANs ────────────────────────────────────────────────────────────────

    def _create_vlans(self, olt):
        used_ids = set()
        vlans = []
        # always add management VLAN
        vlans.append(VLAN.objects.create(
            olt=olt, vlan_id=1, name='Management',
            description='OLT management VLAN',
            source='discovered', pushed_to_olt=True,
        ))
        used_ids.add(1)

        count = random.randint(10, 20)
        for _ in range(count):
            vid = random.choice(
                [10, 20, 30, 40, 50, 100, 101, 200, 300, 400,
                 500, 600, 700, 800, 900, 1000, 1100, 1200, 1500, 2000,
                 2100, 2500, 3000, 3500, 4000, 4090]
            )
            if vid in used_ids:
                continue
            used_ids.add(vid)
            name = random.choice(VLAN_NAMES)
            src  = random.choice(['discovered', 'discovered', 'managed'])
            vlans.append(VLAN.objects.create(
                olt=olt,
                vlan_id=vid,
                name=name,
                description=f'{name} traffic' if src == 'managed' else '',
                source=src,
                pushed_to_olt=(src == 'managed'),
                last_seen_on_olt=timezone.now() - timedelta(hours=random.randint(1, 72))
                    if src == 'discovered' else None,
            ))
        return vlans

    # ── OLT Ports ────────────────────────────────────────────────────────────

    def _create_ports(self, olt):
        ports = []
        # PON ports
        for i in range(random.randint(4, 16)):
            ports.append(OLTPort(
                olt=olt,
                if_index=i + 1,
                name=f'gpon0/{i}',
                description=f'GPON PON Port {i}',
                port_type='pon',
                status=random.choices(['up', 'down'], weights=[85, 15])[0],
                speed_mbps=2500,
                onu_count=random.randint(0, 64),
            ))
        # Uplink ports
        for i in range(random.randint(1, 4)):
            ports.append(OLTPort(
                olt=olt,
                if_index=100 + i,
                name=f'eth0/{i}',
                description=f'Uplink GE Port {i}',
                port_type='uplink',
                status='up',
                speed_mbps=random.choice([1000, 10000]),
                onu_count=0,
            ))
        OLTPort.objects.bulk_create(ports, ignore_conflicts=True)

    # ── Setup logs ───────────────────────────────────────────────────────────

    def _create_setup_logs(self, olt):
        if olt.status not in ('active', 'error'):
            return
        now = timezone.now()
        logs = []
        steps = SETUP_LOG_STEPS if olt.status == 'active' else SETUP_LOG_STEPS[:5]
        for offset, (step, msg, level) in enumerate(steps):
            logs.append(SetupLog(
                olt=olt, step=step, message=msg, level=level,
                created_at=now - timedelta(minutes=len(steps) - offset),
            ))
        if olt.status == 'error':
            logs.append(SetupLog(
                olt=olt, step='error', level='error',
                message='SNMP connectivity check failed — device unreachable on UDP 161',
                created_at=now,
            ))
        SetupLog.objects.bulk_create(logs)

    # ── ONUs ─────────────────────────────────────────────────────────────────

    def _create_onus(self, olt, vlans, count):
        status_pool = (
            ['active'] * 55 +
            ['registered'] * 15 +
            ['unregistered'] * 20 +
            ['offline'] * 8 +
            ['provisioning'] * 2
        )

        # Pick serial generator based on OLT system description
        desc = olt.system_description.lower()
        if 'huawei' in desc:
            serial_gen = rand_huawei_serial
        elif 'zte' in desc:
            serial_gen = rand_zte_serial
        else:
            serial_gen = rand_cdata_serial

        serials = set()
        onus = []
        prov_logs = []
        city = random.choice(PAKISTAN_CITIES)

        for idx in range(count):
            # unique serial
            for _ in range(20):
                sn = serial_gen()
                if sn not in serials:
                    serials.add(sn)
                    break

            status = random.choice(status_pool)
            port   = random.choice(PON_PORTS)
            signal = rand_signal() if status != 'unregistered' else None
            vlan   = random.choice(vlans) if status in ('active', 'registered') else None
            desc_tmpl = random.choice(ONU_DESCRIPTIONS)
            desc_text = desc_tmpl.format(city=city, n=idx + 1)

            last_seen = None
            registered_at = None
            if status in ('active', 'registered'):
                registered_at = timezone.now() - timedelta(days=random.randint(1, 180))
                last_seen = timezone.now() - timedelta(minutes=random.randint(1, 30))
            elif status == 'offline':
                last_seen = timezone.now() - timedelta(hours=random.randint(2, 72))

            onus.append(ONU(
                olt=olt,
                serial_number=sn,
                mac_address=rand_mac(),
                pon_port=port,
                onu_index=idx,
                onu_id=idx % 64,
                status=status,
                signal_strength=signal,
                vlan=vlan,
                description=desc_text,
                last_seen=last_seen,
                registered_at=registered_at,
            ))

        # bulk create all ONUs
        created = ONU.objects.bulk_create(onus, ignore_conflicts=True)

        # provisioning logs for registered/active ONUs
        for onu in created:
            if onu.status in ('active', 'registered') and onu.id:
                t = onu.registered_at or timezone.now()
                for offset, (step, msg, level) in enumerate(PROV_LOG_STEPS):
                    prov_logs.append(ProvisioningLog(
                        onu=onu, step=step, message=msg, level=level,
                        created_at=t + timedelta(seconds=offset * 3),
                    ))

        if prov_logs:
            ProvisioningLog.objects.bulk_create(prov_logs, batch_size=500)

    # ── Tickets ──────────────────────────────────────────────────────────────

    def _create_tickets(self, user, admin):
        olts = list(user.olts.all()[:3])
        tickets = []
        for _ in range(random.randint(2, 5)):
            olt  = random.choice(olts) if olts else None
            subj = random.choice(TICKET_SUBJECTS)
            msg  = random.choice(TICKET_MESSAGES).format(olt.name if olt else 'our OLT')
            status = random.choices(
                ['open', 'answered', 'closed'],
                weights=[40, 30, 30]
            )[0]
            t = Ticket.objects.create(
                user=user, olt=olt, subject=subj, message=msg, status=status,
            )
            # admin reply on answered/closed tickets
            if status in ('answered', 'closed'):
                TicketReply.objects.create(
                    ticket=t, author=admin,
                    message=random.choice(TICKET_REPLIES),
                )
            # user follow-up on some open tickets
            if status == 'open' and random.random() < 0.4:
                TicketReply.objects.create(
                    ticket=t, author=user,
                    message="Still seeing the issue. Any update?",
                )
            tickets.append(t)
        return tickets
