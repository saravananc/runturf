import { NavLink, Outlet } from 'react-router-dom';

const tabs = [
  { to: '/', label: 'Map', icon: '🗺️' },
  { to: '/record', label: 'Record', icon: '⏺️' },
  { to: '/history', label: 'History', icon: '📜' },
  { to: '/leaderboard', label: 'Rank', icon: '🏆' },
  { to: '/profile', label: 'Profile', icon: '👤' },
];

export function Layout() {
  return (
    <div className="flex h-full flex-col">
      <main className="min-h-0 flex-1">
        <Outlet />
      </main>
      <nav className="flex shrink-0 border-t border-slate-700 bg-slate-900/95 pb-[env(safe-area-inset-bottom)]">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
                isActive ? 'text-emerald-400' : 'text-slate-400'
              }`
            }
          >
            <span className="text-lg leading-none">{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
