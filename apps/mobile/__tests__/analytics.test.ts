import { flush, track } from '../analytics';
import { post } from '../api';

jest.mock('../api');
const mockPost = post as jest.MockedFunction<typeof post>;

interface Batch {
  source: string;
  events: { name: string; props?: Record<string, unknown>; ts?: number }[];
}

beforeEach(() => {
  mockPost.mockReset();
  mockPost.mockResolvedValue(undefined as never);
});

describe('mobile analytics', () => {
  it('buffers events and flushes them as one mobile batch', async () => {
    track('app_opened');
    track('shop_item_purchased', { code: 'xp_boost' });
    expect(mockPost).not.toHaveBeenCalled(); // buffered, not sent yet

    await flush();

    expect(mockPost).toHaveBeenCalledTimes(1);
    const [path, body] = mockPost.mock.calls[0] as [string, Batch];
    expect(path).toBe('/events');
    expect(body.source).toBe('mobile');
    expect(body.events.map((e) => e.name)).toEqual(['app_opened', 'shop_item_purchased']);
    expect(body.events[1].props).toEqual({ code: 'xp_boost' });
  });

  it('swallows a failed flush so analytics never breaks the app', async () => {
    mockPost.mockRejectedValueOnce(new Error('offline'));
    track('user_signed_in');
    await expect(flush()).resolves.toBeUndefined();
  });
});
