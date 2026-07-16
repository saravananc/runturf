import type { LeaderboardEntry } from '@runturf/shared';
import { useQuery } from '@tanstack/react-query';
import { get } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { formatDistance } from '../record/recorder';

export function LeaderboardPage() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => get<LeaderboardEntry[]>('/territory/leaderboard'),
  });

  return (
    <div className="h-full overflow-y-auto p-4 pb-8">
      <h1 className="text-2xl font-bold text-white">Leaderboard</h1>
      <p className="mt-1 text-sm text-slate-400">Who owns the most turf?</p>

      {isLoading && <p className="mt-8 text-center text-slate-400">Loading…</p>}

      <div className="mt-5 space-y-2">
        {data?.map((e, i) => (
          <div
            key={e.user.id}
            className={`flex items-center gap-3 rounded-xl border p-3 ${
              e.user.id === user?.id
                ? 'border-emerald-500/60 bg-emerald-500/10'
                : 'border-slate-700 bg-slate-800/60'
            }`}
          >
            <div className="w-8 text-center text-lg font-bold text-slate-300">
              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
            </div>
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-slate-900"
              style={{ backgroundColor: e.user.color }}
            >
              {e.user.displayName.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-white">{e.user.displayName}</div>
              <div className="text-xs text-slate-400">
                Lv {e.level} · {formatDistance(e.weeklyDistanceM)} this week
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold text-emerald-300">{e.cellsOwned} 🚩</div>
              <div className="text-xs text-slate-400">{e.xp} XP</div>
            </div>
          </div>
        ))}
        {data?.length === 0 && (
          <p className="py-12 text-center text-slate-400">No territory claimed yet. Be first!</p>
        )}
      </div>
    </div>
  );
}
