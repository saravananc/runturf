import type { RunSummary, UserStats } from '@runturf/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { del, get } from '../api/client';
import { formatDistance, formatDuration, formatPace } from '../record/recorder';
import { RunDetailModal } from '../components/RunDetailModal';

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
    <div className="h-full overflow-y-auto p-4 pb-8">
      <h1 className="text-2xl font-bold text-white">History</h1>

      {s && (
        <div className="mt-4 grid grid-cols-3 gap-3">
          <Card label="Total runs" value={String(s.totalRuns)} />
          <Card label="Total distance" value={formatDistance(s.totalDistanceM)} />
          <Card label="Cells owned" value={`${s.cellsOwned} 🚩`} />
        </div>
      )}

      <div className="mt-6 space-y-3">
        {runs.data?.length === 0 && (
          <p className="py-12 text-center text-slate-400">
            No runs yet — head to the Record tab and claim your first turf!
          </p>
        )}
        {runs.data?.map((r) => (
          <button
            key={r.id}
            onClick={() => setOpenRun(r.id)}
            className="block w-full rounded-xl border border-slate-700 bg-slate-800/60 p-4 text-left hover:border-slate-500"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white">
                {new Date(r.startedAt).toLocaleString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              <span className="text-sm text-emerald-300">+{r.xpGained} XP</span>
            </div>
            <div className="mt-2 flex gap-4 text-sm text-slate-300">
              <span>{formatDistance(r.distanceM)}</span>
              <span>{formatDuration(r.durationS)}</span>
              <span>{formatPace(r.avgPaceSPerKm)}</span>
              <span className="ml-auto">
                🚩 {r.cellsCaptured} {r.cellsStolen > 0 && `⚔️ ${r.cellsStolen}`}
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

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3 text-center">
      <div className="text-[10px] tracking-wide text-slate-400 uppercase">{label}</div>
      <div className="mt-1 text-lg font-bold text-white">{value}</div>
    </div>
  );
}
