import type {
  AdminSummary,
  AvailabilityMap,
  EventMeta,
  OverlapResult,
  Session,
} from './types';

const TOKEN_KEY = 'scheduler.token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

class ApiError extends Error {
  status: number;
  needsName?: boolean;
  constructor(status: number, message: string, needsName?: boolean) {
    super(message);
    this.status = status;
    this.needsName = needsName;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, { ...options, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};

  if (!res.ok) {
    throw new ApiError(res.status, data.error || `La solicitud falló (${res.status})`, data.needsName);
  }
  return data as T;
}

export const api = {
  meta: () => request<EventMeta>('/meta'),

  auth: (code: string, name?: string) =>
    request<Session>('/auth', {
      method: 'POST',
      body: JSON.stringify({ code, name }),
    }),

  me: () => request<{ isAdmin: boolean; name: string | null; userId: number | null }>('/me'),

  logout: () => request<{ ok: boolean }>('/logout', { method: 'POST' }),

  myAvailability: async (): Promise<AvailabilityMap> => {
    const { byDate } = await request<{ byDate: AvailabilityMap }>('/availability');
    return byDate;
  },

  setDay: (date: string, hours: number[]) =>
    request<{ date: string; hours: number[] }>(`/availability/${date}`, {
      method: 'PUT',
      body: JSON.stringify({ hours }),
    }),

  overlap: () => request<OverlapResult>('/overlap'),

  adminSummary: () => request<AdminSummary>('/admin/summary'),
};

export { ApiError };
