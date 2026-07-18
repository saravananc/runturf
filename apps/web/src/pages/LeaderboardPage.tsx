import type { LeaderboardEntry } from '@runturf/shared';
import { useQuery } from '@tanstack/react-query';
import { get } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { FlagIcon, TrophyIcon } from '../components/icons';
import { Avatar, EmptyState } from '../components/ui';
import { formatDistance } from '../record/recorder';

const PODIUM = ['text-gold', 'text-silver', 'text-bronze'];

export function LeaderboardPage() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => get<LeaderboardEntry[]>('/territory/leaderboard'),
  });

  const podium = data?.slice(0, 3) ?? [];
  const rest = data?.slice(3) ?? [];

  return (
    <div className="mx-auto h-full w-full max-w-lg overflow-y-auto p-4 pb-8">
      <h1 className="t-title text-ink">Leaderboard</h1>
      <p className="mt-0.5 text-[13px] text-ink-2">Who owns the most turf?</p>

      {isLoading && <p className="py-10 text-center text-ink-2">Loading…</p>}

      {podium.length > 0 && (
        <div className="mt-5 flex items-end justify-center gap-2.5">
          {/* visual order: 2nd, 1st, 3rd — absent places take no space */}
          {[podium[1], podium[0], podium[2]]
            .flatMap((e, col) =>
              e ? [{ entry: e, place: (col === 1 ? 1 : col === 0 ? 2 : 3) as 1 | 2 | 3 }] : [],
            )
            .map(({ entry, place }) => (
              <PodiumCard
                key={entry.user.id}
                entry={entry}
                place={place}
                me={entry.user.id === user?.id}
              />
            ))}
        </div>
      )}

      <div className="mt-4 space-y-2.5">
        {rest.map((e, i) => (
          <div
            key={e.user.id}
            className={`card flex items-center gap-3 p-3 ${
              e.user.id === user?.id ? 'border-volt/40 bg-volt/5' : ''
            }`}
          >
            <span className="w-6 text-center text-[13px] font-bold text-ink-3">{i + 4}</span>
            <Avatar user={e.user} size={34} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-bold text-ink">{e.user.displayName}</div>
              <div className="text-[12px] text-ink-2">
                Lv {e.level} · {formatDistance(e.weeklyDistanceM)} this week
              </div>
            </div>
            <div className="text-right">
              <div className="inline-flex items-center gap-1 text-[14px] font-extrabold text-volt tabular-nums">
                <FlagIcon size={14} /> {e.cellsOwned}
              </div>
              <div className="text-[11px] text-ink-3">{e.xp} XP</div>
            </div>
          </div>
        ))}
        {data?.length === 0 && (
          <EmptyState
            icon={<TrophyIcon size={32} />}
            title="No territory claimed yet"
            hint="Be the first — every run claims the cells you cross."
          />
        )}
      </div>
    </div>
  );
}

function PodiumCard({
  entry,
  place,
  me,
}: {
  entry: LeaderboardEntry;
  place: 1 | 2 | 3;
  me: boolean;
}) {
  return (
    <div
      className={`card anim-rise flex min-w-0 flex-1 basis-0 flex-col items-center gap-1.5 px-2 pb-3 ${
        place === 1 ? 'max-w-44 border-gold/30 pt-5' : 'max-w-40 pt-3'
      } ${me ? 'border-volt/40' : ''}`}
      style={{ animationDelay: `${place * 0.08}s` }}
    >
      <span
        className={`flex h-5 items-center justify-center text-[13px] font-black ${PODIUM[place - 1]}`}
      >
        {place === 1 ? <TrophyIcon size={18} /> : `#${place}`}
      </span>
      <Avatar user={entry.user} size={place === 1 ? 52 : 42} ring={place === 1} />
      <div className="flex min-h-9 w-full items-center justify-center px-1">
        <div className="line-clamp-2 text-center text-[13px] leading-tight font-bold break-words text-ink">
          {entry.user.displayName}
        </div>
      </div>
      <div className="inline-flex items-center gap-1 text-[15px] font-extrabold text-volt tabular-nums">
        <FlagIcon size={14} /> {entry.cellsOwned}
      </div>
      <div className="flex flex-col items-center leading-tight">
        <span className="text-[11px] whitespace-nowrap text-ink-3">Lv {entry.level}</span>
        <span className="text-[11px] whitespace-nowrap text-ink-3">
          {formatDistance(entry.weeklyDistanceM)}/wk
        </span>
      </div>
    </div>
  );
}
