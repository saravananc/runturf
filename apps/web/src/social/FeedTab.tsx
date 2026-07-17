import type { FeedItem } from '@runturf/shared';
import { useQuery } from '@tanstack/react-query';
import { get } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { FlagIcon, SwordsIcon, UsersIcon } from '../components/icons';
import { Avatar, EmptyState } from '../components/ui';
import { formatDistance, formatDuration, formatPace } from '../record/recorder';

export function FeedTab() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['feed'],
    queryFn: () => get<FeedItem[]>('/social/feed'),
    refetchInterval: 30_000,
  });

  if (isLoading) return <p className="py-10 text-center text-ink-2">Loading feed…</p>;

  return (
    <div className="space-y-2.5">
      {data?.length === 0 && (
        <EmptyState
          icon={<UsersIcon size={32} />}
          title="Nothing here yet"
          hint="Run, or add friends to see their activity."
        />
      )}
      {data?.map((item, i) => (
        <div
          key={item.id}
          className="card anim-rise p-4"
          style={{ animationDelay: `${Math.min(i * 0.05, 0.35)}s` }}
        >
          <div className="flex items-center gap-3">
            <Avatar user={item.user} size={38} />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] leading-tight">
                <span className="font-bold text-ink">
                  {item.user.id === user?.id ? 'You' : item.user.displayName}
                </span>{' '}
                <span className="text-ink-2">
                  ran <span className="font-bold text-ink">{formatDistance(item.distanceM)}</span>
                </span>
              </div>
              <div className="mt-0.5 text-[12px] text-ink-3">
                {new Date(item.startedAt).toLocaleString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
            <span className="shrink-0 text-[13px] font-bold text-volt">
              +{item.xpGained} XP
            </span>
          </div>
          <div className="mt-3 flex items-center gap-3 border-t border-white/6 pt-2.5 text-[13px] text-ink-2">
            <span>{formatDuration(item.durationS)}</span>
            <span className="text-ink-3">·</span>
            <span>{formatPace(item.avgPaceSPerKm)}</span>
            <span className="ml-auto inline-flex items-center gap-2 font-semibold">
              <span className="inline-flex items-center gap-1 text-volt">
                <FlagIcon size={14} /> {item.cellsCaptured}
              </span>
              {item.cellsStolen > 0 && (
                <span className="inline-flex items-center gap-1 text-ember">
                  <SwordsIcon size={14} /> {item.cellsStolen}
                </span>
              )}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
