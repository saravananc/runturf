import type { RunSummary, UserStats } from '@runturf/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { del, get } from '../api/client';
import { FlagIcon, HistoryIcon, RouteIcon, SwordsIcon } from '../components/icons';
import { RunDetailModal } from '../components/RunDetailModal';
import { EmptyState, StatTile } from '../components/ui';
import { WeeklyChart } from '../components/WeeklyChart';
import { formatDistance, formatDuration, formatPace } from '../record/recorder';

export function HistoryPage() {
  const qc = useQueryClient();
  const runs = useQuery({ queryKey: ['runs'], queryFn: () => get<RunSummary[]>('/runs') });
  const stats = useQuery({
    queryKey: ['stats'],
    queryFn: () => get<UserStats>('/users/me/stats'),
  });
  const [openRun, setOpenRun] = useState<string | null>(null);

  async function onDelete(id: string) {
    await del(`/runs/${id}`);
    qc.invalidateQueries({ queryKey: ['runs'] });
    qc.invalidateQueries({ queryKey: ['stats'] });
  }

  const s = stats.data;

  return (
    <div className="mx-auto h-full w-full max-w-lg overflow-y-auto p-4 pb-8">
      <h1 className="t-title text-ink">History</h1>

      {s && (
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <StatTile label="Runs" value={s.totalRuns} icon={<RouteIcon size={13} />} tone="volt" />
          <StatTile label="Distance" value={formatDistance(s.totalDistanceM)} tone="volt" />
          <StatTile
            label="Turf"
            value={s.cellsOwned}
            icon={<FlagIcon size={13} />}
            tone="volt"
          />
        </div>
      )}

      {runs.data && runs.data.length > 0 && (
        <div className="mt-3">
          <WeeklyChart runs={runs.data} />
        </div>
      )}

      <div className="mt-5 space-y-2.5">
        {runs.data?.length === 0 && (
          <EmptyState
            icon={<HistoryIcon size={32} />}
            title="No runs yet"
            hint="Head to the Record tab and claim your first turf."
          />
        )}
        {runs.data?.map((r, i) => (
          <button
            key={r.id}
            onClick={() => setOpenRun(r.id)}
            className="card anim-rise block w-full p-4 text-left transition-colors hover:bg-elev2"
            style={{ animationDelay: `${Math.min(i * 0.04, 0.3)}s` }}
          >
            <div className="flex items-baseline justify-between">
              <span className="text-[19px] font-extrabold tracking-tight text-ink tabular-nums">
                {formatDistance(r.distanceM)}
              </span>
              <span className="text-[12.5px] font-bold text-volt">+{r.xpGained} XP</span>
            </div>
            <div className="mt-1.5 flex items-center gap-3 text-[12.5px] text-ink-2">
              <span>
                {new Date(r.startedAt).toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              <span className="text-ink-3">·</span>
              <span>{formatDuration(r.durationS)}</span>
              <span className="text-ink-3">·</span>
              <span>{formatPace(r.avgPaceSPerKm)}</span>
              <span className="ml-auto inline-flex items-center gap-2 font-semibold">
                <span className="inline-flex items-center gap-1 text-volt">
                  <FlagIcon size={13} /> {r.cellsCaptured}
                </span>
                {r.cellsStolen > 0 && (
                  <span className="inline-flex items-center gap-1 text-ember">
                    <SwordsIcon size={13} /> {r.cellsStolen}
                  </span>
                )}
              </span>
            </div>
          </button>
        ))}
      </div>

      {openRun && (
        <RunDetailModal runId={openRun} onClose={() => setOpenRun(null)} onDelete={onDelete} />
      )}
    </div>
  );
}
