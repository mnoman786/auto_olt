import axios, { AxiosInstance } from 'axios';
import type {
  AuthResponse, OLT, OLTCreatePayload, ONU, VLAN, Customer,
  SetupLogsResponse, OLTStats, ProvisioningLog, PaginatedResponse, OLTPortsResponse, WireGuardInfo,
  Ticket, TicketListItem, TicketReply, AdminUser, AdminUserDetail, BandwidthResponse,
  AutoProvisionConfig, AlertRule, AlertEvent, SignalHistoryResponse, Announcement, Notification,
} from './types';
import { verifyResponseHMAC } from './hmac';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  // Capture raw response body before axios parses JSON, for HMAC verification
  transformResponse: [(rawData: string) => {
    try {
      const parsed = JSON.parse(rawData);
      if (parsed && typeof parsed === 'object') {
        Object.defineProperty(parsed, '__rawBody', {
          value: rawData,
          enumerable: false,
          writable: false,
        });
      }
      return parsed;
    } catch {
      return rawData;
    }
  }],
});

// Tokens are now stored in HttpOnly cookies — not accessible from JS.
// These stubs are kept so imports don't break; clearTokens clears user info only.
export const getAccessToken = () => null;
export const getRefreshToken = () => null;
export const setTokens = (_access: string, _refresh: string) => {};
export const clearTokens = () => {
  if (typeof window !== 'undefined') localStorage.removeItem('user');
};

// HMAC verification interceptor — runs before token refresh logic
apiClient.interceptors.response.use(
  async (response) => {
    if (typeof window !== 'undefined') {
      const timestamp = response.headers['x-timestamp'];
      const signature = response.headers['x-signature'];
      const rawBody = (response.data as any)?.__rawBody;
      if (timestamp && signature && rawBody) {
        const valid = await verifyResponseHMAC(timestamp, rawBody, signature);
        if (!valid) {
          return Promise.reject(Object.assign(new Error('Response signature invalid'), { tampered: true }));
        }
      }
    }
    return response;
  },
  (error) => Promise.reject(error),
);

// Response interceptor for token refresh and global error handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // 429 Too Many Requests — parse retry seconds and attach to error for UI use
    if (error.response?.status === 429) {
      const retryAfterHeader = error.response.headers?.['retry-after'];
      const detail: string = error.response.data?.detail || '';
      const match = detail.match(/(\d+)\s+second/);
      error.retryAfter = match
        ? parseInt(match[1], 10)
        : retryAfterHeader
          ? parseInt(retryAfterHeader, 10)
          : 60;
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        // Refresh cookie is sent automatically via withCredentials
        await axios.post(`${API_URL}/auth/token/refresh/`, {}, { withCredentials: true });
        return apiClient(originalRequest);
      } catch {
        clearTokens();
        if (typeof window !== 'undefined') window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const auth = {
  register: (data: { username: string; email: string; password: string; password2: string; company_name?: string }) =>
    apiClient.post<AuthResponse>('/auth/register/', data),

  login: (data: { username: string; password: string }) =>
    apiClient.post<AuthResponse>('/auth/login/', data),

  logout: (_refresh?: string) =>
    apiClient.post('/auth/logout/', {}),

  me: () => apiClient.get('/auth/me/'),

  updateProfile: (data: { first_name?: string; last_name?: string; email?: string }) =>
    apiClient.patch('/auth/me/update/', data),

  changePassword: (data: { current_password: string; new_password: string; confirm_password: string }) =>
    apiClient.post('/auth/me/change-password/', data),

  verifyEmail: (data: { email: string; otp: string }) =>
    apiClient.post<AuthResponse>('/auth/verify-email/', data),

  resendVerification: (email: string) =>
    apiClient.post('/auth/resend-verification/', { email }),

  forgotPassword: (email: string) =>
    apiClient.post('/auth/forgot-password/', { email }),

  resetPassword: (data: { email: string; otp: string; new_password: string; confirm_password: string }) =>
    apiClient.post('/auth/reset-password/', data),
};

// OLT API
export const oltApi = {
  list: (page?: number, search?: string) => apiClient.get<PaginatedResponse<OLT>>('/olts/', {
    params: { ...(page && page > 1 ? { page } : {}), ...(search ? { search } : {}) },
  }),

  create: (data: OLTCreatePayload) => apiClient.post<OLT>('/olts/', data),

  testConnection: (data: {
    ip_address: string;
    telnet_port?: number;
    olt_admin_username: string;
    olt_admin_password: string;
  }) =>
    apiClient.post<{ success: boolean; message: string }>(
      '/olts/test-connection/',
      data,
    ),

  get: (id: number) => apiClient.get<OLT>(`/olts/${id}/`),

  update: (id: number, data: Partial<OLTCreatePayload>) =>
    apiClient.patch<OLT>(`/olts/${id}/`, data),

  delete: (id: number) => apiClient.delete(`/olts/${id}/`),

  triggerSetup: (id: number) => apiClient.post(`/olts/${id}/setup/`),

  resetStatus: (id: number) =>
    apiClient.post<{ detail: string; status: string }>(`/olts/${id}/reset-status/`),

  getSetupLogs: (id: number) =>
    apiClient.get<SetupLogsResponse>(`/olts/${id}/setup/logs/`),

  poll: (id: number) => apiClient.post(`/olts/${id}/poll/`),

  stats: (id: number) => apiClient.get<OLTStats>(`/olts/${id}/stats/`),

  testSnmp: (id: number) => apiClient.get(`/olts/${id}/test-snmp/`),

  getPorts: (id: number) => apiClient.get<OLTPortsResponse>(`/olts/${id}/ports/`),

  discoverPorts: (id: number) => apiClient.post<OLTPortsResponse>(`/olts/${id}/ports/`),

  getWgInfo: (id: number) => apiClient.get<WireGuardInfo>(`/olts/${id}/wireguard/`),

  saveWgPeer: (id: number, data: { wg_client_public_key: string; wg_client_subnet: string }) =>
    apiClient.post<WireGuardInfo>(`/olts/${id}/wireguard/`, data),

  syncProfiles: (id: number) =>
    apiClient.post<{
      success: boolean;
      line_profiles: { id: number; name: string }[];
      srv_profiles: { id: number; name: string }[];
    }>(`/olts/${id}/profiles/sync/`),

  getBandwidth: (id: number, params?: { hours?: number; port_id?: number }) =>
    apiClient.get<BandwidthResponse>(`/olts/${id}/bandwidth/`, { params }),

  getAutoProvision: (id: number) =>
    apiClient.get<AutoProvisionConfig>(`/olts/${id}/auto-provision/`),

  saveAutoProvision: (id: number, data: {
    enabled: boolean;
    default_vlan: number | null;
    line_profile_id: number;
    srv_profile_id: number;
  }) => apiClient.put<AutoProvisionConfig>(`/olts/${id}/auto-provision/`, data),
};

// ONU API
export const onuApi = {
  list: (oltId: number, params?: { status?: string; search?: string; page?: number }) =>
    apiClient.get<PaginatedResponse<ONU>>(`/olts/${oltId}/onus/`, { params }),

  get: (oltId: number, onuId: number) =>
    apiClient.get<ONU>(`/olts/${oltId}/onus/${onuId}/`),

  register: (oltId: number, onuId: number, data: { vlan_id?: number; description?: string; service_profile?: string }) =>
    apiClient.post(`/olts/${oltId}/onus/${onuId}/register/`, data),

  deregister: (oltId: number, onuId: number) =>
    apiClient.post(`/olts/${oltId}/onus/${onuId}/deregister/`),

  getLogs: (oltId: number, onuId: number) =>
    apiClient.get<{ onu_id: number; status: string; logs: ProvisioningLog[] }>(
      `/olts/${oltId}/onus/${onuId}/logs/`
    ),

  bulkRegister: (oltId: number, data: { onu_ids: number[]; vlan_id?: number; description?: string }) =>
    apiClient.post(`/olts/${oltId}/onus/bulk-register/`, data),

  reboot: (oltId: number, onuId: number) =>
    apiClient.post(`/olts/${oltId}/onus/${onuId}/reboot/`),

  search: (q: string, currentOnuId?: number) =>
    apiClient.get<{ id: number; serial_number: string; pon_port: string; status: string; olt_name: string; olt_id: number }[]>(
      '/onus/search/', { params: { search: q, current_onu: currentOnuId } }
    ),
};

// VLAN API
export const vlanApi = {
  list: (oltId: number) =>
    apiClient.get<PaginatedResponse<VLAN>>(`/olts/${oltId}/vlans/`),

  create: (oltId: number, data: { vlan_id: number; name: string; description?: string }) =>
    apiClient.post<VLAN>(`/olts/${oltId}/vlans/`, data),

  update: (oltId: number, vlanId: number, data: Partial<{ name: string; description: string }>) =>
    apiClient.patch<VLAN>(`/olts/${oltId}/vlans/${vlanId}/`, data),

  delete: (oltId: number, vlanId: number) =>
    apiClient.delete(`/olts/${oltId}/vlans/${vlanId}/`),

  push: (oltId: number, vlanId: number) =>
    apiClient.post(`/olts/${oltId}/vlans/${vlanId}/push/`),

  sync: (oltId: number) =>
    apiClient.post<{
      success: boolean;
      method: 'snmp' | 'telnet';
      discovered: number;
      created: number;
      updated: number;
    }>(`/olts/${oltId}/vlans/sync/`),
};

// Ticket API
export const ticketApi = {
  list: (params?: { status?: string; page?: number }) =>
    apiClient.get<PaginatedResponse<TicketListItem>>('/tickets/', { params }),

  create: (data: { subject: string; message: string; olt?: number | null }) =>
    apiClient.post<Ticket>('/tickets/', data),

  get: (id: number) => apiClient.get<Ticket>(`/tickets/${id}/`),

  updateStatus: (id: number, status: string) =>
    apiClient.patch<Ticket>(`/tickets/${id}/`, { status }),

  reply: (id: number, message: string) =>
    apiClient.post<TicketReply>(`/tickets/${id}/reply/`, { message }),
};

// Admin API
export const adminApi = {
  listUsers: () =>
    apiClient.get<AdminUser[]>('/auth/admin/users/'),

  getUser: (id: number) =>
    apiClient.get<AdminUserDetail>(`/auth/admin/users/${id}/`),

  updateUser: (id: number, data: { is_active: boolean }) =>
    apiClient.patch<AdminUserDetail>(`/auth/admin/users/${id}/`, data),

  deleteUser: (id: number) =>
    apiClient.delete(`/auth/admin/users/${id}/`),
};

// Alerts API
export const alertsApi = {
  getRules: () =>
    apiClient.get<AlertRule[]>('/alerts/rules/'),

  createRule: (data: Omit<AlertRule, 'id' | 'olt_name' | 'created_at'>) =>
    apiClient.post<AlertRule>('/alerts/rules/', data),

  updateRule: (id: number, data: Partial<AlertRule>) =>
    apiClient.patch<AlertRule>(`/alerts/rules/${id}/`, data),

  deleteRule: (id: number) =>
    apiClient.delete(`/alerts/rules/${id}/`),

  getEvents: () =>
    apiClient.get<AlertEvent[]>('/alerts/events/'),
};

// Signal history API
export const signalApi = {
  getHistory: (oltId: number, onuId: number, hours = 24) =>
    apiClient.get<SignalHistoryResponse>(`/olts/${oltId}/onus/${onuId}/signal/`, { params: { hours } }),
};

// Helper: fetch a binary file with auth and trigger browser download
export async function downloadWithAuth(url: string, filename: string) {
  const response = await apiClient.get(url, { responseType: 'blob' });
  const blob = new Blob([response.data], { type: String(response.headers['content-type'] ?? 'application/octet-stream') });
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(href);
}

// Bulk ONU API
export const onuBulkApi = {
  bulkReboot: (oltId: number, onuIds: number[]) =>
    apiClient.post(`/olts/${oltId}/onus/bulk-reboot/`, { onu_ids: onuIds }),

  exportCsv: (oltId: number) =>
    downloadWithAuth(`/olts/${oltId}/onus/export/`, `onus_olt${oltId}.csv`),
};

// Reports API
export const reportsApi = {
  downloadExcel: (oltId: number, oltName?: string) => {
    const safeName = (oltName ?? `olt${oltId}`).replace(/[^a-zA-Z0-9_\-]/g, '_');
    return downloadWithAuth(`/olts/${oltId}/report/`, `${safeName}_report.xlsx`);
  },
};

// Announcements API
export const announcementsApi = {
  list: () => apiClient.get<Announcement[]>('/announcements/'),

  create: (data: Pick<Announcement, 'title' | 'message' | 'type' | 'is_active' | 'is_dismissible' | 'expires_at'>) =>
    apiClient.post<Announcement>('/announcements/', data),

  update: (id: number, data: Partial<Pick<Announcement, 'title' | 'message' | 'type' | 'is_active' | 'is_dismissible' | 'expires_at'>>) =>
    apiClient.patch<Announcement>(`/announcements/${id}/`, data),

  delete: (id: number) => apiClient.delete(`/announcements/${id}/`),
};

// Customers API
export const customerApi = {
  list: (params?: { search?: string; page?: number; unassigned?: boolean }) =>
    apiClient.get<PaginatedResponse<Customer>>('/customers/', { params }),

  get: (id: number) => apiClient.get<Customer>(`/customers/${id}/`),

  create: (data: Partial<Omit<Customer, 'id' | 'onu_serial' | 'onu_pon_port' | 'onu_status' | 'olt_name' | 'olt_id' | 'created_at' | 'updated_at'>>) =>
    apiClient.post<Customer>('/customers/', data),

  update: (id: number, data: Partial<Customer>) =>
    apiClient.patch<Customer>(`/customers/${id}/`, data),

  delete: (id: number) => apiClient.delete(`/customers/${id}/`),

  importCsv: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient.post<{ created: number; skipped: number; errors: string[] }>(
      '/customers/import/', form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
  },
};

// Notifications API
export const notificationsApi = {
  list: () => apiClient.get<Notification[]>('/notifications/'),
  markRead: (id: number) => apiClient.post(`/notifications/${id}/read/`),
  markAllRead: () => apiClient.post('/notifications/mark-all-read/'),
};

export default apiClient;
