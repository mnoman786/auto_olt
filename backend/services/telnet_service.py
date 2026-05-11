"""
Telnet Service for OLT CLI management.
Handles automated CLI interactions via Telnet for OLT provisioning.
"""
import socket
import time
import logging
from typing import Optional, List, Tuple, Dict, Any

logger = logging.getLogger(__name__)

# Prompts that mean the OLT is asking for credentials mid-session.
# Tuples of (prompt_substring, credential_key).
_CREDENTIAL_PROMPTS: List[Tuple[str, str]] = [
    ('password:',           'password'),
    ('password: ',          'password'),
    ('enter password:',     'password'),
    ('re-enter password:',  'password'),
    ('confirm password:',   'password'),
    ('old password:',       'password'),
    ('new password:',       'password'),
    ('enable password:',    'enable_password'),
    ('enable secret:',      'enable_password'),
    ('login:',              'username'),
    ('username:',           'username'),
    ('user:',               'username'),
]


class TelnetClient:
    """Simple Telnet client for OLT CLI interaction."""

    def __init__(self, host: str, port: int = 23, timeout: int = 15,
                 on_io=None, credentials: Optional[Dict[str, str]] = None):
        self.host = host
        self.port = port
        self.timeout = timeout
        self.sock: Optional[socket.socket] = None
        self._buffer = b''
        self._on_io = on_io          # callback(direction: 'send'|'recv', text: str)
        self._credentials = credentials or {}   # {'username': ..., 'password': ..., 'enable_password': ...}
        self._last_auto_respond = ''  # debounce: avoid re-responding to same prompt twice

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

    def _auto_respond(self, tail: str) -> bool:
        """
        Check the last part of received output for credential prompts.
        If found and we have a matching credential, send it automatically.
        Returns True if a credential was sent.
        """
        if not self._credentials or not self.sock:
            return False

        tail_lower = tail.lower()
        for prompt_str, cred_key in _CREDENTIAL_PROMPTS:
            if prompt_str in tail_lower:
                # Debounce: don't respond to the same prompt twice in a row
                if self._last_auto_respond == prompt_str:
                    continue
                value = self._credentials.get(cred_key, '')
                if not value:
                    continue
                self._last_auto_respond = prompt_str
                try:
                    self.sock.send((value + '\r\n').encode('utf-8'))
                    time.sleep(0.2)
                    # Log it — mask the actual value for security
                    display = '********' if 'password' in cred_key else value
                    if self._on_io:
                        self._on_io('auto', f'[auto] {prompt_str.strip()} → {display}')
                    logger.debug(f"[TelnetClient] Auto-responded to '{prompt_str}' prompt with {cred_key}")
                except Exception as e:
                    logger.debug(f"Auto-respond send error: {e}")
                return True
        self._last_auto_respond = ''
        return False

    def read_until(self, *prompts: str, timeout: int = 10) -> Tuple[bool, str]:
        """
        Read from connection until one of the prompts is found.
        Automatically responds to credential prompts mid-session.
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
                    if self._on_io and output.strip():
                        self._on_io('recv', output.strip())
                    return True, output
            try:
                self.sock.settimeout(min(1.0, deadline - time.time()))
                chunk = self.sock.recv(4096)
                if chunk:
                    chunk = self._strip_telnet_iac(chunk)
                    new_text = chunk.decode('utf-8', errors='replace')
                    output += new_text
                    # Check last 300 chars for credential prompts and auto-respond
                    self._auto_respond(output[-300:])
            except socket.timeout:
                pass
            except Exception as e:
                logger.debug(f"Read error in read_until: {e}")
                break

        if self._on_io and output.strip():
            self._on_io('recv', output.strip())
        return False, output

    def send(self, command: str, newline: bool = True) -> None:
        """Send command to telnet connection."""
        if not self.sock:
            return
        try:
            payload = (command + ('\r\n' if newline else '')).encode('utf-8')
            self.sock.send(payload)
            time.sleep(0.1)
            if self._on_io and command.strip():
                self._on_io('send', command.strip())
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
                 timeout: int = 15, on_io=None,
                 enable_password: str = '') -> Tuple[bool, str, Optional[TelnetClient]]:
    """
    Attempt Telnet login to OLT.
    Credentials are stored on the client so it can auto-respond to any
    mid-session credential prompt (enable mode, re-auth, etc).
    Returns (success, message, client_or_none)
    """
    credentials = {
        'username': username,
        'password': password,
        'enable_password': enable_password or password,  # fall back to login password
    }
    client = TelnetClient(host, port=port, timeout=timeout, on_io=on_io,
                          credentials=credentials)
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


def _detect_vendor(client: TelnetClient) -> str:
    """Detect OLT vendor from CLI banner/prompt already buffered in the client."""
    banner = client._buffer.decode('utf-8', errors='replace').lower()
    if 'huawei' in banner or 'vrp' in banner or 'ma5' in banner:
        return 'huawei'
    if 'zte' in banner or 'zxan' in banner or 'c300' in banner or 'c600' in banner:
        return 'zte'
    # Probe: send a Huawei-only command and check the response
    client.send('display version')
    time.sleep(0.5)
    _, probe = client.read_until('#', '>', timeout=4)
    probe_lower = probe.lower()
    if 'huawei' in probe_lower or 'vrp' in probe_lower or 'ma5' in probe_lower:
        return 'huawei'
    if 'zte' in probe_lower or 'zxan' in probe_lower:
        return 'zte'
    return 'huawei'  # safe default for Pakistan market


def telnet_configure_snmp(client: TelnetClient, read_community: str,
                           write_community: str = '', vendor: str = 'auto') -> Dict[str, Any]:
    """Configure SNMP on OLT via Telnet CLI. Supports Huawei and ZTE vendors."""
    steps = []
    result = {'success': True, 'steps': steps}

    if vendor == 'auto':
        vendor = _detect_vendor(client)

    # Enter enable + config mode
    client.send('enable')
    time.sleep(0.3)
    client.send('config')
    client.read_until('config)', 'config#', '(config', '#', timeout=5)

    if vendor == 'zte':
        # ZTE C300/C600 SNMP configuration
        if read_community:
            found, out = client.send_and_read(
                f'snmp-server community {read_community} ro',
                '#', '>', timeout=5
            )
            steps.append({'step': 'snmp_read_community', 'success': found,
                          'message': f'Set SNMP read community: {read_community}'})

        if write_community:
            found, out = client.send_and_read(
                f'snmp-server community {write_community} rw',
                '#', '>', timeout=5
            )
            steps.append({'step': 'snmp_write_community', 'success': found,
                          'message': f'Set SNMP write community: {write_community}'})

        found, out = client.send_and_read('snmp-server enable traps', '#', '>', timeout=5)
        steps.append({'step': 'enable_snmp_agent', 'success': found, 'message': 'SNMP traps enabled (ZTE)'})

        # Save ZTE config
        client.send_and_read('exit', '#', '>', timeout=3)
        client.send_and_read('write', '#', timeout=5)
    else:
        # Huawei MA5600/MA5800 SNMP configuration
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

        found, out = client.send_and_read('snmp-agent', '#', '>', timeout=5)
        steps.append({'step': 'enable_snmp_agent', 'success': True, 'message': 'SNMP agent enabled (Huawei)'})

        # Save Huawei config
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
    client.read_until('config)', 'config#', '(config', '#', timeout=5)

    # Try Huawei-style AAA: confirm we entered the aaa sub-view by checking for its prompt
    found, out = client.send_and_read(
        'aaa', 'config-aaa', '-aaa]', '(aaa', timeout=5
    )
    if found and any(p in out.lower() for p in ['config-aaa', '-aaa]', '(aaa']):
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
                          onu_id: int = 1, line_profile_id: int = 1,
                          srv_profile_id: int = 1) -> Dict[str, Any]:
    """
    Provision ONU via Telnet CLI.
    Supports Huawei MA5800/5600 and ZTE C300/C600.

    line_profile_id / srv_profile_id: must match profiles already configured on the OLT.
    Default is 1 — verify with 'display ont-lineprofile all' on the OLT.
    """
    steps = []
    result = {'success': False, 'steps': steps, 'error': None}

    # Enter config mode
    client.send('enable')
    time.sleep(0.2)
    client.send('config')
    client.read_until('config)', 'config#', '(config', '#', timeout=5)

    # Try Huawei-style ONU provisioning
    intf_cmd = f'interface gpon {pon_port}' if pon_port else 'interface gpon 0/1'
    found, out = client.send_and_read(intf_cmd, 'gpon', '#', '>', timeout=5)

    if found and 'gpon' in out.lower():
        # Add ONU by serial number with configured line/service profiles
        add_cmd = (
            f'ont add {onu_id} sn-auth {onu_serial} omci '
            f'ont-lineprofile-id {line_profile_id} '
            f'ont-srvprofile-id {srv_profile_id} desc "AutoOLT"'
        )
        found, out = client.send_and_read(add_cmd, 'success', '#', '>', 'error', timeout=10)
        onu_added = 'success' in out.lower() or (found and 'error' not in out.lower())
        steps.append({
            'step': 'add_onu_huawei',
            'success': onu_added,
            'message': f'ONU {onu_serial} added on port {pon_port}' if onu_added
                       else f'Failed to add ONU — verify line-profile-id {line_profile_id} and srv-profile-id {srv_profile_id} exist on OLT'
        })

        # Configure service VLAN
        if vlan_id > 0:
            found_vlan, _ = client.send_and_read(
                f'ont port native-vlan {onu_id} eth 1 vlan {vlan_id}',
                '#', '>', timeout=5
            )
            steps.append({'step': 'vlan_binding', 'success': True,
                          'message': f'VLAN {vlan_id} bound to ONU {onu_serial}'})

        client.send_and_read('quit', '#', timeout=3)
        result['success'] = onu_added
        if not onu_added:
            result['error'] = f'Huawei ont add failed — check profile IDs (line:{line_profile_id} srv:{srv_profile_id})'
    else:
        # Try ZTE-style — use actual pon_port, not hardcoded 1/1/1
        zte_port = pon_port if pon_port else '1/1/1'
        client.send('quit')
        client.read_until('#', '>', timeout=3)
        found, out = client.send_and_read(
            f'pon-onu-mng gpon-onu_{zte_port}:{onu_id}', '#', '>', timeout=5
        )
        if found:
            client.send_and_read(f'service 1 gemport 1 vlan {vlan_id}', '#', '>', timeout=5)
            steps.append({'step': 'add_onu_zte', 'success': True,
                          'message': f'ONU {onu_serial} provisioned on port {zte_port} (ZTE-style)'})
            result['success'] = True
        else:
            result['error'] = f'Could not provision ONU — tried Huawei (port {pon_port}) and ZTE (port {zte_port}) CLI syntax'
            steps.append({'step': 'provision_onu', 'success': False,
                          'message': result['error']})

    result['steps'] = steps
    return result
