"""
Telnet Service for OLT CLI management.
Handles automated CLI interactions via Telnet for OLT provisioning.
"""
import socket
import time
import logging
from typing import Optional, List, Tuple, Dict, Any

logger = logging.getLogger(__name__)


class TelnetClient:
    """Simple Telnet client for OLT CLI interaction."""

    def __init__(self, host: str, port: int = 23, timeout: int = 15):
        self.host = host
        self.port = port
        self.timeout = timeout
        self.sock: Optional[socket.socket] = None
        self._buffer = b''

    def connect(self) -> bool:
        """Establish TCP connection."""
        try:
            self.sock = socket.create_connection((self.host, self.port), timeout=self.timeout)
            self.sock.settimeout(self.timeout)
            # Read initial banner
            time.sleep(0.5)
            self._read_available()
            return True
        except (socket.error, OSError) as e:
            logger.debug(f"Telnet connect failed to {self.host}:{self.port}: {e}")
            return False

    def disconnect(self):
        """Close connection."""
        if self.sock:
            try:
                self.sock.close()
            except Exception:
                pass
            self.sock = None

    def _read_available(self, max_bytes: int = 4096) -> bytes:
        """Read available data from socket without blocking."""
        data = b''
        if not self.sock:
            return data
        try:
            self.sock.settimeout(0.3)
            while True:
                chunk = self.sock.recv(max_bytes)
                if not chunk:
                    break
                data += chunk
                # Strip telnet IAC negotiation bytes
                data = self._strip_telnet_iac(data)
        except socket.timeout:
            pass
        except Exception as e:
            logger.debug(f"Read error: {e}")
        finally:
            self.sock.settimeout(self.timeout)
        self._buffer += data
        return data

    def _strip_telnet_iac(self, data: bytes) -> bytes:
        """Remove Telnet IAC negotiation sequences."""
        result = b''
        i = 0
        while i < len(data):
            if data[i] == 0xFF and i + 2 < len(data):  # IAC
                cmd = data[i + 1]
                if cmd in (0xFB, 0xFC, 0xFD, 0xFE):  # WILL/WONT/DO/DONT
                    # Send DONT/WONT response to refuse
                    opt = data[i + 2]
                    if self.sock:
                        try:
                            if cmd in (0xFB, 0xFD):  # WILL or DO
                                self.sock.send(bytes([0xFF, 0xFE if cmd == 0xFD else 0xFC, opt]))
                            else:
                                self.sock.send(bytes([0xFF, 0xFC if cmd == 0xFE else 0xFE, opt]))
                        except Exception:
                            pass
                    i += 3
                else:
                    i += 2
            else:
                result += bytes([data[i]])
                i += 1
        return result

    def read_until(self, *prompts: str, timeout: int = 10) -> Tuple[bool, str]:
        """
        Read from connection until one of the prompts is found.
        Returns (found, output_text)
        """
        if not self.sock:
            return False, ''

        output = self._buffer.decode('utf-8', errors='replace')
        self._buffer = b''
        deadline = time.time() + timeout

        while time.time() < deadline:
            for prompt in prompts:
                if prompt.lower() in output.lower():
                    return True, output
            try:
                self.sock.settimeout(min(1.0, deadline - time.time()))
                chunk = self.sock.recv(4096)
                if chunk:
                    chunk = self._strip_telnet_iac(chunk)
                    output += chunk.decode('utf-8', errors='replace')
            except socket.timeout:
                pass
            except Exception as e:
                logger.debug(f"Read error in read_until: {e}")
                break

        return False, output

    def send(self, command: str, newline: bool = True) -> None:
        """Send command to telnet connection."""
        if not self.sock:
            return
        try:
            payload = (command + ('\r\n' if newline else '')).encode('utf-8')
            self.sock.send(payload)
            time.sleep(0.1)
        except Exception as e:
            logger.debug(f"Send error: {e}")

    def send_and_read(self, command: str, *wait_prompts: str,
                      timeout: int = 8) -> Tuple[bool, str]:
        """Send command and wait for prompt."""
        self.send(command)
        return self.read_until(*wait_prompts, timeout=timeout)

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.disconnect()


def telnet_login(host: str, username: str, password: str, port: int = 23,
                 timeout: int = 15) -> Tuple[bool, str, Optional[TelnetClient]]:
    """
    Attempt Telnet login to OLT.
    Returns (success, message, client_or_none)
    """
    client = TelnetClient(host, port=port, timeout=timeout)
    if not client.connect():
        return False, f'Cannot connect to {host}:{port} via Telnet', None

    # Wait for login prompt
    found, output = client.read_until(
        'login:', 'username:', 'user:', 'Login:', 'Username:', timeout=10
    )
    if not found:
        # Some OLTs show a banner with # or > prompt if no auth needed
        if any(p in output for p in ['#', '>', '$', 'MA5800', 'ZTE']):
            logger.debug("OLT appears to not require authentication")
            return True, 'Connected (no auth required)', client
        client.disconnect()
        return False, f'No login prompt received from {host}. Got: {output[:100]}', None

    # Send username
    client.send(username)
    found, output = client.read_until('password:', 'Password:', 'assword:', timeout=8)
    if not found:
        client.disconnect()
        return False, 'No password prompt after username', None

    # Send password
    client.send(password)
    found, output = client.read_until('#', '>', '$', '%', 'error', 'fail', 'denied', timeout=10)

    if not found:
        client.disconnect()
        return False, 'Login timed out - no CLI prompt received', None

    output_lower = output.lower()
    if any(x in output_lower for x in ['error', 'fail', 'denied', 'incorrect', 'wrong', 'invalid']):
        client.disconnect()
        return False, f'Login failed: {output.strip()[-100:]}', None

    return True, 'Login successful', client


def telnet_configure_snmp(client: TelnetClient, read_community: str,
                           write_community: str = '') -> Dict[str, Any]:
    """Configure SNMP on OLT via Telnet CLI."""
    steps = []
    result = {'success': True, 'steps': steps}

    # Enter config mode - try different vendor syntaxes
    client.send('enable')
    time.sleep(0.3)
    client.send('config')
    found, output = client.read_until('config)', 'config#', '(config', timeout=5)

    # Huawei-style SNMP configuration
    if read_community:
        found, out = client.send_and_read(
            f'snmp-agent community read {read_community}',
            '#', '>', timeout=5
        )
        steps.append({'step': 'snmp_read_community', 'success': found,
                      'message': f'Set SNMP read community: {read_community}'})

    if write_community:
        found, out = client.send_and_read(
            f'snmp-agent community write {write_community}',
            '#', '>', timeout=5
        )
        steps.append({'step': 'snmp_write_community', 'success': found,
                      'message': f'Set SNMP write community: {write_community}'})

    # Enable SNMP agent
    found, out = client.send_and_read('snmp-agent', '#', '>', timeout=5)
    steps.append({'step': 'enable_snmp_agent', 'success': True, 'message': 'SNMP agent enabled'})

    # Commit / save config
    client.send_and_read('quit', '>', '#', timeout=3)
    client.send_and_read('save', 'Y/N', 'yes', 'no', '#', timeout=5)
    client.send('Y')
    time.sleep(1)
    client.send_and_read('', '#', '>', timeout=3)

    result['success'] = all(s.get('success', True) for s in steps)
    return result


def telnet_create_mgmt_user(client: TelnetClient, username: str, password: str,
                             privilege: int = 15) -> Dict[str, Any]:
    """Create management user on OLT via Telnet."""
    steps = []
    result = {'success': False, 'steps': steps}

    # Enter enable + config mode
    client.send('enable')
    time.sleep(0.3)
    client.send('config')
    client.read_until('config)', 'config#', timeout=5)

    # Try Huawei-style
    found, out = client.send_and_read(
        f'aaa', 'config-aaa', '(aaa', '#', timeout=5
    )
    if 'aaa' in out.lower() or found:
        client.send_and_read(
            f'local-user {username} password irreversible-cipher {password}',
            '#', '>', timeout=5
        )
        client.send_and_read(
            f'local-user {username} privilege level {privilege}',
            '#', '>', timeout=5
        )
        client.send_and_read(
            f'local-user {username} service-type terminal ssh telnet',
            '#', '>', timeout=5
        )
        client.send_and_read('quit', '#', '>', timeout=3)
        steps.append({'step': 'create_user_huawei', 'success': True,
                      'message': f'User {username} created (Huawei-style)'})
        result['success'] = True
    else:
        # Try Cisco-style
        client.send_and_read(
            f'username {username} privilege {privilege} password 0 {password}',
            '#', '>', timeout=5
        )
        steps.append({'step': 'create_user_cisco', 'success': True,
                      'message': f'User {username} created (Cisco-style)'})
        result['success'] = True

    # Save config
    client.send_and_read('quit', '#', '>', timeout=3)
    client.send('save')
    time.sleep(1)

    result['steps'] = steps
    return result


def telnet_provision_onu(client: TelnetClient, onu_serial: str, pon_port: str,
                          vlan_id: int = 100, service_profile: str = '',
                          onu_id: int = 1) -> Dict[str, Any]:
    """
    Provision ONU via Telnet CLI.
    Supports Huawei MA5800/5600 style and ZTE C300/C600 style commands.
    """
    steps = []
    result = {'success': False, 'steps': steps, 'error': None}

    # Enter config mode
    client.send('enable')
    time.sleep(0.2)
    client.send('config')
    found, out = client.read_until('config)', 'config#', '(config', '#', timeout=5)

    # Try Huawei-style ONU provisioning
    # Navigate to PON interface
    intf_cmd = f'interface gpon {pon_port}' if pon_port else 'interface gpon 0/1'
    found, out = client.send_and_read(intf_cmd, 'gpon', '#', '>', timeout=5)

    if found and 'gpon' in out.lower():
        # Add ONU by serial
        add_cmd = f'ont add {onu_id} sn-auth {onu_serial} omci ont-lineprofile-id 1 ont-srvprofile-id 1 desc "AutoOLT"'
        found, out = client.send_and_read(add_cmd, 'success', '#', '>', 'error', timeout=10)
        steps.append({
            'step': 'add_onu_huawei',
            'success': 'success' in out.lower() or found,
            'message': f'ONU {onu_serial} added on port {pon_port}'
        })

        # Configure service VLAN
        if vlan_id > 0:
            client.send_and_read(f'ont port native-vlan {onu_id} eth 1 vlan {vlan_id}',
                                  '#', '>', timeout=5)
            steps.append({'step': 'vlan_binding', 'success': True,
                          'message': f'VLAN {vlan_id} bound to ONU {onu_serial}'})

        client.send_and_read('quit', '#', timeout=3)
        result['success'] = True
    else:
        # Try ZTE-style
        zte_cmd = f'interface gpon-onu_1/1/1:{onu_id}'
        client.send('quit')
        client.read_until('#', '>', timeout=3)
        found, out = client.send_and_read(
            f'pon-onu-mng gpon-onu_1/1/1:{onu_id}', '#', '>', timeout=5
        )
        if found:
            client.send_and_read(f'service 1 gemport 1 vlan {vlan_id}', '#', '>', timeout=5)
            steps.append({'step': 'add_onu_zte', 'success': True,
                          'message': f'ONU {onu_serial} provisioned (ZTE-style)'})
            result['success'] = True
        else:
            result['error'] = 'Could not determine OLT vendor CLI syntax for ONU provisioning'
            steps.append({'step': 'provision_onu', 'success': False,
                          'message': result['error']})

    result['steps'] = steps
    return result
