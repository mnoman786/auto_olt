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
    """Add or update WireGuard peer for a VPN OLT."""
    if not olt.wg_client_public_key:
        return False, 'No client public key provided'
    if not olt.vpn_virtual_ip:
        return False, 'No virtual IP assigned'

    allowed_ips = f"{olt.vpn_virtual_ip}/32"
    if olt.wg_client_subnet:
        allowed_ips += f",{olt.wg_client_subnet}"

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

    peer_connected = False
    last_handshake = 0
    if olt.wg_client_public_key:
        last_handshake = get_peer_handshake(olt.wg_client_public_key)
        # Connected if handshake within last 10 minutes
        peer_connected = (time.time() - last_handshake) < 600 if last_handshake else False

    return {
        'server_public_key': server_pubkey,
        'server_endpoint': endpoint,
        'virtual_ip': olt.vpn_virtual_ip,
        'client_public_key': olt.wg_client_public_key,
        'client_subnet': olt.wg_client_subnet,
        'peer_configured': bool(olt.wg_client_public_key),
        'peer_connected': peer_connected,
        'last_handshake': last_handshake,
    }
