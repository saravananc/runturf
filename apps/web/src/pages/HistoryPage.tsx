import type { RunQuery, RunSort, RunReport, RunSummary, UserStats } from '@runturf/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { del, get, post } from '../api/client';
import {
  DownloadIcon,
  FlagIcon,
  HistoryIcon,
  MapIcon,
  RouteIcon,
  SwordsIcon,
} from '../components/icons';
import { RunDetailModal } from '../components/RunDetailModal';
import { RunReportModal } from '../components/RunReportModal';
import { EmptyState, StatTile } from '../components/ui';
import { WeeklyChart } from '../components/WeeklyChart';
import { formatDistance, formatDuration, formatPace } from '../record/recorder';

/** Serialises a filter into a query string, dropping empty fields. */
function toQueryString(q: RunQuery): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v !== undefined && v !== '') params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

const EMPTY_FILTER: RunQuery = { sort: 'date', order: 'desc' };

export function HistoryPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<RunQuery>(EMPTY_FILTER);
  const [showFilters, setShowFilters] = useState(false);
  // The filter is part of the key, so changing it refetches (and caches per filter).
  const runs = useQuery({
    queryKey: ['runs', filter],
    queryFn: () => get<RunSummary[]>(`/runs${toQueryString(filter)}`),
  });
  const isFiltered =
    !!filter.from || !!filter.to || filter.minDistanceM !== undefined || filter.maxDistanceM !== undefined;
  const stats = useQuery({
    queryKey: ['stats'],
    queryFn: () => get<UserStats>('/users/me/stats'),
  });
  const [openRun, setOpenRun] = useState<string | null>(null);
  const [imported, setImported] = useState<RunReport | null>(null);
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onDelete(id: string) {
    await del(`/runs/${id}`);
    qc.invalidateQueries({ queryKey: ['runs'] });
    qc.invalidateQueries({ queryKey: ['stats'] });
  }

  async function onImportFile(file: File) {
    setImporting(true);
    setImportError('');
    try {
      const report = await post<RunReport>('/runs/import', { gpx: await file.text() });
      setImported(report);
      qc.invalidateQueries({ queryKey: ['runs'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Could not import that file');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = ''; // allow re-picking the same file
    }
  }

  const s = stats.data;

  return (
    <div className="mx-auto h-full w-full max-w-lg overflow-y-auto p-4 pb-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="t-title text-ink">History</h1>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={importing}
          className="btn btn-ghost px-3.5 py-2 text-[13px] text-skyx"
        >
          <DownloadIcon size={16} className="rotate-180" />
          {importing ? 'Importing…' : 'Import GPX'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".gpx,application/gpx+xml,application/xml,text/xml"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImportFile(file);
          }}
        />
      </div>

      {importError && (
        <p role="alert" className="anim-rise mt-2 text-[13px] font-medium text-ember">
          {importError}
        </p>
      )}

      {s && (
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <StatTile label="Runs" value={s.totalRuns} icon={<RouteIcon size={14} />} tone="volt" />
          <StatTile
            label="Distance"
            value={formatDistance(s.totalDistanceM)}
            icon={<MapIcon size={14} />}
            tone="volt"
          />
          <StatTile
            label="Turf"
            value={s.cellsOwned}
            icon={<FlagIcon size={14} />}
            tone="volt"
          />
        </div>
      )}

      {runs.data && runs.data.length > 0 && !isFiltered && (
        <div className="mt-3">
          <WeeklyChart runs={runs.data} />
        </div>
      )}

      <div className="mt-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            className="btn btn-ghost px-3.5 py-2 text-[13px]"
          >
            Filters{isFiltered ? ' •' : ''}
          </button>
          <select
            aria-label="Sort runs"
            value={`${filter.sort ?? 'date'}:${filter.order ?? 'desc'}`}
            onChange={(e) => {
              const [sort, order] = e.target.value.split(':') as [RunSort, 'asc' | 'desc'];
              setFilter((f) => ({ ...f, sort, order }));
            }}
            className="input ml-auto w-auto py-2 text-[13px]"
          >
            <option value="date:desc">Newest first</option>
            <option value="date:asc">Oldest first</option>
            <option value="distance:desc">Longest</option>
            <option value="distance:asc">Shortest</option>
            <option value="duration:desc">Slowest (time)</option>
            <option value="pace:asc">Fastest pace</option>
          </select>
        </div>

        {showFilters && (
          <div className="card anim-rise mt-2.5 space-y-3 p-4">
            <div className="grid grid-cols-2 gap-2.5">
              <label className="block">
                <span className="t-label">From</span>
                <input
                  type="date"
                  value={filter.from ?? ''}
                  onChange={(e) => setFilter((f) => ({ ...f, from: e.target.value || undefined }))}
                  className="input mt-1 w-full"
                />
              </label>
              <label className="block">
                <span className="t-label">To</span>
                <input
                  type="date"
                  value={filter.to ?? ''}
                  onChange={(e) => setFilter((f) => ({ ...f, to: e.target.value || undefined }))}
                  className="input mt-1 w-full"
                />
              </label>
              <label className="block">
                <span className="t-label">Min km</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={filter.minDistanceM !== undefined ? filter.minDistanceM / 1000 : ''}
                  onChange={(e) =>
                    setFilter((f) => ({
                      ...f,
                      minDistanceM: e.target.value ? Number(e.target.value) * 1000 : undefined,
                    }))
                  }
                  className="input mt-1 w-full"
                />
              </label>
              <label className="block">
                <span className="t-label">Max km</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={filter.maxDistanceM !== undefined ? filter.maxDistanceM / 1000 : ''}
                  onChange={(e) =>
                    setFilter((f) => ({
                      ...f,
                      maxDistanceM: e.target.value ? Number(e.target.value) * 1000 : undefined,
                    }))
                  }
                  className="input mt-1 w-full"
                />
              </label>
            </div>
            <button
              onClick={() => setFilter(EMPTY_FILTER)}
              disabled={!isFiltered}
              className="btn btn-ghost w-full py-2 text-[13px]"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      <div className="mt-5 space-y-2.5">
        {runs.data?.length === 0 &&
          (isFiltered ? (
            <EmptyState
              icon={<HistoryIcon size={32} />}
              title="No runs match"
              hint="Try widening the date range or distance."
            />
          ) : (
            <EmptyState
              icon={<HistoryIcon size={32} />}
              title="No runs yet"
              hint="Head to the Record tab and claim your first turf."
            />
          ))}
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
              <span className="text-[13px] font-bold text-volt">+{r.xpGained} XP</span>
            </div>
            <div className="mt-1.5 flex items-center gap-3 text-[13px] text-ink-2">
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
                  <FlagIcon size={14} /> {r.cellsCaptured}
                </span>
                {r.cellsStolen > 0 && (
                  <span className="inline-flex items-center gap-1 text-ember">
                    <SwordsIcon size={14} /> {r.cellsStolen}
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

      {/* An imported run earns rewards like any other, so show the same report. */}
      {imported && <RunReportModal report={imported} onClose={() => setImported(null)} />}
    </div>
  );
}
