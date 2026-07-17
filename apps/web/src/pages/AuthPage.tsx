import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { BoltIcon } from '../components/icons';

export function AuthPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') await login(username, password);
      else await register(username, password, displayName || undefined);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden p-6">
      {/* ambient brand glow */}
      <div
        className="pointer-events-none absolute -top-32 left-1/2 h-96 w-152 -translate-x-1/2 rounded-full opacity-25 blur-3xl"
        style={{
          background:
            'radial-gradient(closest-side, var(--color-volt), transparent 70%)',
          animation: 'glow-drift 14s ease-in-out infinite',
        }}
      />

      <div className="anim-pop relative w-full max-w-sm">
        <div className="mb-9 text-center">
          <div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-volt text-base shadow-[0_8px_40px_rgb(173_235_46/0.4)]"
            aria-hidden="true"
          >
            <BoltIcon size={34} strokeWidth={2.2} className="text-[#0a0f1e]" />
          </div>
          <h1 className="t-display mt-4 text-[2.1rem] text-ink">RunTurf</h1>
          <p className="mt-1.5 text-[13.5px] text-ink-2">
            Run. Capture territory. Defend your turf.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <input
            className="input"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
          {mode === 'register' && (
            <input
              className="input anim-rise"
              placeholder="Display name (optional)"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          )}
          <input
            className="input"
            type="password"
            placeholder="Password (8+ characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
          />
          {error && (
            <p role="alert" className="anim-rise text-[13px] font-medium text-ember">
              {error}
            </p>
          )}
          <button disabled={busy} className="btn btn-primary w-full py-3 text-[15px]">
            {busy ? 'One sec…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          className="mt-5 w-full text-center text-[13px] font-medium text-ink-2 transition-colors hover:text-ink"
        >
          {mode === 'login' ? 'New here? Create an account' : 'Have an account? Sign in'}
        </button>

        <p className="mt-8 text-center text-xs text-ink-3">
          Demo account: <span className="font-mono text-ink-2">demo / demo1234</span>
        </p>
      </div>
    </div>
  );
}
