import type { RunReport } from '@runturf/shared';
import maplibregl from 'maplibre-gl';
import { useRef, useState } from 'react';
import { post } from '../api/client';
import { MapView } from '../components/MapView';
import { RunReportModal } from '../components/RunReportModal';
import {
  formatDistance,
  formatDuration,
  formatPace,
  gpsSource,
  useRecorder,
} from '../record/recorder';
import { DEFAULT_SIM_START, simulatorSource } from '../record/simulator';

export function RecordPage() {
  const rec = useRecorder();
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [report, setReport] = useState<RunReport | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Keep the route line + camera in sync with recorded points.
  const last = rec.points[rec.points.length - 1];
  const map = mapRef.current;
  if (map && map.isStyleLoaded() && rec.points.length > 0) {
    const src = map.getSource('route') as maplibregl.GeoJSONSource | undefined;
    src?.setData({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: rec.points.map((p) => [p.lng, p.lat]) },
    });
    if (rec.status === 'recording' && last) {
      map.easeTo({ center: [last.lng, last.lat], duration: 300 });
    }
  }

  function onMap(m: maplibregl.Map) {
    mapRef.current = m;
    m.addSource('route', {
      type: 'geojson',
      data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
    });
    m.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'route',
      paint: { 'line-color': '#34d399', 'line-width': 4, 'line-opacity': 0.9 },
    });
    navigator.geolocation?.getCurrentPosition(
      (pos) => m.jumpTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 16 }),
      () => m.jumpTo({ center: [DEFAULT_SIM_START.lng, DEFAULT_SIM_START.lat], zoom: 16 }),
      { timeout: 3000 },
    );
    return () => {
      mapRef.current = null;
    };
  }

  function startGps() {
    setError('');
    rec.start(gpsSource());
  }

  function startSim() {
    setError('');
    const center = mapRef.current?.getCenter();
    rec.start(
      simulatorSource({
        start: center ? { lat: center.lat, lng: center.lng } : DEFAULT_SIM_START,
        distanceM: 1500,
      }),
    );
  }

  async function finish() {
    rec.finish();
    if (rec.points.length < 2 || !rec.startedAt) {
      rec.reset();
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const rep = await post<RunReport>('/runs', {
        startedAt: rec.startedAt.toISOString(),
        points: rec.points,
      });
      setReport(rep);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save run');
    } finally {
      setSubmitting(false);
    }
  }

  const livePace =
    rec.distanceM >= 50 && rec.elapsedS > 0 ? rec.elapsedS / (rec.distanceM / 1000) : null;

  return (
    <div className="relative h-full">
      <MapView onMap={onMap} />

      {/* HUD */}
      <div className="pointer-events-none absolute top-3 left-1/2 flex -translate-x-1/2 gap-3 rounded-2xl bg-slate-900/85 px-5 py-3 backdrop-blur">
        <Hud label="Distance" value={formatDistance(rec.distanceM)} />
        <Hud label="Time" value={formatDuration(rec.elapsedS)} />
        <Hud label="Pace" value={formatPace(livePace)} />
      </div>

      {error && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 rounded-lg bg-red-500/90 px-4 py-2 text-sm text-white">
          {error}
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3">
        {rec.status === 'idle' || rec.status === 'finished' ? (
          <>
            <button
              onClick={startGps}
              className="rounded-full bg-emerald-500 px-8 py-4 text-lg font-bold text-slate-900 shadow-lg hover:bg-emerald-400"
            >
              ▶ Start run
            </button>
            <button
              onClick={startSim}
              title="Replay a synthetic route (for desktop testing)"
              className="rounded-full bg-slate-700 px-4 py-4 text-sm font-semibold text-slate-200 shadow-lg hover:bg-slate-600"
            >
              🧪 Simulate
            </button>
          </>
        ) : (
          <>
            {rec.status === 'recording' ? (
              <button
                onClick={rec.pause}
                className="rounded-full bg-amber-400 px-6 py-4 font-bold text-slate-900 shadow-lg"
              >
                ⏸ Pause
              </button>
            ) : (
              <button
                onClick={rec.resume}
                className="rounded-full bg-emerald-500 px-6 py-4 font-bold text-slate-900 shadow-lg"
              >
                ▶ Resume
              </button>
            )}
            <button
              onClick={finish}
              disabled={submitting}
              className="rounded-full bg-red-500 px-6 py-4 font-bold text-white shadow-lg disabled:opacity-50"
            >
              {submitting ? 'Saving…' : '⏹ Finish'}
            </button>
          </>
        )}
      </div>

      {report && (
        <RunReportModal
          report={report}
          onClose={() => {
            setReport(null);
            rec.reset();
          }}
        />
      )}
    </div>
  );
}

function Hud({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-[10px] tracking-wide text-slate-400 uppercase">{label}</div>
      <div className="text-lg font-bold text-white tabular-nums">{value}</div>
    </div>
  );
}
