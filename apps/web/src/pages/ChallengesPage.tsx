import type { Challenge } from '@runturf/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../api/client';
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
    <div className="h-full overflow-y-auto p-4 pb-8">
      <h1 className="text-2xl font-bold text-white">Challenges</h1>
      <p className="mt-1 text-sm text-slate-400">Join weekly goals, earn coins and XP</p>

      <div className="mt-5 space-y-3">
        {data?.map((c) => {
          const pct = Math.min(100, Math.round(((c.progress ?? 0) / c.target) * 100));
          const targetLabel =
            c.metric === 'distance_m' ? formatDistance(c.target) : `${c.target} cells`;
          const progressLabel =
            c.metric === 'distance_m'
              ? formatDistance(c.progress ?? 0)
              : `${Math.round(c.progress ?? 0)} cells`;
          return (
            <div key={c.id} className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-white">
                    {c.title} {c.completed && '✅'}
                  </div>
                  <div className="text-xs text-slate-400">{c.description}</div>
                </div>
                <div className="text-right text-xs whitespace-nowrap text-amber-300">
                  🪙 {c.coinReward} · ✨ {c.xpReward} XP
                </div>
              </div>

              {c.joined ? (
                <div className="mt-3">
                  <div className="h-2 overflow-hidden rounded-full bg-slate-700">
                    <div
                      className={`h-full rounded-full ${c.completed ? 'bg-emerald-400' : 'bg-sky-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {progressLabel} / {targetLabel}
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => join.mutate(c.id)}
                  disabled={join.isPending}
                  className="mt-3 rounded-lg bg-sky-500 px-4 py-1.5 text-sm font-semibold text-slate-900 hover:bg-sky-400 disabled:opacity-50"
                >
                  Join challenge
                </button>
              )}
            </div>
          );
        })}
        {data?.length === 0 && (
          <p className="py-12 text-center text-slate-400">No active challenges right now.</p>
        )}
      </div>
    </div>
  );
}
