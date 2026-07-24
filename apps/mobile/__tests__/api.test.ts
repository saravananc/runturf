/**
 * api.ts keeps the tokens in module scope, so every test re-requires it to get
 * a clean session rather than inheriting the previous test's login.
 *
 * AsyncStorage must be re-required alongside it: jest.resetModules() hands the
 * fresh api.ts a fresh mock instance, and a module-level import here would keep
 * pointing at the previous one — writes and reads would hit different stores.
 */
// No top-level imports remain, so this marks the file as a module; without it
// TS treats it as a global script and the local aliases below collide with DOM
// globals of the same name.
export {};

type ApiModule = typeof import('../api');
type StorageMock = (typeof import('@react-native-async-storage/async-storage'))['default'];

let api: ApiModule;
let AsyncStorage: StorageMock;
const fetchMock = jest.fn();

const AUTH = {
  user: { id: 'u1', username: 'demo', displayName: 'Demo Runner', color: '#3b82f6', createdAt: 'x' },
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
};

const ROTATED = { ...AUTH, accessToken: 'access-2', refreshToken: 'refresh-2' };

/** Minimal Response stand-in — api.ts only touches ok/status/json. */
const reply = (status: number, body?: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => {
    if (body === undefined) throw new SyntaxError('no body');
    return body;
  },
});

/** Routes by URL so concurrent calls can be reasoned about. */
function route(table: Record<string, () => ReturnType<typeof reply>>) {
  fetchMock.mockImplementation((url: string) => {
    for (const [fragment, make] of Object.entries(table)) {
      if (url.includes(fragment)) return Promise.resolve(make());
    }
    throw new Error(`unrouted fetch: ${url}`);
  });
}

const lastCall = () => fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
const headersOf = (call: unknown[]) => (call[1] as { headers: Record<string, string> }).headers;

beforeEach(async () => {
  jest.resetModules();
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  api = require('../api');
  // The maintainers' mock is a plain CommonJS export, so there is no `.default`
  // unless Babel's interop adds one.
  const storage = require('@react-native-async-storage/async-storage');
  AsyncStorage = storage.default ?? storage;
  await AsyncStorage.clear();
});

/* ---------- session persistence ---------- */

describe('session persistence', () => {
  it('defaults to the Android emulator host alias', () => {
    expect(api.API_URL).toBe('http://10.0.2.2:4000');
  });

  it('persists both tokens so a restart can resume', async () => {
    await api.setSession(AUTH);

    expect(await AsyncStorage.getItem('rt_access')).toBe('access-1');
    expect(await AsyncStorage.getItem('rt_refresh')).toBe('refresh-1');
  });

  it('restores a stored session on cold start', async () => {
    await AsyncStorage.multiSet([
      ['rt_access', 'access-1'],
      ['rt_refresh', 'refresh-1'],
    ]);

    expect(await api.loadSession()).toBe(true);

    // Proven restored by the header it now sends.
    route({ '/runs': () => reply(200, []) });
    await api.get('/runs');
    expect(headersOf(lastCall()).Authorization).toBe('Bearer access-1');
  });

  it('reports no session when storage is empty', async () => {
    expect(await api.loadSession()).toBe(false);
  });

  it('treats a missing refresh token as no session even if an access token lingers', async () => {
    await AsyncStorage.setItem('rt_access', 'orphan');

    // An access token alone cannot be renewed, so it is not a usable session.
    expect(await api.loadSession()).toBe(false);
  });

  it('clears both tokens on sign-out', async () => {
    await api.setSession(AUTH);
    await api.setSession(null);

    expect(await AsyncStorage.getItem('rt_access')).toBeNull();
    expect(await AsyncStorage.getItem('rt_refresh')).toBeNull();

    route({ '/runs': () => reply(200, []) });
    await api.get('/runs');
    expect(headersOf(lastCall()).Authorization).toBeUndefined();
  });
});

/* ---------- logout ---------- */

describe('revokeSession', () => {
  it('revokes the refresh token server-side, not just locally', async () => {
    await api.setSession(AUTH);
    route({ '/auth/logout': () => reply(204) });

    await api.revokeSession();

    const [url, init] = lastCall();
    expect(url).toBe('http://10.0.2.2:4000/auth/logout');
    expect(JSON.parse((init as { body: string }).body)).toEqual({ refreshToken: 'refresh-1' });
    expect(await AsyncStorage.getItem('rt_refresh')).toBeNull();
  });

  it('still clears the local session when the server is unreachable', async () => {
    await api.setSession(AUTH);
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(api.revokeSession()).resolves.toBeUndefined();
    expect(await AsyncStorage.getItem('rt_refresh')).toBeNull();
  });

  it('skips the network call when there is nothing to revoke', async () => {
    await api.revokeSession();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

/* ---------- requests ---------- */

describe('requests', () => {
  beforeEach(async () => {
    await api.setSession(AUTH);
  });

  it('sends JSON with the bearer token', async () => {
    route({ '/runs': () => reply(200, [{ id: 'r1' }]) });

    await expect(api.get('/runs')).resolves.toEqual([{ id: 'r1' }]);
    const [url, init] = lastCall();
    expect(url).toBe('http://10.0.2.2:4000/runs');
    expect(headersOf([url, init])['Content-Type']).toBe('application/json');
  });

  it('serialises bodies for post and patch, and omits an absent one', async () => {
    route({ '/x': () => reply(200, {}) });

    await api.post('/x', { a: 1 });
    expect((lastCall()[1] as { method: string; body: string }).method).toBe('POST');
    expect((lastCall()[1] as { body: string }).body).toBe('{"a":1}');

    await api.post('/x');
    expect((lastCall()[1] as { body?: string }).body).toBeUndefined();

    await api.patch('/x', { b: 2 });
    expect((lastCall()[1] as { method: string }).method).toBe('PATCH');

    await api.del('/x');
    expect((lastCall()[1] as { method: string }).method).toBe('DELETE');
  });

  it('returns undefined for 204 rather than parsing an empty body', async () => {
    route({ '/runs/r1': () => reply(204) });
    await expect(api.del('/runs/r1')).resolves.toBeUndefined();
  });

  it("surfaces the server's error message", async () => {
    route({ '/runs/import': () => reply(409, { error: 'That run has already been imported' }) });

    await expect(api.post('/runs/import', {})).rejects.toMatchObject({
      status: 409,
      message: 'That run has already been imported',
    });
  });

  it('falls back to a status message when the body is not JSON', async () => {
    route({ '/boom': () => reply(500) });

    await expect(api.get('/boom')).rejects.toMatchObject({
      status: 500,
      message: 'Request failed (500)',
    });
  });
});

/* ---------- token refresh ---------- */

describe('token refresh', () => {
  beforeEach(async () => {
    await api.setSession(AUTH);
  });

  it('refreshes on 401 and replays the request', async () => {
    let firstAttempt = true;
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/auth/refresh')) return Promise.resolve(reply(200, ROTATED));
      if (firstAttempt) {
        firstAttempt = false;
        return Promise.resolve(reply(401, { error: 'Token expired' }));
      }
      return Promise.resolve(reply(200, { ok: true }));
    });

    await expect(api.get('/users/me/stats')).resolves.toEqual({ ok: true });

    // The replay must carry the rotated token, not the stale one.
    expect(headersOf(lastCall()).Authorization).toBe('Bearer access-2');
    expect(await AsyncStorage.getItem('rt_refresh')).toBe('refresh-2');
  });

  it('coalesces concurrent 401s into a single refresh', async () => {
    const expired = new Set(['/a', '/b']);
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/auth/refresh')) return Promise.resolve(reply(200, ROTATED));
      const path = url.replace('http://10.0.2.2:4000', '');
      if (expired.has(path)) {
        expired.delete(path);
        return Promise.resolve(reply(401, { error: 'Token expired' }));
      }
      return Promise.resolve(reply(200, { path }));
    });

    // Two requests racing on an expired token must not rotate it twice —
    // the second rotation would invalidate the first's new token.
    const [a, b] = await Promise.all([api.get('/a'), api.get('/b')]);

    expect(a).toEqual({ path: '/a' });
    expect(b).toEqual({ path: '/b' });
    const refreshCalls = fetchMock.mock.calls.filter((c) => String(c[0]).includes('/auth/refresh'));
    expect(refreshCalls).toHaveLength(1);
  });

  it('drops the session when the refresh token is rejected', async () => {
    route({
      '/auth/refresh': () => reply(401, { error: 'Invalid refresh token' }),
      '/users/me/stats': () => reply(401, { error: 'Token expired' }),
    });

    await expect(api.get('/users/me/stats')).rejects.toMatchObject({ status: 401 });
    // A revoked session must not linger on the device.
    expect(await AsyncStorage.getItem('rt_refresh')).toBeNull();
  });

  it('retries only once, so a still-401 replay does not loop', async () => {
    route({
      '/auth/refresh': () => reply(200, ROTATED),
      '/users/me/stats': () => reply(401, { error: 'Token expired' }),
    });

    await expect(api.get('/users/me/stats')).rejects.toMatchObject({ status: 401 });
    const refreshCalls = fetchMock.mock.calls.filter((c) => String(c[0]).includes('/auth/refresh'));
    expect(refreshCalls).toHaveLength(1);
  });

  it('does not attempt a refresh without a refresh token', async () => {
    await api.setSession(null);
    route({ '/users/me/stats': () => reply(401, { error: 'Unauthorized' }) });

    await expect(api.get('/users/me/stats')).rejects.toMatchObject({ status: 401 });
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('/auth/refresh'))).toBe(false);
  });

  it('recovers after a failed refresh instead of wedging', async () => {
    route({
      '/auth/refresh': () => reply(500),
      '/x': () => reply(401, { error: 'Token expired' }),
    });
    await expect(api.get('/x')).rejects.toMatchObject({ status: 401 });

    // The in-flight guard must have been released for the next attempt.
    await api.setSession(AUTH);
    let first = true;
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/auth/refresh')) return Promise.resolve(reply(200, ROTATED));
      if (first) {
        first = false;
        return Promise.resolve(reply(401, {}));
      }
      return Promise.resolve(reply(200, { recovered: true }));
    });
    await expect(api.get('/x')).resolves.toEqual({ recovered: true });
  });
});

/* ---------- authenticate ---------- */

describe('authenticate', () => {
  it('logs in and establishes the session', async () => {
    route({ '/auth/login': () => reply(200, AUTH) });

    await expect(api.authenticate('login', 'demo', 'demo1234')).resolves.toEqual(AUTH);

    const [url, init] = lastCall();
    expect(url).toBe('http://10.0.2.2:4000/auth/login');
    expect(JSON.parse((init as { body: string }).body)).toEqual({
      username: 'demo',
      password: 'demo1234',
    });
    expect(await AsyncStorage.getItem('rt_access')).toBe('access-1');
  });

  it('registers through the same path', async () => {
    route({ '/auth/register': () => reply(201, AUTH) });

    await api.authenticate('register', 'newrunner', 'hunter2hunter2');
    expect(String(lastCall()[0])).toContain('/auth/register');
  });

  it('leaves no session behind when credentials are rejected', async () => {
    route({ '/auth/login': () => reply(401, { error: 'Invalid credentials' }) });

    await expect(api.authenticate('login', 'demo', 'nope')).rejects.toMatchObject({
      status: 401,
      message: 'Invalid credentials',
    });
    expect(await AsyncStorage.getItem('rt_access')).toBeNull();
  });

  it('sends no stale bearer token on the login request', async () => {
    await api.setSession(AUTH);
    route({ '/auth/login': () => reply(200, ROTATED) });

    await api.authenticate('login', 'demo', 'demo1234');
    expect(headersOf(lastCall()).Authorization).toBeUndefined();
  });
});
