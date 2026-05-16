"""
Telnet Service for OLT CLI management.
Handles automated CLI interactions via Telnet for OLT provisioning.
"""
import re
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

    def _handle_pager(self, tail: str) -> bool:
        """If output ends in a --More-- pager, send space to advance. Returns True if handled."""
        tail_lower = tail.lower()
        pager_markers = ['---- more ----', '--more--', ' --more-- ', '<--more-->', 'press any key']
        if any(m in tail_lower for m in pager_markers):
            try:
                self.sock.send(b' ')
                time.sleep(0.1)
                return True
            except Exception:
                pass
        return False

    def read_until(self, *prompts: str, timeout: int = 10) -> Tuple[bool, str]:
        """
        Read from connection until one of the prompts is found.
        Automatically responds to credential prompts and --More-- pagers mid-session.
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
                    # Auto-advance --More-- pagers (Huawei VRP, ZTE)
                    self._handle_pager(output[-200:])
                    # Auto-respond to credential prompts
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
        ok = found and not any(e in out.lower() for e in ['error', 'invalid', 'unknown', '% '])
        steps.append({'step': 'enable_snmp_agent', 'success': ok,
                      'message': 'SNMP traps enabled (ZTE)' if ok else 'snmp-server command rejected by OLT'})

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
        ok = found and not any(e in out.lower() for e in ['error', 'invalid', 'unknown', '% '])
        steps.append({'step': 'enable_snmp_agent', 'success': ok,
                      'message': 'SNMP agent enabled (Huawei)' if ok else 'snmp-agent command rejected by OLT'})

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
        # Try Cisco-style — verify command was accepted
        found_c, out_c = client.send_and_read(
            f'username {username} privilege {privilege} password 0 {password}',
            '#', '>', timeout=5
        )
        created = found_c and not any(
            err in out_c.lower() for err in ['error', 'invalid', 'unknown', '% ', 'incomplete']
        )
        steps.append({'step': 'create_user_cisco', 'success': created,
                      'message': f'User {username} created (Cisco-style)' if created
                                 else f'Failed to create user {username} — OLT rejected command'})
        result['success'] = created

    # Save config
    client.send_and_read('quit', '#', '>', timeout=3)
    client.send('save')
    time.sleep(1)

    result['steps'] = steps
    return result


# Vendor error patterns indicating the VLAN already exists on the OLT.
# Matched case-insensitively against command output.
_VLAN_EXISTS_PATTERNS = (
    'already exist',          # Huawei: "VLAN xxx already exists"
    'already configured',     # Huawei variant
    'vlan exists',            # ZTE variant
    'duplicate',              # generic
)

# Strings that signal a genuine CLI failure (not a duplicate).
_VLAN_ERROR_PATTERNS = (
    'failure:',
    'error:',
    '% invalid',
    '% incomplete',
    '% permission',
    'unrecognized',
    'not allowed',
)


def _output_indicates_exists(output: str) -> bool:
    low = output.lower()
    return any(p in low for p in _VLAN_EXISTS_PATTERNS)


def _output_indicates_error(output: str) -> bool:
    low = output.lower()
    return any(p in low for p in _VLAN_ERROR_PATTERNS)


def telnet_push_vlan(client: TelnetClient, vlan_id: int, vendor: str = 'auto') -> Dict[str, Any]:
    """
    Push a VLAN to the OLT via Telnet CLI. Supports Huawei and ZTE.

    Pre-checks existence; if the VLAN is already on the OLT, returns success
    with already_existed=True (no create attempted). Otherwise creates and
    parses the OLT response to distinguish duplicate (treat as success) from
    real CLI errors.
    """
    steps = []
    result: Dict[str, Any] = {'success': False, 'steps': steps, 'already_existed': False}

    if vendor == 'auto':
        vendor = _detect_vendor(client)

    try:
        # Enter privileged/config-adjacent context for the existence check.
        client.send_and_read('enable', '#', '>', timeout=5)

        # --- Pre-check: does the VLAN already exist? ---
        if vendor == 'zte':
            _, check_out = client.send_and_read(f'show vlan {vlan_id}', '#', timeout=5)
        else:
            _, check_out = client.send_and_read(f'display vlan {vlan_id}', '#', timeout=5)

        check_low = check_out.lower()
        # A "does not exist" / "invalid" response means we need to create it.
        not_found = (
            'does not exist' in check_low
            or 'not exist' in check_low
            or 'no such' in check_low
            or '% invalid' in check_low
            or 'unrecognized' in check_low
        )
        # A successful display showing the vlan id is treated as "exists".
        # Heuristic: the output contains the vlan id and no not-found marker.
        vlan_found = (not not_found) and (str(vlan_id) in check_out) and ('vlan' in check_low)

        if vlan_found:
            result['success'] = True
            result['already_existed'] = True
            steps.append({
                'step': 'push_vlan',
                'success': True,
                'message': f'VLAN {vlan_id} already exists on OLT ({vendor}); skipped create',
            })
            return result

        # --- Create the VLAN ---
        if vendor == 'zte':
            client.send_and_read('configure terminal', '#', timeout=5)
            _, create_out = client.send_and_read(f'vlan {vlan_id}', '#', timeout=5)
            client.send_and_read('exit', '#', timeout=5)
            client.send_and_read('write', '#', timeout=10)
        else:
            # Huawei MA5600/MA5800
            client.send_and_read('config', '#', timeout=5)
            _, create_out = client.send_and_read(f'vlan {vlan_id} smart', '#', timeout=5)
            client.send_and_read('quit', '#', timeout=5)
            client.send_and_read('save', '#', 'Y/N', timeout=5)
            client.send_and_read('Y', '#', timeout=10)

        if _output_indicates_exists(create_out):
            # Race / pre-check missed it — still the desired end state.
            result['success'] = True
            result['already_existed'] = True
            steps.append({
                'step': 'push_vlan',
                'success': True,
                'message': f'VLAN {vlan_id} already existed on OLT ({vendor}); no change',
            })
        elif _output_indicates_error(create_out):
            err = create_out.strip().splitlines()[-1] if create_out.strip() else 'CLI error'
            steps.append({'step': 'push_vlan', 'success': False, 'message': err})
            result['error'] = err
        else:
            result['success'] = True
            steps.append({
                'step': 'push_vlan',
                'success': True,
                'message': f'VLAN {vlan_id} created on OLT ({vendor})',
            })
    except Exception as e:
        steps.append({'step': 'push_vlan', 'success': False, 'message': str(e)})
        result['error'] = str(e)

    return result


def telnet_discover_vlans(client: TelnetClient, vendor: str = 'auto') -> Dict[str, Any]:
    """
    List all VLANs configured on the OLT via Telnet CLI.

    Returns {'success': bool, 'vlans': [{vlan_id, name, description}], 'error': str|None}.

    Huawei MA5600/MA5800: `display vlan all`
    ZTE   C300/C600    : `show vlan`
    """
    result: Dict[str, Any] = {'success': False, 'vlans': [], 'error': None}

    if vendor == 'auto':
        vendor = _detect_vendor(client)

    try:
        client.send_and_read('enable', '#', '>', timeout=5)

        if vendor == 'zte':
            _, output = client.send_and_read('show vlan', '#', timeout=10)
        else:
            # Huawei prints `display vlan all` in pages; pager is auto-advanced.
            _, output = client.send_and_read('display vlan all', '#', timeout=15)

        # Parse: each line of interest starts with a digit (vlan id).
        # Huawei format example:
        #   VLAN ID  Type        Attribute   Description
        #   -------  ---------  ---------- ------------------
        #     1      smart       common     VLAN 0001
        #   100      smart       common     Customer-Internet
        #
        # ZTE format example:
        #   VLAN ID  Name             Type    Status
        #     1      default          static  active
        #   100      Mgmt             static  active
        seen: Dict[int, Dict[str, Any]] = {}
        for raw_line in output.splitlines():
            line = raw_line.strip()
            if not line or line.startswith('-') or line.startswith('='):
                continue
            # Skip header rows
            low = line.lower()
            if low.startswith('vlan id') or 'type' in low and 'attribute' in low:
                continue
            parts = line.split()
            if not parts or not parts[0].isdigit():
                continue
            try:
                vid = int(parts[0])
            except ValueError:
                continue
            if not (1 <= vid <= 4094):
                continue
            # Best-effort: tail of the line is description; the second token
            # is usually a vendor type field, so take everything after it.
            description = ' '.join(parts[3:]) if len(parts) > 3 else ''
            name = parts[1] if len(parts) > 1 else f'VLAN{vid}'
            # On Huawei the "name" column is actually the type ("smart"/"common");
            # fall back to a synthetic name in that case.
            if vendor != 'zte' and name.lower() in ('smart', 'common', 'mux'):
                name = description.split()[0] if description else f'VLAN{vid}'
            seen[vid] = {'vlan_id': vid, 'name': name[:100], 'description': description[:300]}

        result['success'] = True
        result['vlans'] = sorted(seen.values(), key=lambda v: v['vlan_id'])
    except Exception as e:
        result['error'] = str(e)

    return result


def _parse_huawei_profiles(output: str) -> List[Dict[str, Any]]:
    """
    Parse Huawei `display ont-lineprofile gpon all` / `display ont-srvprofile gpon all` output.

    Handles two firmware layouts:
      (a) Tabular:
          Profile-ID  Profile-Name
          ----------  -----------
              1       default
             10       hsi-1000m
      (b) Vertical:
          Profile-ID : 1
          Profile-name: default
          ...
          Profile-ID : 10
          Profile-name: hsi-1000m
    """
    profiles: Dict[int, Dict[str, Any]] = {}

    # Vertical format first — "Profile-ID : N" possibly followed by Profile-Name on next non-blank line.
    vertical_id_re = re.compile(r'profile[-\s]*id\s*[:=]?\s*(\d+)', re.IGNORECASE)
    vertical_name_re = re.compile(r'profile[-\s]*name\s*[:=]?\s*(\S.*)', re.IGNORECASE)

    pending_id: Optional[int] = None
    for raw in output.splitlines():
        line = raw.strip()
        if not line:
            continue
        m_id = vertical_id_re.search(line)
        if m_id and 'profile-id' in line.lower():
            try:
                pid = int(m_id.group(1))
            except ValueError:
                pending_id = None
                continue
            pending_id = pid
            profiles.setdefault(pid, {'id': pid, 'name': f'profile-{pid}'})
            continue
        if pending_id is not None:
            m_name = vertical_name_re.search(line)
            if m_name:
                profiles[pending_id]['name'] = m_name.group(1).strip()[:100]
                pending_id = None
                continue

    # Tabular format: lines that start with a digit, second token is the name.
    if not profiles:
        for raw in output.splitlines():
            line = raw.strip()
            if not line or line.startswith('-') or line.startswith('='):
                continue
            low = line.lower()
            if 'profile-id' in low or 'profile id' in low:
                continue
            parts = line.split()
            if not parts or not parts[0].isdigit():
                continue
            try:
                pid = int(parts[0])
            except ValueError:
                continue
            if not (1 <= pid <= 65535):
                continue
            name = parts[1][:100] if len(parts) > 1 else f'profile-{pid}'
            profiles[pid] = {'id': pid, 'name': name}

    return sorted(profiles.values(), key=lambda p: p['id'])


def telnet_discover_profiles(client: TelnetClient, vendor: str = 'auto') -> Dict[str, Any]:
    """
    Discover ONU line profiles and service profiles configured on the OLT.

    Returns:
        {
          'success': bool,
          'line_profiles': [{'id': int, 'name': str}, ...],
          'srv_profiles':  [{'id': int, 'name': str}, ...],
          'error': str|None,
        }

    Only Huawei MA5600/MA5800 is supported for now — ZTE uses a different
    profile model (`gpon profile <name>`) and is not parsed here.
    """
    result: Dict[str, Any] = {
        'success': False,
        'line_profiles': [],
        'srv_profiles': [],
        'error': None,
    }

    if vendor == 'auto':
        vendor = _detect_vendor(client)

    if vendor != 'huawei':
        result['error'] = f'Profile auto-discovery is only implemented for Huawei (detected: {vendor})'
        return result

    try:
        client.send_and_read('enable', '#', '>', timeout=5)
        client.send_and_read('config', '#', timeout=5)

        # Line profiles
        _, line_out = client.send_and_read('display ont-lineprofile gpon all', '#', timeout=20)
        result['line_profiles'] = _parse_huawei_profiles(line_out)

        # Service profiles
        _, srv_out = client.send_and_read('display ont-srvprofile gpon all', '#', timeout=20)
        result['srv_profiles'] = _parse_huawei_profiles(srv_out)

        # Return to top
        client.send_and_read('quit', '#', '>', timeout=5)

        result['success'] = bool(result['line_profiles'] or result['srv_profiles'])
        if not result['success']:
            result['error'] = 'No ONU profiles found on the OLT — they may need to be created first'
    except Exception as e:
        result['error'] = str(e)

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

    # Parse pon_port "frame/slot/port" (e.g. "0/1/0") into its components.
    # Huawei CLI: "interface gpon frame/slot" then "ont add port_id onu_id sn-auth ..."
    port_parts = pon_port.split('/') if pon_port else []
    if len(port_parts) >= 3:
        huawei_intf = f'{port_parts[0]}/{port_parts[1]}'   # e.g. "0/1"
        huawei_port_id = int(port_parts[2])                # e.g. 0
    else:
        huawei_intf = pon_port or '0/1'
        huawei_port_id = 0

    found, out = client.send_and_read(
        f'interface gpon {huawei_intf}', 'gpon', '#', '>', timeout=5
    )

    if found and 'gpon' in out.lower():
        # Huawei: ont add <port_id> <ont_id> sn-auth <serial> ...
        add_cmd = (
            f'ont add {huawei_port_id} {onu_id} sn-auth {onu_serial} omci '
            f'ont-lineprofile-id {line_profile_id} '
            f'ont-srvprofile-id {srv_profile_id} desc "AutoOLT"'
        )
        found, out = client.send_and_read(add_cmd, 'success', '#', '>', 'error', timeout=10)
        onu_added = 'success' in out.lower() or (found and 'error' not in out.lower())
        steps.append({
            'step': 'add_onu_huawei',
            'success': onu_added,
            'message': f'ONU {onu_serial} added on {huawei_intf} port {huawei_port_id}' if onu_added
                       else f'Failed to add ONU — verify line-profile-id {line_profile_id} and srv-profile-id {srv_profile_id} exist on OLT'
        })

        # Configure service VLAN: ont port native-vlan <port_id> <ont_id> eth 1 vlan <vlan>
        if vlan_id > 0:
            client.send_and_read(
                f'ont port native-vlan {huawei_port_id} {onu_id} eth 1 vlan {vlan_id}',
                '#', '>', timeout=5
            )
            steps.append({'step': 'vlan_binding', 'success': True,
                          'message': f'VLAN {vlan_id} bound to ONU {onu_serial}'})

        client.send_and_read('quit', '#', timeout=3)
        result['success'] = onu_added
        if not onu_added:
            result['error'] = f'Huawei ont add failed — check profile IDs (line:{line_profile_id} srv:{srv_profile_id})'
    else:
        # Try ZTE-style — use actual pon_port
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
            result['error'] = f'Could not provision ONU — tried Huawei ({huawei_intf} port {huawei_port_id}) and ZTE ({zte_port}) CLI syntax'
            steps.append({'step': 'provision_onu', 'success': False,
                          'message': result['error']})

    result['steps'] = steps
    return result
