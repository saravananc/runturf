import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, get, hasSession, post, revokeSession, setTokens } from './client';

/** Minimal Response stand-in for a mocked fetch. */
function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  setTokens({ accessToken: 'access-1', refreshToken: 'refresh-1' });
});

afterEach(() => {
  vi.unstubAllGlobals();
  setTokens(null);
});

describe('api client', () => {
  it('attaches the bearer token and parses JSON', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { hello: 'world' }));
    const data = await get<{ hello: string }>('/thing');
    expect(data).toEqual({ hello: 'world' });
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer access-1');
  });

  it('refreshes once on 401, then retries the original request', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { error: 'expired' })) // original
      .mockResolvedValueOnce(
        jsonResponse(200, {
          user: { id: 'u1' },
          accessToken: 'access-2',
          refreshToken: 'refresh-2',
        }),
      ) // /auth/refresh
      .mockResolvedValueOnce(jsonResponse(200, { ok: true })); // retry

    const data = await get<{ ok: boolean }>('/protected');
    expect(data).toEqual({ ok: true });

    // The retry carries the rotated access token.
    const retryInit = fetchMock.mock.calls[2][1];
    expect((retryInit.headers as Headers).get('Authorization')).toBe('Bearer access-2');
    // ...and the new tokens are persisted.
    expect(localStorage.getItem('rt_access')).toBe('access-2');
  });

  it('clears the session and throws when refresh also fails', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { error: 'expired' }))
      .mockResolvedValueOnce(jsonResponse(401, { error: 'refresh dead' }));

    await expect(get('/protected')).rejects.toBeInstanceOf(ApiError);
    expect(hasSession()).toBe(false);
    expect(localStorage.getItem('rt_refresh')).toBeNull();
  });

  it('surfaces the server error message', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(409, { error: 'Username already taken' }));
    await expect(post('/auth/register', {})).rejects.toMatchObject({
      status: 409,
      message: 'Username already taken',
    });
  });

  it('revokeSession posts logout and clears tokens', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(204, null));
    await revokeSession();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/auth/logout');
    expect(JSON.parse(init.body as string)).toEqual({ refreshToken: 'refresh-1' });
    expect(hasSession()).toBe(false);
  });

  it('revokeSession still clears locally if the network call fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await revokeSession();
    expect(hasSession()).toBe(false);
  });
});
