import type { UnlockedAchievement, UserStats } from '@runturf/shared';
import { levelProgress } from '@runturf/shared';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { get } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { formatDistance } from '../record/recorder';

export function ProfilePage() {
  const { user, logout } = useAuth();
  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: () => get<UserStats>('/users/me/stats'),
  });
  const { data: unlocked } = useQuery({
    queryKey: ['myAchievements'],
    queryFn: () => get<UnlockedAchievement[]>('/users/me/achievements'),
  });

  const lp = stats ? levelProgress(stats.xp) : null;

  return (
    <div className="h-full overflow-y-auto p-4 pb-8">
      <div className="flex items-center gap-4">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-slate-900"
          style={{ backgroundColor: user?.color }}
        >
          {user?.displayName.slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">{user?.displayName}</h1>
          <p className="text-sm text-slate-400">@{user?.username}</p>
        </div>
        <button
          onClick={logout}
          className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-600"
        >
          Sign out
        </button>
      </div>

      {stats && lp && (
        <>
          <div className="mt-6 rounded-xl border border-slate-700 bg-slate-800/60 p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-lg font-bold text-white">Level {lp.level}</span>
              <span className="text-xs text-slate-400">
                {stats.xp - lp.currentLevelXp} / {lp.nextLevelXp - lp.currentLevelXp} XP
              </span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-700">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300"
                style={{ width: `${Math.round(lp.progress * 100)}%` }}
              />
            </div>
            <div className="mt-3 flex justify-between text-sm">
              <span className="text-amber-300">🪙 {stats.coins} coins</span>
              <span className="text-orange-300">🔥 {stats.streakDays}-day streak</span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <Card label="Runs" value={String(stats.totalRuns)} />
            <Card label="Distance" value={formatDistance(stats.totalDistanceM)} />
            <Card label="Turf" value={`${stats.cellsOwned} 🚩`} />
          </div>
        </>
      )}

      <Link
        to="/challenges"
        className="mt-4 block rounded-xl border border-slate-700 bg-slate-800/60 p-4 hover:border-slate-500"
      >
        <div className="flex items-center justify-between">
          <span className="font-semibold text-white">🎯 Weekly challenges</span>
          <span className="text-slate-400">→</span>
        </div>
      </Link>

      <h2 className="mt-6 text-lg font-bold text-white">Badges</h2>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {unlocked?.map((a) => (
          <div key={a.code} className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
            <div className="text-2xl">{a.icon}</div>
            <div className="mt-1 text-sm font-semibold text-amber-200">{a.title}</div>
            <div className="text-xs text-slate-400">{a.description}</div>
          </div>
        ))}
        {unlocked?.length === 0 && (
          <p className="col-span-2 py-6 text-center text-sm text-slate-400">
            No badges yet — go run!
          </p>
        )}
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3">
      <div className="text-[10px] tracking-wide text-slate-400 uppercase">{label}</div>
      <div className="mt-1 text-lg font-bold text-white">{value}</div>
    </div>
  );
}
