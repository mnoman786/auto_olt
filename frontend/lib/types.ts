// Type definitions for the Auto OLT system

export interface User {
  id: number;
  username: string;
  email: string;
  is_staff: boolean;
  is_superuser: boolean;
  created_at: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface AuthResponse {
  user: User;
}

export type OLTStatus = 'pending' | 'configuring' | 'active' | 'error' | 'offline';
export type SNMPVersion = 'v1' | 'v2c' | 'v3';
export type ConnectionType = 'direct' | 'vpn';

export interface OLT {
  id: number;
  username: string;
  name: string;
  ip_address: string;
  connection_type: ConnectionType;
  vpn_virtual_ip: string | null;
  wg_client_public_key: string;
  wg_client_subnet: string;
  snmp_version: SNMPVersion;
  has_snmp_read_community: boolean;
  has_snmp_write_community: boolean;
  telnet_enabled: boolean;
  telnet_port: number;
  olt_admin_username: string;
  has_admin_password: boolean;
  status: OLTStatus;
  system_name: string;
  system_description: string;
  system_uptime: string;
  last_polled: string | null;
  created_at: string;
  updated_at: string;
  onu_count: number;
  registered_onu_count: number;
  vlan_count?: number;
  discovered_vlan_count?: number;
  line_profiles?: { id: number; name: string }[];
  srv_profiles?: { id: number; name: string }[];
  profiles_last_synced?: string | null;
}

export interface WireGuardInfo {
  server_public_key: string;
  server_endpoint: string;
  virtual_ip: string | null;
  client_public_key: string;
  client_subnet: string;
  peer_configured: boolean;
  peer_connected: boolean;
  last_handshake: number;
}

export interface OLTCreatePayload {
  name: string;
  ip_address: string;
  connection_type: ConnectionType;
  wg_client_public_key?: string;
  wg_client_subnet?: string;
  snmp_version: SNMPVersion;
  snmp_read_community: string;
  snmp_write_community?: string;
  telnet_enabled: boolean;
  telnet_port?: number;
  olt_admin_username?: string;
  olt_admin_password?: string;
}

export type PortType = 'pon' | 'uplink' | 'lag' | 'other';
export type PortStatus = 'up' | 'down' | 'unknown';

export interface OLTPort {
  id: number;
  if_index: number;
  name: string;
  description: string;
  port_type: PortType;
  status: PortStatus;
  speed_mbps: number;
  onu_count: number;
  max_capacity: number;
  utilization_pct: number | null;
  updated_at: string;
}

export interface OLTPortsResponse {
  count: number;
  ports: OLTPort[];
}

export type ONUStatus = 'unregistered' | 'registered' | 'active' | 'offline' | 'provisioning';

export interface ONU {
  id: number;
  serial_number: string;
  mac_address: string;
  pon_port: string;
  onu_index: number;
  onu_id: number;
  status: ONUStatus;
  signal_strength: number | null;
  service_profile: string;
  description: string;
  vlan: number | null;
  vlan_name: string | null;
  vlan_id_num: number | null;
  last_seen: string | null;
  registered_at: string | null;
  created_at: string;
  updated_at: string;
}

export type VLANSource = 'managed' | 'discovered';

export interface VLAN {
  id: number;
  vlan_id: number;
  name: string;
  description: string;
  onu_count: number;
  source: VLANSource;
  last_seen_on_olt: string | null;
  pushed_to_olt: boolean;
  push_error: string;
  created_at: string;
  updated_at: string;
}

export type LogLevel = 'info' | 'success' | 'warning' | 'error';

export interface SetupLog {
  id: number;
  step: string;
  message: string;
  level: LogLevel;
  created_at: string;
}

export interface SetupLogsResponse {
  olt_id: number;
  status: OLTStatus;
  logs: SetupLog[];
}

export interface ProvisioningLog {
  id: number;
  step: string;
  message: string;
  level: LogLevel;
  created_at: string;
}

export interface OLTStats {
  olt_id: number;
  status: OLTStatus;
  total_onus: number;
  active_onus: number;
  offline_onus: number;
  unregistered_onus: number;
  registered_onus: number;
  last_polled: string | null;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// Admin types
export interface AdminUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  olt_count: number;
  date_joined: string;
}

export interface AdminUserDetail extends Omit<AdminUser, 'olt_count'> {
  olts: OLT[];
}

export type TicketStatus = 'open' | 'answered' | 'closed';

export interface TicketReply {
  id: number;
  author_username: string;
  is_staff: boolean;
  message: string;
  created_at: string;
}

export interface Ticket {
  id: number;
  username: string;
  olt: number | null;
  olt_name: string | null;
  subject: string;
  message: string;
  status: TicketStatus;
  reply_count: number;
  replies: TicketReply[];
  created_at: string;
  updated_at: string;
}

export interface TicketListItem {
  id: number;
  username: string;
  olt: number | null;
  olt_name: string | null;
  subject: string;
  status: TicketStatus;
  reply_count: number;
  created_at: string;
  updated_at: string;
}

export interface AutoProvisionConfig {
  enabled: boolean;
  default_vlan: number | null;
  default_vlan_id: number | null;
  default_vlan_name: string | null;
  default_vlan_vid: number | null;
  line_profile_id: number;
  srv_profile_id: number;
  updated_at: string;
}

// ── Alerts ────────────────────────────────────────────────────────────────────
export type AlertType = 'olt_offline' | 'olt_error' | 'onu_drop' | 'signal_weak';

export interface AlertRule {
  id: number;
  olt: number | null;
  olt_name: string | null;
  alert_type: AlertType;
  channel: 'email';
  enabled: boolean;
  threshold: number | null;
  cooldown_minutes: number;
  created_at: string;
}

export interface AlertEvent {
  id: number;
  alert_type: AlertType;
  olt_name: string;
  onu_serial: string | null;
  message: string;
  sent: boolean;
  triggered_at: string;
}

// ── Signal history ────────────────────────────────────────────────────────────
export interface SignalSample {
  t: string;
  rx_power: number;
}

export interface SignalHistoryResponse {
  onu_id: number;
  serial_number: string;
  pon_port: string;
  current_signal: number | null;
  hours: number;
  samples: SignalSample[];
}

// ── Bandwidth ─────────────────────────────────────────────────────────────────
export interface BandwidthSample {
  t: string;        // ISO timestamp
  in_mbps: number;
  out_mbps: number;
}

export interface BandwidthPort {
  port_id: number;
  port_name: string;
  port_type: string;
  samples: BandwidthSample[];
}

export interface BandwidthResponse {
  olt_id: number;
  hours: number;
  ports: BandwidthPort[];
}

// ── Announcements ─────────────────────────────────────────────────────────────
export type AnnouncementType = 'info' | 'success' | 'warning' | 'critical';

export interface Announcement {
  id: number;
  title: string;
  message: string;
  type: AnnouncementType;
  is_active: boolean;
  is_dismissible: boolean;
  expires_at: string | null;
  created_by_username: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: number;
  ticket_id: number;
  ticket_subject: string;
  message: string;
  is_read: boolean;
  created_at: string;
}
