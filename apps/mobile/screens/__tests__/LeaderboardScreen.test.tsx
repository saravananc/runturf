import { render, screen, waitFor } from '@testing-library/react-native';
import { get } from '../../api';
import { alice, bob } from '../../test-utils';
import { LeaderboardScreen } from '../LeaderboardScreen';

jest.mock('../../api');
// Outside a navigator useFocusEffect never fires; run it once on mount instead.
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, []),
}));
jest.mock('../../AuthContext', () => ({
  useAuth: () => ({ user: require('../../test-utils').alice }),
}));

const mockGet = get as jest.MockedFunction<typeof get>;

const ROWS = [
  { user: alice, cellsOwned: 25, weeklyDistanceM: 945, xp: 839, level: 4 },
  { user: bob, cellsOwned: 10, weeklyDistanceM: 0, xp: 425, level: 3 },
];

beforeEach(() => jest.clearAllMocks());

it('ranks runners with medals and their turf counts', async () => {
  mockGet.mockResolvedValue(ROWS);
  render(<LeaderboardScreen />);

  await waitFor(() => expect(screen.getByText('Demo Runner')).toBeTruthy());
  expect(mockGet).toHaveBeenCalledWith('/territory/leaderboard');

  expect(screen.getByText('🥇')).toBeTruthy();
  expect(screen.getByText('🥈')).toBeTruthy();
  expect(screen.getByText('25 🚩')).toBeTruthy();
  expect(screen.getByText('Lv 4 · 945 m this week')).toBeTruthy();
});

it('falls back to a number once the podium runs out', async () => {
  const extra = { ...bob, id: 'u3', displayName: 'Pacer Panther' };
  mockGet.mockResolvedValue([
    ...ROWS,
    { user: extra, cellsOwned: 5, weeklyDistanceM: 0, xp: 164, level: 2 },
    { user: { ...extra, id: 'u4', displayName: 'Fourth Runner' }, cellsOwned: 1, weeklyDistanceM: 0, xp: 10, level: 1 },
  ]);
  render(<LeaderboardScreen />);

  await waitFor(() => expect(screen.getByText('Fourth Runner')).toBeTruthy());
  expect(screen.getByText('🥉')).toBeTruthy();
  expect(screen.getByText('4')).toBeTruthy(); // 4th place has no medal
});

it('renders full display names — no truncation', async () => {
  mockGet.mockResolvedValue(ROWS);
  render(<LeaderboardScreen />);

  const name = await screen.findByText('Demo Runner');
  // A numberOfLines cap is what previously clipped names to "Demo R…".
  expect(name.props.numberOfLines).toBeUndefined();
});

it('shows an empty state rather than a blank screen', async () => {
  mockGet.mockResolvedValue([]);
  render(<LeaderboardScreen />);

  await waitFor(() => expect(screen.getByText('No territory claimed yet')).toBeTruthy());
});

it('surfaces a load failure', async () => {
  mockGet.mockRejectedValue(new Error('Network unreachable'));
  render(<LeaderboardScreen />);

  await waitFor(() => expect(screen.getByText('Network unreachable')).toBeTruthy());
});
