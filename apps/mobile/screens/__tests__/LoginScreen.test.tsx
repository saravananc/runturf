import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { LoginScreen } from '../LoginScreen';

const mockLogin = jest.fn();
const mockRegister = jest.fn();
jest.mock('../../AuthContext', () => ({
  useAuth: () => ({ login: mockLogin, register: mockRegister }),
}));

beforeEach(() => jest.clearAllMocks());

function fill(username: string, password: string) {
  fireEvent.changeText(screen.getByPlaceholderText('Username'), username);
  fireEvent.changeText(screen.getByPlaceholderText('Password'), password);
}

const submitButton = () =>
  screen.getAllByRole('button').find((b) => b.props.accessibilityState?.disabled !== undefined);

it('keeps submit disabled until both fields are filled', () => {
  render(<LoginScreen />);
  expect(submitButton()?.props.accessibilityState.disabled).toBe(true);

  fill('demo', '');
  expect(submitButton()?.props.accessibilityState.disabled).toBe(true);

  fill('demo', 'demo1234');
  expect(submitButton()?.props.accessibilityState.disabled).toBe(false);
});

it('signs in with a trimmed username', async () => {
  render(<LoginScreen />);
  fill('  demo  ', 'demo1234');
  fireEvent.press(screen.getByText('Sign in'));

  await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('demo', 'demo1234'));
  expect(mockRegister).not.toHaveBeenCalled();
});

it('surfaces a rejected sign-in instead of hanging on the spinner', async () => {
  mockLogin.mockRejectedValue(new Error('Invalid credentials'));
  render(<LoginScreen />);
  fill('demo', 'wrongpass');
  fireEvent.press(screen.getByText('Sign in'));

  await waitFor(() => expect(screen.getByText('Invalid credentials')).toBeTruthy());
  // Busy state must clear so the user can retry.
  expect(screen.getByText('Sign in')).toBeTruthy();
});

it('switches to registration and calls register', async () => {
  render(<LoginScreen />);
  fireEvent.press(screen.getByText('New here? Create an account'));

  expect(screen.getByText('Create account')).toBeTruthy();
  fill('newrunner', 'hunter2hunter2');
  fireEvent.press(screen.getByText('Create account'));

  await waitFor(() => expect(mockRegister).toHaveBeenCalledWith('newrunner', 'hunter2hunter2'));
  expect(mockLogin).not.toHaveBeenCalled();
});

it('clears a stale error when switching modes', async () => {
  mockLogin.mockRejectedValue(new Error('Invalid credentials'));
  render(<LoginScreen />);
  fill('demo', 'wrongpass');
  fireEvent.press(screen.getByText('Sign in'));
  await waitFor(() => expect(screen.getByText('Invalid credentials')).toBeTruthy());

  fireEvent.press(screen.getByText('New here? Create an account'));
  expect(screen.queryByText('Invalid credentials')).toBeNull();
});
