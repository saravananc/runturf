import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { get, post } from '../../api';
import { ChallengesScreen } from '../ChallengesScreen';

/**
 * Runtime coverage for the Standings toggle — the on-demand fetch only fires
 * when the row is expanded, so a bundle check can never exercise it.
 */

jest.mock('../../api');
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, []),
}));

const mockGet = get as jest.MockedFunction<typeof get>;
const mockPost = post as jest.MockedFunction<typeof post>;

const user = (id: string, displayName: string) => ({
  id,
  username: displayName.toLowerCase(),
  displayName,
  color: '#3b82f6',
  createdAt: '2026-07-01T00:00:00.000Z',
});

const CHALLENGES = [
  {
    id: 'c1',
    code: 'weekly_distance_2026-07-20',
    title: 'Weekly 15K',
    description: 'Run a total of 15 km this week',
    metric: 'distance_m' as const,
    target: 15000,
    startsAt: '2026-07-20T00:00:00.000Z',
    endsAt: '2026-07-27T00:00:00.000Z',
    coinReward: 50,
    xpReward: 200,
    joined: true,
    progress: 945,
    completed: false,
  },
];

const STANDINGS = [
  { user: user('u1', 'Demo Runner'), progress: 945, completed: false },
  { user: user('u2', 'Rival Runner'), progress: 0, completed: false },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockImplementation((path: string) =>
    Promise.resolve(path === '/challenges' ? CHALLENGES : STANDINGS),
  );
});

async function renderScreen() {
  render(<ChallengesScreen />);
  await waitFor(() => expect(screen.getByText('Weekly 15K')).toBeTruthy());
}

it('does not fetch standings until the row is expanded', async () => {
  await renderScreen();
  expect(mockGet).toHaveBeenCalledWith('/challenges');
  expect(mockGet).not.toHaveBeenCalledWith('/challenges/c1/leaderboard');
});

it('loads and renders standings when expanded', async () => {
  await renderScreen();
  fireEvent.press(screen.getByText('▸ Standings'));

  await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/challenges/c1/leaderboard'));
  await waitFor(() => expect(screen.getByText('Demo Runner')).toBeTruthy());

  expect(screen.getByText('Rival Runner')).toBeTruthy();
  expect(screen.getByText('945 m')).toBeTruthy(); // progress uses the distance formatter
  expect(screen.getByText('▾ Hide standings')).toBeTruthy();
});

it('collapses again on a second press', async () => {
  await renderScreen();
  fireEvent.press(screen.getByText('▸ Standings'));
  await waitFor(() => expect(screen.getByText('Demo Runner')).toBeTruthy());

  fireEvent.press(screen.getByText('▾ Hide standings'));
  await waitFor(() => expect(screen.queryByText('Demo Runner')).toBeNull());
});

it('joins a challenge and reloads', async () => {
  mockGet.mockImplementation((path: string) =>
    Promise.resolve(path === '/challenges' ? [{ ...CHALLENGES[0], joined: false }] : STANDINGS),
  );
  mockPost.mockResolvedValue(undefined as never);

  await renderScreen();
  fireEvent.press(screen.getByText('Join challenge'));

  await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/challenges/c1/join'));
});
