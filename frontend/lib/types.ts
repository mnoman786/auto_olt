// Type definitions for the Auto OLT system

export interface User {
  id: number;
  username: string;
  email: string;
  created_at: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface AuthResponse {
  user: User;
  access: string;
  refresh: string;
}

export type OLTStatus = 'pending' | 'configuring' | 'active' | 'error' | 'offline';
export type SNMPVersion = 'v1' | 'v2c' | 'v3';

export interface OLT {
  id: number;
  name: string;
  ip_address: string;
  snmp_version: SNMPVersion;
  snmp_read_community: string;
  snmp_write_community: string;
  telnet_enabled: boolean;
  telnet_port: number;
  telnet_username: string;
  telnet_password: string;
  olt_admin_username: string;
  olt_admin_password: string;
  status: OLTStatus;
  system_name: string;
  system_description: string;
  system_uptime: string;
  last_polled: string | null;
  created_at: string;
  updated_at: string;
  onu_count: number;
  registered_onu_count: number;
}

export interface OLTCreatePayload {
  name: string;
  ip_address: string;
  snmp_version: SNMPVersion;
  snmp_read_community: string;
  snmp_write_community?: string;
  telnet_enabled: boolean;
  telnet_port?: number;
  telnet_username?: string;
  telnet_password?: string;
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
  provision_method: string;
  last_seen: string | null;
  registered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface VLAN {
  id: number;
  vlan_id: number;
  name: string;
  description: string;
  onu_count: number;
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
