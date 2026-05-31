"""
WireGuard peer management service.
Manages wg0 peers automatically when VPN OLTs are added/updated/deleted.
Requires the backend process to have permission to run `wg` and `wg-quick` commands.
Add to sudoers: <service_user> ALL=(ALL) NOPASSWD: /usr/bin/wg, /usr/bin/wg-quick
"""
import subprocess
import logging
import time
from django.conf import settings

logger = logging.getLogger(__name__)

WG_INTERFACE = getattr(settings, 'WG_INTERFACE', 'wg0')
WG_ENDPOINT = getattr(settings, 'WG_ENDPOINT', '')


def _run(*cmd):
    result = subprocess.run(['sudo'] + list(cmd), capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or f"Command failed: {' '.join(cmd)}")
    return result.stdout.strip()


def get_server_public_key() -> str:
    try:
        return _run('wg', 'show', WG_INTERFACE, 'public-key')
    except Exception:
        return getattr(settings, 'WG_SERVER_PUBLIC_KEY', '')


def get_peer_handshake(public_key: str) -> int:
    """Return last handshake timestamp (epoch seconds), 0 if never."""
    try:
        output = _run('wg', 'show', WG_INTERFACE, 'latest-handshakes')
        for line in output.splitlines():
            parts = line.split()
            if len(parts) == 2 and parts[0] == public_key:
                return int(parts[1])
    except Exception:
        pass
    return 0


def add_peer(olt) -> tuple[bool, str]:
    """Add or update WireGuard peer for a VPN OLT.

    Design: each customer's MikroTik gets a unique virtual IP from 10.100.0.0/16.
    Routing uses ONLY that virtual IP — the customer LAN subnet is NOT added to
    allowed-ips because multiple customers commonly share 192.168.1.0/24 and
    WireGuard treats allowed-ips as a routing key (last wg-set wins → collision).
    Customer's MikroTik must instead DNAT vpn_virtual_ip → olt.ip_address.
    """
    if not olt.wg_client_public_key:
        return False, 'No client public key provided'
    if not olt.vpn_virtual_ip:
        return False, 'No virtual IP assigned'

    allowed_ips = f"{olt.vpn_virtual_ip}/32"

    try:
        _run('wg', 'set', WG_INTERFACE, 'peer', olt.wg_client_public_key, 'allowed-ips', allowed_ips)
        save = subprocess.run(['sudo', 'wg-quick', 'save', WG_INTERFACE], capture_output=True)
        if save.returncode != 0:
            err = save.stderr.decode().strip()
            logger.error(f"wg-quick save failed for OLT {olt.id}: {err}")
            return False, f'Peer added in memory but config not saved to disk: {err}'
        logger.info(f"WireGuard peer added for OLT {olt.id} ({olt.name}): {olt.wg_client_public_key[:20]}...")
        return True, 'Peer added successfully'
    except RuntimeError as e:
        logger.error(f"Failed to add WireGuard peer for OLT {olt.id}: {e}")
        return False, str(e)


def remove_peer(public_key: str) -> tuple[bool, str]:
    """Remove a WireGuard peer by public key."""
    if not public_key:
        return False, 'No public key provided'
    try:
        _run('wg', 'set', WG_INTERFACE, 'peer', public_key, 'remove')
        save = subprocess.run(['sudo', 'wg-quick', 'save', WG_INTERFACE], capture_output=True)
        if save.returncode != 0:
            err = save.stderr.decode().strip()
            logger.error(f"wg-quick save failed after peer removal: {err}")
        logger.info(f"WireGuard peer removed: {public_key[:20]}...")
        return True, 'Peer removed'
    except RuntimeError as e:
        logger.error(f"Failed to remove WireGuard peer: {e}")
        return False, str(e)


def get_wg_info(olt) -> dict:
    """Return all WireGuard info needed to configure a MikroTik peer."""
    server_pubkey = get_server_public_key()
    endpoint = WG_ENDPOINT or getattr(settings, 'WG_ENDPOINT', '')
    endpoint_warning = '' if endpoint else (
        'WG_ENDPOINT is not configured on the server — set it in backend/.env '
        'to "<public-server-ip>:51820" so customers can paste the right value.'
    )

    peer_connected = False
    last_handshake = 0
    if olt.wg_client_public_key:
        last_handshake = get_peer_handshake(olt.wg_client_public_key)
        # Connected if handshake within last 10 minutes
        peer_connected = (time.time() - last_handshake) < 600 if last_handshake else False

    # Ready-to-paste MikroTik DNAT/masquerade rules so the OLT is reachable
    # via the virtual IP through the WireGuard tunnel.
    mikrotik_dnat = ''
    mikrotik_masq = ''
    if olt.vpn_virtual_ip and olt.ip_address:
        mikrotik_dnat = (
            f'/ip firewall nat add chain=dstnat in-interface=wg-autoolt '
            f'dst-address={olt.vpn_virtual_ip} action=dst-nat '
            f'to-addresses={olt.ip_address}'
        )
        mikrotik_masq = (
            f'/ip firewall nat add chain=srcnat '
            f'src-address={olt.vpn_virtual_ip} action=masquerade'
        )

    return {
        'server_public_key': server_pubkey,
        'server_endpoint': endpoint,
        'server_endpoint_warning': endpoint_warning,
        'virtual_ip': olt.vpn_virtual_ip,
        'olt_lan_ip': olt.ip_address,
        'client_public_key': olt.wg_client_public_key,
        'client_subnet': olt.wg_client_subnet,
        'peer_configured': bool(olt.wg_client_public_key),
        'peer_connected': peer_connected,
        'last_handshake': last_handshake,
        'mikrotik_dnat_cmd': mikrotik_dnat,
        'mikrotik_masquerade_cmd': mikrotik_masq,
        'mikrotik_full_script': build_mikrotik_full_script(olt, server_pubkey, endpoint),
    }


def build_mikrotik_full_script(olt, server_pubkey: str, endpoint: str) -> str:
    """
    Combine all RouterOS commands into a single copy-paste block.

    Assumes the customer has already created their WireGuard interface (Step 1
    of the setup wizard) since RouterOS generates the client keypair locally
    and we never see the private key. This script handles steps 2-5: peer,
    IP address, DNAT and masquerade rules.
    """
    if not (olt.vpn_virtual_ip and olt.ip_address and server_pubkey and endpoint):
        return ''

    try:
        endpoint_host, endpoint_port = endpoint.rsplit(':', 1)
    except ValueError:
        endpoint_host, endpoint_port = endpoint, '51820'

    lines = [
        '# === Auto OLT WireGuard setup for MikroTik RouterOS 7.1+ ===',
        f'# OLT: {olt.name}  |  Virtual IP: {olt.vpn_virtual_ip}  |  LAN IP: {olt.ip_address}',
        '# Run AFTER you have created the wg-autoolt interface and shared its public key.',
        '',
        '# Step 1: Register the Auto OLT server as a peer',
        '/interface/wireguard/peers/add \\',
        '    interface=wg-autoolt \\',
        f'    public-key="{server_pubkey}" \\',
        f'    endpoint-address={endpoint_host} \\',
        f'    endpoint-port={endpoint_port} \\',
        '    allowed-address=10.100.0.0/16 \\',
        '    persistent-keepalive=25s',
        '',
        '# Step 2: Assign virtual IP to the WireGuard interface',
        f'/ip/address/add address={olt.vpn_virtual_ip}/32 interface=wg-autoolt',
        '',
        '# Step 3: DNAT virtual IP to the real OLT LAN IP',
        f'/ip/firewall/nat/add chain=dstnat in-interface=wg-autoolt \\',
        f'    dst-address={olt.vpn_virtual_ip} action=dst-nat to-addresses={olt.ip_address}',
        '',
        '# Step 4: Masquerade return traffic so the OLT sees the MikroTik as source',
        f'/ip/firewall/nat/add chain=srcnat \\',
        f'    src-address={olt.vpn_virtual_ip} action=masquerade',
    ]
    return '\n'.join(lines)


