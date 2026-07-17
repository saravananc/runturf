import type { FeedItem } from '@runturf/shared';
import { useQuery } from '@tanstack/react-query';
import { get } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { formatDistance, formatDuration, formatPace } from '../record/recorder';

export function FeedTab() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['feed'],
    queryFn: () => get<FeedItem[]>('/social/feed'),
    refetchInterval: 30_000,
  });

  if (isLoading) return <p className="py-10 text-center text-slate-400">Loading feed…</p>;

  return (
    <div className="space-y-3">
      {data?.length === 0 && (
        <p className="py-10 text-center text-slate-400">
          Nothing here yet — run, or add friends to see their activity!
        </p>
      )}
      {data?.map((item) => (
        <div key={item.id} className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-slate-900"
              style={{ backgroundColor: item.user.color }}
            >
              {item.user.displayName.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <span className="font-semibold text-white">
                {item.user.id === user?.id ? 'You' : item.user.displayName}
              </span>
              <span className="text-slate-400"> ran {formatDistance(item.distanceM)}</span>
              <div className="text-xs text-slate-500">
                {new Date(item.startedAt).toLocaleString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
            <span className="text-sm text-emerald-300">+{item.xpGained} XP</span>
          </div>
          <div className="mt-3 flex gap-4 text-sm text-slate-300">
            <span>{formatDuration(item.durationS)}</span>
            <span>{formatPace(item.avgPaceSPerKm)}</span>
            <span className="ml-auto">
              🚩 {item.cellsCaptured}
              {item.cellsStolen > 0 && ` ⚔️ ${item.cellsStolen}`}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
