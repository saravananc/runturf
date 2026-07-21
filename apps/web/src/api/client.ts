import type { AuthResponse } from '@runturf/shared';

const BASE = '/api';

let accessToken: string | null = localStorage.getItem('rt_access');
let refreshToken: string | null = localStorage.getItem('rt_refresh');

export function setTokens(auth: { accessToken: string; refreshToken: string } | null) {
  accessToken = auth?.accessToken ?? null;
  refreshToken = auth?.refreshToken ?? null;
  if (auth) {
    localStorage.setItem('rt_access', auth.accessToken);
    localStorage.setItem('rt_refresh', auth.refreshToken);
  } else {
    localStorage.removeItem('rt_access');
    localStorage.removeItem('rt_refresh');
  }
}

export function hasSession(): boolean {
  return !!refreshToken;
}

/** Revokes the refresh token server-side, then clears local tokens. */
export async function revokeSession(): Promise<void> {
  const token = refreshToken;
  setTokens(null);
  if (!token) return;
  try {
    await fetch(`${BASE}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: token }),
    });
  } catch {
    // Offline: local tokens are already cleared; the token expires server-side on its own.
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function rawFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  return fetch(`${BASE}${path}`, { ...options, headers });
}

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshToken) return false;
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        setTokens(null);
        return false;
      }
      const auth = (await res.json()) as AuthResponse;
      setTokens(auth);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res = await rawFetch(path, options);
  if (res.status === 401 && (await tryRefresh())) {
    res = await rawFetch(path, options);
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body.error) msg = body.error;
    } catch {
      /* keep default */
    }
    throw new ApiError(res.status, msg);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Fetches a binary/text resource (e.g. GPX) and returns it as a Blob. */
export async function getBlob(path: string): Promise<Blob> {
  let res = await rawFetch(path);
  if (res.status === 401 && (await tryRefresh())) {
    res = await rawFetch(path);
  }
  if (!res.ok) throw new ApiError(res.status, `Download failed (${res.status})`);
  return res.blob();
}

export const get = <T>(path: string) => api<T>(path);
export const post = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
export const patch = <T>(path: string, body: unknown) =>
  api<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
export const del = <T>(path: string) => api<T>(path, { method: 'DELETE' });
