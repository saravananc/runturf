import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { get, post } from '../../api';
import { ShopScreen } from '../ShopScreen';

jest.mock('../../api');
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, []),
}));

const mockGet = get as jest.MockedFunction<typeof get>;
const mockPost = post as jest.MockedFunction<typeof post>;

const BOOST = {
  code: 'xp_boost',
  name: 'XP Boost',
  description: 'Double the XP earned on your next run',
  icon: '⚡',
  cost: 50,
  owned: 0,
};
const FREEZE = {
  code: 'streak_freeze',
  name: 'Streak Freeze',
  description: 'Save your streak if you miss a day',
  icon: '🧊',
  cost: 75,
  owned: 0,
};

const shopWith = (coins: number) => ({ coins, items: [BOOST, FREEZE] });

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

async function renderShop(coins: number) {
  mockGet.mockResolvedValue(shopWith(coins));
  render(<ShopScreen />);
  await waitFor(() => expect(screen.getByText('XP Boost')).toBeTruthy());
}

it('lists items with the coin balance', async () => {
  await renderShop(200);
  expect(mockGet).toHaveBeenCalledWith('/shop');
  expect(screen.getByText('🪙 200')).toBeTruthy();
  expect(screen.getByText('Double the XP earned on your next run')).toBeTruthy();
  expect(screen.getByText('Streak Freeze')).toBeTruthy();
});

it('disables items the runner cannot afford', async () => {
  await renderShop(42); // both items cost more

  // Btn renders an accessible button wrapper carrying the disabled state.
  const buttons = screen.getAllByRole('button');
  expect(buttons.length).toBeGreaterThan(0);
  for (const b of buttons) {
    expect(b.props.accessibilityState?.disabled).toBe(true);
  }
});

it('buys an item and reflects the new balance and count', async () => {
  await renderShop(200);
  mockPost.mockResolvedValue({ coins: 150, item: { ...BOOST, owned: 1 } });

  fireEvent.press(screen.getByText('🪙 50'));

  await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/shop/xp_boost/buy'));
  await waitFor(() => expect(screen.getByText('🪙 150')).toBeTruthy());
  expect(screen.getByText('×1')).toBeTruthy();
});

it('alerts instead of silently swallowing a failed purchase', async () => {
  await renderShop(200);
  mockPost.mockRejectedValue(new Error('Not enough coins'));

  fireEvent.press(screen.getByText('🪙 50'));

  await waitFor(() =>
    expect(Alert.alert).toHaveBeenCalledWith('Purchase failed', 'Not enough coins'),
  );
  expect(screen.getByText('🪙 200')).toBeTruthy(); // balance untouched
});

it('shows an empty state when nothing is stocked', async () => {
  mockGet.mockResolvedValue({ coins: 10, items: [] });
  render(<ShopScreen />);

  await waitFor(() => expect(screen.getByText('Nothing in stock yet')).toBeTruthy());
});
