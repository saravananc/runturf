import { beforeEach, describe, expect, it, vi } from 'vitest';

// Stub the api client's post so no real request goes out.
const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('./client', () => ({ post }));

import { flush, track } from './analytics';

interface Batch {
  source: string;
  events: { name: string; props?: Record<string, unknown>; ts?: number }[];
}

beforeEach(() => {
  post.mockReset();
  post.mockResolvedValue({ recorded: 1 });
});

describe('web analytics', () => {
  it('buffers events and flushes them as one web batch', async () => {
    track('app_opened');
    track('run_submitted', { distanceM: 1000 });
    expect(post).not.toHaveBeenCalled(); // buffered, not sent yet

    await flush();

    expect(post).toHaveBeenCalledTimes(1);
    const [path, body] = post.mock.calls[0] as [string, Batch];
    expect(path).toBe('/events');
    expect(body.source).toBe('web');
    expect(body.events.map((e) => e.name)).toEqual(['app_opened', 'run_submitted']);
    expect(body.events[1].props).toEqual({ distanceM: 1000 });
    expect(typeof body.events[0].ts).toBe('number');
  });

  it('is a no-op when nothing is buffered', async () => {
    await flush();
    expect(post).not.toHaveBeenCalled();
  });

  it('swallows a failed flush so analytics never breaks the app', async () => {
    post.mockRejectedValueOnce(new Error('network'));
    track('user_signed_in');
    await expect(flush()).resolves.toBeUndefined();
    // Buffer was drained even though the send failed — no infinite retry.
    await flush();
    expect(post).toHaveBeenCalledTimes(1);
  });
});
