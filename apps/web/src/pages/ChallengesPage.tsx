import type { Challenge, ChallengeStanding } from '@runturf/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { get, post } from '../api/client';
import { CoinIcon, TargetIcon } from '../components/icons';
import { Avatar, EmptyState } from '../components/ui';
import { formatDistance } from '../record/recorder';

/** Standings for one challenge, loaded on demand when expanded. */
function Standings({ challenge }: { challenge: Challenge }) {
  const { data, isLoading } = useQuery({
    queryKey: ['challengeStandings', challenge.id],
    queryFn: () => get<ChallengeStanding[]>(`/challenges/${challenge.id}/leaderboard`),
  });

  const fmt = (n: number) =>
    challenge.metric === 'distance_m' ? formatDistance(n) : `${Math.round(n)} cells`;

  if (isLoading) return <p className="py-3 text-center text-[12px] text-ink-3">Loading…</p>;
  if (!data?.length) {
    return <p className="py-3 text-center text-[12px] text-ink-3">Nobody has joined yet.</p>;
  }

  return (
    <div className="mt-3 space-y-1.5 border-t border-white/6 pt-3">
      {data.map((row, i) => (
        <div key={row.user.id} className="flex items-center gap-2.5">
          <span className="w-4 text-center text-[11px] font-bold text-ink-3">{i + 1}</span>
          <Avatar user={row.user} size={24} />
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink">
            {row.user.displayName}
          </span>
          {row.completed && <span className="text-[11px] font-extrabold text-volt">DONE</span>}
          <span className="text-[12px] font-bold text-ink-2 tabular-nums">{fmt(row.progress)}</span>
        </div>
      ))}
    </div>
  );
}

export function ChallengesPage() {
  const qc = useQueryClient();
  const [openStandings, setOpenStandings] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ['challenges'],
    queryFn: () => get<Challenge[]>('/challenges'),
  });
  const join = useMutation({
    mutationFn: (id: string) => post(`/challenges/${id}/join`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['challenges'] }),
  });

  return (
    <div className="mx-auto h-full w-full max-w-lg overflow-y-auto p-4 pb-8">
      <h1 className="t-title text-ink">Challenges</h1>
      <p className="mt-0.5 text-[13px] text-ink-2">Join weekly goals, earn coins and XP</p>

      <div className="mt-5 space-y-2.5">
        {data?.map((c, i) => {
          const pct = Math.min(100, Math.round(((c.progress ?? 0) / c.target) * 100));
          const targetLabel =
            c.metric === 'distance_m' ? formatDistance(c.target) : `${c.target} cells`;
          const progressLabel =
            c.metric === 'distance_m'
              ? formatDistance(c.progress ?? 0)
              : `${Math.round(c.progress ?? 0)} cells`;
          return (
            <div
              key={c.id}
              className={`card anim-rise p-4 ${c.completed ? 'border-volt/30' : ''}`}
              style={{ animationDelay: `${i * 0.07}s` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[15px] font-bold text-ink">
                    {c.title}
                    {c.completed && (
                      <span className="ml-2 rounded-full bg-volt/15 px-2 py-0.5 text-[11px] font-extrabold text-volt">
                        DONE
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[12px] text-ink-2">{c.description}</div>
                </div>
                <div className="shrink-0 text-right text-[12px] font-bold whitespace-nowrap">
                  <span className="inline-flex items-center gap-1 text-gold">
                    <CoinIcon size={14} /> {c.coinReward}
                  </span>
                  <div className="mt-0.5 text-grape">✦ {c.xpReward} XP</div>
                </div>
              </div>

              {c.joined ? (
                <div className="mt-3.5">
                  <div className="h-2.5 overflow-hidden rounded-full bg-elev2">
                    <div
                      className="h-full rounded-full transition-[width] duration-700 ease-out"
                      style={{
                        width: `${pct}%`,
                        background: c.completed
                          ? 'var(--color-volt)'
                          : 'linear-gradient(90deg, var(--color-volt-deep), var(--color-volt))',
                      }}
                    />
                  </div>
                  <div className="mt-1.5 flex justify-between text-[12px]">
                    <span className="font-semibold text-ink-2">
                      {progressLabel}{' '}
                      <span className="font-normal text-ink-3">/ {targetLabel}</span>
                    </span>
                    <span className="font-bold text-ink-2 tabular-nums">{pct}%</span>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => join.mutate(c.id)}
                  disabled={join.isPending}
                  className="btn btn-ghost mt-3.5 px-4 py-2 text-[13px] text-skyx"
                >
                  Join challenge
                </button>
              )}

              <button
                onClick={() => setOpenStandings(openStandings === c.id ? null : c.id)}
                aria-expanded={openStandings === c.id}
                className="mt-3 block text-[12px] font-semibold text-ink-3 transition-colors hover:text-ink-2"
              >
                {openStandings === c.id ? '▾ Hide standings' : '▸ Standings'}
              </button>
              {openStandings === c.id && <Standings challenge={c} />}
            </div>
          );
        })}
        {data?.length === 0 && (
          <EmptyState
            icon={<TargetIcon size={32} />}
            title="No active challenges"
            hint="New weekly challenges appear every Monday."
          />
        )}
      </div>
    </div>
  );
}
