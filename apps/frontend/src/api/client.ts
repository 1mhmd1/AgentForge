import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';

/**
 * Single shared axios instance for the AgentForge backend.
 *
 *   baseURL          → /api prefix on NestJS (configurable via VITE_API_BASE_URL)
 *   withCredentials  → backend sets httpOnly `token` + `refresh_token` cookies
 *                      on login; we MUST send them on every request, including
 *                      the SSE stream.
 *   Bearer header    → backend also accepts `Authorization: Bearer <token>`
 *                      and the login response returns the access token in
 *                      JSON, so we mirror it for non-cookie contexts (e.g.
 *                      EventSource URLs that cannot carry cookies cross-origin).
 */

const BASE_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) ||
  'http://localhost:3000/api';

let inMemoryToken: string | null = null;
const STORAGE_KEY = 'agentforge.access_token';

function readStoredToken(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAccessToken(token: string | null): void {
  inMemoryToken = token;
  try {
    if (token) window.localStorage.setItem(STORAGE_KEY, token);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode etc. — in-memory token still works */
  }
}

export function getAccessToken(): string | null {
  return inMemoryToken ?? readStoredToken();
}

export function apiBaseUrl(): string {
  return BASE_URL;
}

const onUnauthorized: Array<() => void> = [];

export function onUnauthorizedResponse(handler: () => void): () => void {
  onUnauthorized.push(handler);
  return () => {
    const idx = onUnauthorized.indexOf(handler);
    if (idx >= 0) onUnauthorized.splice(idx, 1);
  };
}

export const client: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  timeout: 30_000,
});

client.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token && config.headers && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    if (err.response?.status === 401) {
      // Don't loop the refresh endpoint itself.
      const url = err.config?.url ?? '';
      if (!url.includes('/auth/refresh') && !url.includes('/auth/login')) {
        for (const h of onUnauthorized) {
          try { h(); } catch { /* noop */ }
        }
      }
    }
    return Promise.reject(err);
  },
);

export interface ApiError {
  message: string;
  status: number;
  errorCode?: string;
  details?: unknown;
}

export function toApiError(err: unknown): ApiError {
  const ax = err as AxiosError<any>;
  const status = ax?.response?.status ?? 0;
  const payload = ax?.response?.data;
  if (payload && typeof payload === 'object') {
    const body: any = payload;
    return {
      message: body.message ?? body.error?.message ?? 'Request failed',
      status,
      errorCode: body.errorCode ?? body.error?.code,
      details: body.details ?? body.error?.details,
    };
  }
  return { message: (ax as any)?.message ?? 'Network error', status };
}

/**
 * GET-style helper that unwraps the backend's `{ success, data }` envelope
 * applied by ResponseInterceptor. Endpoints that don't use the envelope
 * (SSE, raw text) bypass this and call `client` directly.
 */
export async function unwrap<T>(req: Promise<{ data: any }>): Promise<T> {
  const res = await req;
  const body = res.data;
  if (body && typeof body === 'object' && 'success' in body && 'data' in body) {
    return body.data as T;
  }
  return body as T;
}

export type { AxiosRequestConfig };
