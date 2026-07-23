import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthPage } from './AuthPage';

// Stable spies shared with the mocked auth context.
const { login, register } = vi.hoisted(() => ({ login: vi.fn(), register: vi.fn() }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ login, register }) }));

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  login.mockReset();
  register.mockReset();
});

describe('AuthPage', () => {
  it('logs in with the entered credentials', async () => {
    login.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByPlaceholderText('Username'), 'demo');
    await user.type(screen.getByPlaceholderText(/Password/), 'demo1234');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(login).toHaveBeenCalledWith('demo', 'demo1234');
  });

  it('shows the display-name field only in register mode', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.queryByPlaceholderText(/Display name/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /create an account/i }));
    expect(screen.getByPlaceholderText(/Display name/)).toBeInTheDocument();
  });

  it('surfaces an auth error as an alert', async () => {
    login.mockRejectedValueOnce(new Error('Invalid username or password'));
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByPlaceholderText('Username'), 'demo');
    await user.type(screen.getByPlaceholderText(/Password/), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid username or password'),
    );
    expect(register).not.toHaveBeenCalled();
  });
});
