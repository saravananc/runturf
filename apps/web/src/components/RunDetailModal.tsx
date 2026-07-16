import type { RunPointInput, RunSummary } from '@runturf/shared';
import { useQuery } from '@tanstack/react-query';
import maplibregl from 'maplibre-gl';
import { get } from '../api/client';
import { formatDistance, formatDuration, formatPace } from '../record/recorder';
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
      data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } },
    });
    map.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'route',
      paint: { 'line-color': '#34d399', 'line-width': 4 },
    });
    const bounds = coords.reduce(
      (b, c) => b.extend(c),
      new maplibregl.LngLatBounds(coords[0], coords[0]),
    );
    map.fitBounds(bounds, { padding: 40, duration: 0 });
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-full w-full max-w-md flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="h-64 overflow-hidden rounded-t-2xl">
          {run && <MapView onMap={onMap} />}
        </div>
        <div className="p-4">
          {run && (
            <div className="flex gap-4 text-sm text-slate-200">
              <span>{formatDistance(run.distanceM)}</span>
              <span>{formatDuration(run.durationS)}</span>
              <span>{formatPace(run.avgPaceSPerKm)}</span>
              <span className="ml-auto">🚩 {run.cellsCaptured}</span>
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg bg-slate-700 py-2 font-semibold text-white hover:bg-slate-600"
            >
              Close
            </button>
            <button
              onClick={async () => {
                await onDelete(runId);
                onClose();
              }}
              className="rounded-lg bg-red-500/20 px-4 py-2 font-semibold text-red-300 hover:bg-red-500/30"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
