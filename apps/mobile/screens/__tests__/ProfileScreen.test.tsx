import type { NavigationProp } from '@react-navigation/native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { get, patch } from '../../api';
import { alice, stats } from '../../test-utils';
import { ProfileScreen } from '../ProfileScreen';

jest.mock('../../api');
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, []),
}));

const mockLogout = jest.fn();
const mockSetUser = jest.fn();
jest.mock('../../AuthContext', () => ({
  useAuth: () => ({
    user: require('../../test-utils').alice,
    logout: mockLogout,
    setUser: mockSetUser,
  }),
}));

const mockGet = get as jest.MockedFunction<typeof get>;
const mockPatch = patch as jest.MockedFunction<typeof patch>;

const CATALOG = [
  { code: 'first_run', title: 'First Steps', description: 'Finish your first run', icon: '👟', xpReward: 50 },
  { code: 'baron', title: 'Baron', description: 'Own 50 cells', icon: '🏰', xpReward: 300 },
];
const UNLOCKED = [{ ...CATALOG[0], unlockedAt: '2026-07-18T00:00:00.000Z' }];

const navigate = jest.fn();
const navigation = { navigate } as unknown as NavigationProp<never>;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockGet.mockImplementation((path: string) => {
    if (path === '/users/me/stats') return Promise.resolve(stats);
    if (path === '/users/me/achievements') return Promise.resolve(UNLOCKED);
    return Promise.resolve(CATALOG);
  });
});

async function renderProfile() {
  render(<ProfileScreen navigation={navigation} />);
  await waitFor(() => expect(screen.getByText('Demo Runner')).toBeTruthy());
}

it('shows identity, level progress and totals', async () => {
  await renderProfile();

  expect(screen.getByText('@demo')).toBeTruthy();
  expect(screen.getByText('4')).toBeTruthy(); // level, from levelProgress(839)
  // Level 4 spans 600..1000 XP, so 839 XP is 239 into a 400 XP band. The line
  // is one composite Text, hence the regex rather than an exact match.
  expect(screen.getByText(/239\s*\/\s*400 XP to Lv 5/)).toBeTruthy();
  expect(screen.getByText('🪙 14 coins')).toBeTruthy();
  expect(screen.getByText('🔥 1-day streak')).toBeTruthy();
  expect(screen.getByText('4.64 km')).toBeTruthy();
});

it('separates unlocked badges from locked ones', async () => {
  await renderProfile();

  expect(screen.getByText('1/2')).toBeTruthy();
  expect(screen.getByText('First Steps')).toBeTruthy();
  expect(screen.getByText('Baron')).toBeTruthy();
});

it('navigates to the shop and challenges', async () => {
  await renderProfile();

  fireEvent.press(screen.getByText('🪙  Shop'));
  expect(navigate).toHaveBeenCalledWith('Shop');

  fireEvent.press(screen.getByText('🎯  Weekly challenges'));
  expect(navigate).toHaveBeenCalledWith('Challenges');
});

it('saves a renamed profile and pushes it back into auth state', async () => {
  await renderProfile();
  fireEvent.press(screen.getByText('Edit'));

  const input = await screen.findByDisplayValue('Demo Runner');
  fireEvent.changeText(input, 'Demo Trailblazer');

  const updated = { ...alice, displayName: 'Demo Trailblazer' };
  mockPatch.mockResolvedValue(updated);
  fireEvent.press(screen.getByText('Save'));

  await waitFor(() =>
    expect(mockPatch).toHaveBeenCalledWith('/users/me', {
      displayName: 'Demo Trailblazer',
      color: alice.color,
    }),
  );
  expect(mockSetUser).toHaveBeenCalledWith(updated);
});

it('refuses to save an unchanged or empty name', async () => {
  await renderProfile();
  fireEvent.press(screen.getByText('Edit'));
  await screen.findByDisplayValue('Demo Runner');

  const saveDisabled = () =>
    screen.getAllByRole('button').find((b) => b.props.accessibilityState?.disabled === true);

  expect(saveDisabled()).toBeTruthy(); // unchanged

  fireEvent.changeText(screen.getByDisplayValue('Demo Runner'), '   ');
  expect(saveDisabled()).toBeTruthy(); // whitespace only
  expect(mockPatch).not.toHaveBeenCalled();
});

it('confirms before signing out', async () => {
  await renderProfile();
  fireEvent.press(screen.getByText('Sign out'));

  expect(Alert.alert).toHaveBeenCalledWith(
    'Sign out?',
    'You will need to sign in again.',
    expect.any(Array),
  );
  expect(mockLogout).not.toHaveBeenCalled(); // only after confirming

  // Invoke the destructive action the alert offered.
  const actions = (Alert.alert as jest.Mock).mock.calls[0][2];
  actions.find((a: { text: string }) => a.text === 'Sign out').onPress();
  expect(mockLogout).toHaveBeenCalled();
});
