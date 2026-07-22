import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthResponse } from '@runturf/shared';

/**
 * Set EXPO_PUBLIC_API_URL to your machine's LAN address on a physical device,
 * e.g. EXPO_PUBLIC_API_URL=http://192.168.1.20:4000
 * 10.0.2.2 is the Android emulator's alias for the host machine.
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:4000';

const ACCESS_KEY = 'rt_access';
const REFRESH_KEY = 'rt_refresh';

let accessToken: string | null = null;
let refreshToken: string | null = null;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Restores a persisted session on cold start. */
export async function loadSession(): Promise<boolean> {
  const [[, a], [, r]] = await AsyncStorage.multiGet([ACCESS_KEY, REFRESH_KEY]);
  accessToken = a;
  refreshToken = r;
  return !!refreshToken;
}

export async function setSession(auth: AuthResponse | null): Promise<void> {
  accessToken = auth?.accessToken ?? null;
  refreshToken = auth?.refreshToken ?? null;
  if (auth) {
    await AsyncStorage.multiSet([
      [ACCESS_KEY, auth.accessToken],
      [REFRESH_KEY, auth.refreshToken],
    ]);
  } else {
    await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY]);
  }
}

/** Revokes the refresh token server-side, then clears it locally. */
export async function revokeSession(): Promise<void> {
  const token = refreshToken;
  await setSession(null);
  if (!token) return;
  try {
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: token }),
    });
  } catch {
    // Offline: local tokens are gone; the server token expires on its own.
  }
}

function authedFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) ?? {}),
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return fetch(`${API_URL}${path}`, { ...options, headers });
}

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshToken) return false;
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        await setSession(null);
        return false;
      }
      await setSession((await res.json()) as AuthResponse);
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
  let res = await authedFetch(path, options);
  if (res.status === 401 && (await tryRefresh())) {
    res = await authedFetch(path, options);
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* keep the default */
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const get = <T>(path: string) => api<T>(path);
export const post = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
export const patch = <T>(path: string, body: unknown) =>
  api<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
export const del = <T>(path: string) => api<T>(path, { method: 'DELETE' });

/** Login/register bypass the auth header and establish the session. */
export async function authenticate(
  kind: 'login' | 'register',
  username: string,
  password: string,
): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/auth/${kind}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const body = await res.json();
  if (!res.ok) throw new ApiError(res.status, body?.error ?? 'Request failed');
  await setSession(body as AuthResponse);
  return body as AuthResponse;
}
