import { NavLink, Outlet } from 'react-router-dom';
import {
  HistoryIcon,
  MapIcon,
  RecordIcon,
  TrophyIcon,
  UserIcon,
  UsersIcon,
} from './icons';

const tabs = [
  { to: '/', label: 'Map', Icon: MapIcon },
  { to: '/record', label: 'Record', Icon: RecordIcon },
  { to: '/social', label: 'Social', Icon: UsersIcon },
  { to: '/history', label: 'History', Icon: HistoryIcon },
  { to: '/leaderboard', label: 'Rank', Icon: TrophyIcon },
  { to: '/profile', label: 'Profile', Icon: UserIcon },
];

export function Layout() {
  return (
    <div className="flex h-full flex-col">
      <main className="min-h-0 flex-1">
        <Outlet />
      </main>
      <nav
        className="flex shrink-0 border-t border-white/8 bg-base/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
        aria-label="Primary"
      >
        {tabs.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `group relative flex flex-1 flex-col items-center gap-1 pt-2.5 pb-2 text-[10.5px] font-semibold tracking-wide transition-colors ${
                isActive ? 'text-volt' : 'text-ink-3 hover:text-ink-2'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`absolute top-0 h-0.5 w-8 rounded-full bg-volt transition-opacity ${
                    isActive ? 'opacity-100' : 'opacity-0'
                  }`}
                />
                <Icon size={21} strokeWidth={isActive ? 2.4 : 2} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
