import axios, { AxiosInstance } from 'axios';
import type {
  AuthResponse, OLT, OLTCreatePayload, ONU, VLAN,
  SetupLogsResponse, OLTStats, ProvisioningLog, PaginatedResponse, OLTPortsResponse, WireGuardInfo,
  Ticket, TicketListItem, TicketReply,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Token management
export const getAccessToken = () =>
  typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

export const getRefreshToken = () =>
  typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;

export const setTokens = (access: string, refresh: string) => {
  localStorage.setItem('access_token', access);
  localStorage.setItem('refresh_token', refresh);
};

export const clearTokens = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
};

// Request interceptor to add Authorization header
apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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
      const refresh = getRefreshToken();
      if (refresh) {
        try {
          const resp = await axios.post(`${API_URL}/auth/token/refresh/`, { refresh });
          const newAccess = resp.data.access;
          localStorage.setItem('access_token', newAccess);
          originalRequest.headers.Authorization = `Bearer ${newAccess}`;
          return apiClient(originalRequest);
        } catch {
          clearTokens();
          window.location.href = '/login';
        }
      } else {
        clearTokens();
        if (typeof window !== 'undefined') window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const auth = {
  register: (data: { username: string; email: string; password: string; password2: string }) =>
    apiClient.post<AuthResponse>('/auth/register/', data),

  login: (data: { username: string; password: string }) =>
    apiClient.post<AuthResponse>('/auth/login/', data),

  logout: (refresh: string) =>
    apiClient.post('/auth/logout/', { refresh }),

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
  list: (page?: number) => apiClient.get<PaginatedResponse<OLT>>('/olts/', { params: page && page > 1 ? { page } : undefined }),

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

export default apiClient;
