import type { Challenge } from '@runturf/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../api/client';
import { CoinIcon, TargetIcon } from '../components/icons';
import { EmptyState } from '../components/ui';
import { formatDistance } from '../record/recorder';

export function ChallengesPage() {
  const qc = useQueryClient();
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
                  <div className="text-[14.5px] font-bold text-ink">
                    {c.title}
                    {c.completed && (
                      <span className="ml-2 rounded-full bg-volt/15 px-2 py-0.5 text-[10.5px] font-extrabold text-volt">
                        DONE
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[12px] text-ink-2">{c.description}</div>
                </div>
                <div className="shrink-0 text-right text-[11.5px] font-bold whitespace-nowrap">
                  <span className="inline-flex items-center gap-1 text-gold">
                    <CoinIcon size={13} /> {c.coinReward}
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
                  <div className="mt-1.5 flex justify-between text-[11.5px]">
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
                  className="btn btn-ghost mt-3.5 px-4 py-2 text-[12.5px] text-skyx"
                >
                  Join challenge
                </button>
              )}
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
