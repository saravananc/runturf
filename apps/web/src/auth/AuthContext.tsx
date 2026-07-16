import type { AuthResponse, UserPublic } from '@runturf/shared';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { get, hasSession, post, setTokens } from '../api/client';

interface AuthState {
  user: UserPublic | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, displayName?: string) => Promise<void>;
  logout: () => void;
  setUser: (u: UserPublic) => void;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasSession()) {
      setLoading(false);
      return;
    }
    get<UserPublic>('/auth/me')
      .then(setUser)
      .catch(() => setTokens(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(username: string, password: string) {
    const auth = await post<AuthResponse>('/auth/login', { username, password });
    setTokens(auth);
    setUser(auth.user);
  }

  async function register(username: string, password: string, displayName?: string) {
    const auth = await post<AuthResponse>('/auth/register', { username, password, displayName });
    setTokens(auth);
    setUser(auth.user);
  }

  function logout() {
    setTokens(null);
    setUser(null);
  }

  return (
    <Ctx.Provider value={{ user, loading, login, register, logout, setUser }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
