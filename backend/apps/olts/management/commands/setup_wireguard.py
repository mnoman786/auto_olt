"""
One-time server setup for the WireGuard interface used by Auto OLT.
Creates /etc/wireguard/wg0.conf with a generated keypair, brings the
interface up, and enables the systemd service.

Usage:  sudo /path/to/venv/bin/python manage.py setup_wireguard
Optional:
  --interface wg0          (default)
  --listen-port 51820      (default)
  --network 10.100.0.0/16  (default, must match VPN_POOL in serializers)
  --force                  Overwrite existing wg0.conf
"""
import os
import subprocess
from pathlib import Path
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = 'Generate /etc/wireguard/<iface>.conf and enable wg-quick on the server.'

    def add_arguments(self, parser):
        parser.add_argument('--interface', default='wg0')
        parser.add_argument('--listen-port', type=int, default=51820)
        parser.add_argument('--network', default='10.100.0.0/16')
        parser.add_argument('--force', action='store_true')

    def handle(self, *args, **opts):
        if os.geteuid() != 0:
            raise CommandError('This command must be run as root (sudo).')

        iface = opts['interface']
        port = opts['listen_port']
        network = opts['network']
        force = opts['force']

        conf_path = Path('/etc/wireguard') / f'{iface}.conf'
        conf_path.parent.mkdir(parents=True, exist_ok=True)

        if conf_path.exists() and not force:
            raise CommandError(
                f'{conf_path} already exists. Pass --force to overwrite '
                f'(this will regenerate the server private key and break all existing peers).'
            )

        # Generate keypair
        try:
            priv = subprocess.run(['wg', 'genkey'], check=True, capture_output=True, text=True).stdout.strip()
            pub = subprocess.run(['wg', 'pubkey'], check=True, capture_output=True, text=True,
                                 input=priv).stdout.strip()
        except FileNotFoundError:
            raise CommandError('wg binary not found. Install wireguard-tools: apt install wireguard-tools')
        except subprocess.CalledProcessError as e:
            raise CommandError(f'wg keygen failed: {e.stderr}')

        # Server tunnel IP — first usable host of the pool (e.g. 10.100.0.1/16)
        prefix = network.split('/')[0].rsplit('.', 1)[0]   # "10.100.0"
        mask = network.split('/')[1]                       # "16"
        server_tunnel_ip = f'{prefix}.1/{mask}'

        config = (
            f'[Interface]\n'
            f'PrivateKey = {priv}\n'
            f'Address = {server_tunnel_ip}\n'
            f'ListenPort = {port}\n'
            f'SaveConfig = true\n'
        )

        conf_path.write_text(config)
        conf_path.chmod(0o600)
        self.stdout.write(self.style.SUCCESS(f'Wrote {conf_path}'))
        self.stdout.write(f'  Server public key:  {pub}')
        self.stdout.write(f'  Server tunnel IP:   {server_tunnel_ip}')
        self.stdout.write(f'  Listen port:        UDP {port}')

        # Open firewall port (best-effort)
        for cmd in (
            ['ufw', 'allow', f'{port}/udp'],
            ['firewall-cmd', '--permanent', f'--add-port={port}/udp'],
        ):
            try:
                subprocess.run(cmd, check=True, capture_output=True)
                self.stdout.write(self.style.SUCCESS(f'Firewall: {" ".join(cmd)}'))
                break
            except (FileNotFoundError, subprocess.CalledProcessError):
                continue

        # Bring interface up + enable on boot
        try:
            subprocess.run(['systemctl', 'enable', '--now', f'wg-quick@{iface}'], check=True, capture_output=True)
            self.stdout.write(self.style.SUCCESS(f'Enabled wg-quick@{iface}'))
        except subprocess.CalledProcessError as e:
            self.stderr.write(f'Could not enable wg-quick service: {e.stderr.decode() if e.stderr else e}')

        self.stdout.write('')
        self.stdout.write(self.style.WARNING('Add this to your backend/.env so the app advertises the right endpoint:'))
        self.stdout.write(f'  WG_INTERFACE={iface}')
        self.stdout.write(f'  WG_ENDPOINT=<your-public-server-ip>:{port}')
        self.stdout.write(f'  WG_SERVER_PUBLIC_KEY={pub}')
