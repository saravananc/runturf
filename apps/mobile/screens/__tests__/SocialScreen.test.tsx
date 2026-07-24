import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { del, get, post } from '../../api';
import { alice, bob } from '../../test-utils';
import { SocialScreen } from '../SocialScreen';

jest.mock('../../api');
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, []),
}));
jest.mock('../../AuthContext', () => ({
  useAuth: () => ({ user: require('../../test-utils').alice }),
}));

const mockGet = get as jest.MockedFunction<typeof get>;
const mockPost = post as jest.MockedFunction<typeof post>;
const mockDel = del as jest.MockedFunction<typeof del>;

const FEED = [
  {
    id: 'f1',
    user: alice,
    startedAt: '2026-07-23T16:53:00.000Z',
    distanceM: 554,
    durationS: 180,
    avgPaceSPerKm: 325,
    cellsCaptured: 2,
    cellsStolen: 0,
    xpGained: 62,
  },
];

const FRIENDS = [
  { user: bob, since: '2026-07-10T00:00:00.000Z', level: 3, cellsOwned: 10, totalDistanceM: 1503 },
];

const REQUESTS = [
  {
    id: 'req1',
    user: { ...bob, id: 'u3', username: 'pacer', displayName: 'Pacer Panther' },
    direction: 'incoming' as const,
    createdAt: '2026-07-22T00:00:00.000Z',
  },
];

const CLUBS = [
  {
    id: 'club1',
    name: 'Marina Wolves',
    tag: 'WOLF',
    description: "Let's own this city",
    color: '#8b5cf6',
    memberCount: 3,
    cellsOwned: 83,
    weeklyCellsCaptured: 49,
  },
];

function routeGet(overrides: Record<string, unknown> = {}) {
  mockGet.mockImplementation((path: string) => {
    const table: Record<string, unknown> = {
      '/social/feed': FEED,
      '/social/friends': FRIENDS,
      '/social/requests': REQUESTS,
      '/clubs/mine': null,
      '/clubs': CLUBS,
      '/clubs/invites': [],
      ...overrides,
    };
    if (path in table) return Promise.resolve(table[path]);
    if (path.startsWith('/social/search')) return Promise.resolve(table['__search'] ?? []);
    return Promise.resolve([]);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  routeGet();
});

it('opens on the feed and renders activity', async () => {
  render(<SocialScreen />);
  await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/social/feed'));
  expect(await screen.findByText(/554 m/)).toBeTruthy();
});

it('switches tabs and loads each one on demand', async () => {
  render(<SocialScreen />);
  await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/social/feed'));
  expect(mockGet).not.toHaveBeenCalledWith('/social/friends');

  fireEvent.press(screen.getByText('Friends'));
  await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/social/friends'));
  expect(await screen.findByText('Rival Runner')).toBeTruthy();

  fireEvent.press(screen.getByText('Clubs'));
  await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/clubs'));
  expect(await screen.findByText(/Marina Wolves/)).toBeTruthy();
});

it('marks the active tab for assistive tech', async () => {
  render(<SocialScreen />);
  const tabs = await screen.findAllByRole('tab');
  expect(tabs[0].props.accessibilityState.selected).toBe(true);

  fireEvent.press(screen.getByText('Friends'));
  const after = screen.getAllByRole('tab');
  expect(after[0].props.accessibilityState.selected).toBe(false);
  expect(after[1].props.accessibilityState.selected).toBe(true);
});

it('shows an incoming friend request and accepts it', async () => {
  render(<SocialScreen />);
  fireEvent.press(screen.getByText('Friends'));
  await waitFor(() => expect(screen.getByText('Pacer Panther')).toBeTruthy());

  mockPost.mockResolvedValue(undefined as never);
  fireEvent.press(screen.getByText('Accept'));

  await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/social/requests/req1/accept'));
});

it('debounces runner search and sends a request', async () => {
  jest.useFakeTimers();
  routeGet({ __search: [{ ...bob, id: 'u9', username: 'newpal', displayName: 'New Pal' }] });

  render(<SocialScreen />);
  fireEvent.press(screen.getByText('Friends'));
  await act(async () => {});

  fireEvent.changeText(screen.getByPlaceholderText('Find runners by name…'), 'ne');
  // Debounced: nothing goes out until the timer elapses.
  expect(mockGet).not.toHaveBeenCalledWith(expect.stringContaining('/social/search'));

  await act(async () => {
    jest.advanceTimersByTime(400);
  });
  expect(mockGet).toHaveBeenCalledWith('/social/search?q=ne');

  jest.useRealTimers();
  await waitFor(() => expect(screen.getByText('New Pal')).toBeTruthy());

  mockPost.mockResolvedValue(undefined as never);
  fireEvent.press(screen.getByText('Add'));
  await waitFor(() =>
    expect(mockPost).toHaveBeenCalledWith('/social/requests', { username: 'newpal' }),
  );
});

it('does not search for a single character', async () => {
  jest.useFakeTimers();
  render(<SocialScreen />);
  fireEvent.press(screen.getByText('Friends'));
  await act(async () => {});

  fireEvent.changeText(screen.getByPlaceholderText('Find runners by name…'), 'n');
  await act(async () => {
    jest.advanceTimersByTime(1000);
  });

  expect(mockGet).not.toHaveBeenCalledWith(expect.stringContaining('/social/search'));
  jest.useRealTimers();
});

it('removes a friend only after confirming', async () => {
  const { Alert } = require('react-native');
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});

  render(<SocialScreen />);
  fireEvent.press(screen.getByText('Friends'));
  await waitFor(() => expect(screen.getByText('Rival Runner')).toBeTruthy());

  fireEvent.press(screen.getByText('Remove'));
  expect(Alert.alert).toHaveBeenCalledWith('Remove friend?', 'Rival Runner', expect.any(Array));
  expect(mockDel).not.toHaveBeenCalled();

  const actions = (Alert.alert as jest.Mock).mock.calls[0][2];
  await act(async () => {
    await actions.find((a: { text: string }) => a.text === 'Remove').onPress();
  });
  expect(mockDel).toHaveBeenCalledWith(`/social/friends/${bob.id}`);
});
