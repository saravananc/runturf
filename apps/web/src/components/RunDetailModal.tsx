import type { RunPointInput, RunSummary } from '@runturf/shared';
import { useQuery } from '@tanstack/react-query';
import maplibregl from 'maplibre-gl';
import { get, getBlob } from '../api/client';
import { formatDistance, formatDuration, formatPace } from '../record/recorder';
import { DownloadIcon, FlagIcon } from './icons';
import { MapView } from './MapView';

type RunDetail = RunSummary & { points: RunPointInput[] };

export function RunDetailModal({
  runId,
  onClose,
  onDelete,
}: {
  runId: string;
  onClose: () => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const { data: run } = useQuery({
    queryKey: ['run', runId],
    queryFn: () => get<RunDetail>(`/runs/${runId}`),
  });

  function onMap(map: maplibregl.Map) {
    if (!run || run.points.length === 0) return;
    const coords = run.points.map((p) => [p.lng, p.lat] as [number, number]);
    map.addSource('route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: coords },
      },
    });
    map.addLayer({
      id: 'route-glow',
      type: 'line',
      source: 'route',
      paint: { 'line-color': '#adeb2e', 'line-width': 10, 'line-opacity': 0.18, 'line-blur': 4 },
    });
    map.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'route',
      paint: { 'line-color': '#adeb2e', 'line-width': 4 },
    });
    const bounds = coords.reduce(
      (b, c) => b.extend(c),
      new maplibregl.LngLatBounds(coords[0], coords[0]),
    );
    map.fitBounds(bounds, { padding: 40, duration: 0 });
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-base/80 p-4 backdrop-blur-sm">
      <div className="card-raised anim-pop flex max-h-full w-full max-w-md flex-col overflow-hidden">
        <div className="h-64 shrink-0">{run && <MapView onMap={onMap} />}</div>
        <div className="min-h-0 overflow-y-auto p-4">
          {run && (
            <div className="flex items-baseline gap-4">
              <span className="text-[22px] font-extrabold tracking-tight text-ink tabular-nums">
                {formatDistance(run.distanceM)}
              </span>
              <span className="text-[13px] text-ink-2">{formatDuration(run.durationS)}</span>
              <span className="text-[13px] text-ink-2">{formatPace(run.avgPaceSPerKm)}</span>
              <span className="ml-auto inline-flex items-center gap-1 text-[13px] font-bold text-volt">
                <FlagIcon size={14} /> {run.cellsCaptured}
              </span>
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <button onClick={onClose} className="btn btn-ghost flex-1 py-2.5">
              Close
            </button>
            <button
              onClick={() => downloadGpx(runId)}
              className="btn btn-ghost px-4 py-2.5 text-skyx"
              aria-label="Download GPX"
            >
              <DownloadIcon size={18} /> GPX
            </button>
            <button
              onClick={async () => {
                await onDelete(runId);
                onClose();
              }}
              className="btn btn-danger-soft px-4 py-2.5"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

async function downloadGpx(runId: string) {
  const blob = await getBlob(`/runs/${runId}/gpx`);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `runturf-${runId.slice(0, 8)}.gpx`;
  a.click();
  URL.revokeObjectURL(url);
}
