import type { UserPublic } from '@runturf/shared';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { track } from './analytics';
import { authenticate, get, loadSession, revokeSession, setSession } from './api';

interface AuthState {
  user: UserPublic | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (u: UserPublic) => void;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore a persisted session on cold start, so signing in survives restarts.
  useEffect(() => {
    (async () => {
      try {
        if (await loadSession()) {
          setUser(await get<UserPublic>('/auth/me'));
        }
      } catch {
        await setSession(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function login(username: string, password: string) {
    const auth = await authenticate('login', username, password);
    setUser(auth.user);
    track('user_signed_in');
  }

  async function register(username: string, password: string) {
    const auth = await authenticate('register', username, password);
    setUser(auth.user);
    track('user_registered');
  }

  function logout() {
    setUser(null);
    void revokeSession();
  }

  return (
    <Ctx.Provider value={{ user, loading, login, register, logout, setUser }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth used outside AuthProvider');
  return ctx;
}
