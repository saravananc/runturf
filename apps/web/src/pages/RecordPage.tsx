import type { RunReport } from '@runturf/shared';
import maplibregl from 'maplibre-gl';
import { useRef, useState } from 'react';
import { post } from '../api/client';
import { MapView } from '../components/MapView';
import { RunReportModal } from '../components/RunReportModal';
import { FlaskIcon, PauseIcon, PlayIcon, StopIcon } from '../components/icons';
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
      id: 'route-glow',
      type: 'line',
      source: 'route',
      paint: { 'line-color': '#adeb2e', 'line-width': 10, 'line-opacity': 0.18, 'line-blur': 4 },
    });
    m.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'route',
      paint: { 'line-color': '#adeb2e', 'line-width': 4, 'line-opacity': 0.95 },
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
    // finish() returns the final totals; state has not re-rendered yet here.
    const { pausedMs } = rec.finish();
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
        pausedMs,
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
  const active = rec.status === 'recording' || rec.status === 'paused';

  return (
    <div className="relative h-full">
      <MapView onMap={onMap} />

      {/* HUD */}
      <div className="glass absolute top-3 left-1/2 -translate-x-1/2 px-5 py-3">
        <div className="flex items-center gap-6">
          <Hud label="Distance" value={formatDistance(rec.distanceM)} primary />
          <div className="h-9 w-px bg-white/10" />
          <Hud label="Time" value={formatDuration(rec.elapsedS)} />
          <div className="h-9 w-px bg-white/10" />
          <Hud label="Pace" value={formatPace(livePace)} />
        </div>
        {active && (
          <div className="mt-1.5 flex items-center justify-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${
                rec.status === 'recording' ? 'rec-dot bg-ember' : 'bg-gold'
              }`}
            />
            <span className="t-label">
              {rec.status === 'recording' ? 'Recording' : 'Paused'}
            </span>
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="anim-rise absolute top-28 left-1/2 -translate-x-1/2 rounded-xl bg-ember px-4 py-2 text-[13px] font-semibold text-white shadow-lg"
        >
          {error}
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3">
        {!active ? (
          <>
            <button
              onClick={startGps}
              className="btn btn-primary rounded-full px-7 py-3.5 text-base sm:px-9 sm:py-4 sm:text-lg"
            >
              <PlayIcon size={20} /> Start run
            </button>
            <button
              onClick={startSim}
              title="Replay a synthetic route (for desktop testing)"
              className="btn btn-ghost rounded-full p-3.5 sm:p-4"
              aria-label="Simulate a run"
            >
              <FlaskIcon size={20} />
            </button>
          </>
        ) : (
          <>
            {rec.status === 'recording' ? (
              <button
                onClick={rec.pause}
                className="btn rounded-full bg-gold px-6 py-4 text-[#0a0f1e]"
              >
                <PauseIcon size={19} /> Pause
              </button>
            ) : (
              <button onClick={rec.resume} className="btn btn-primary rounded-full px-6 py-4">
                <PlayIcon size={19} /> Resume
              </button>
            )}
            <button
              onClick={finish}
              disabled={submitting}
              className="btn btn-danger rounded-full px-6 py-4"
            >
              <StopIcon size={19} /> {submitting ? 'Saving…' : 'Finish'}
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

function Hud({ label, value, primary }: { label: string; value: string; primary?: boolean }) {
  return (
    <div className="text-center">
      <div className="t-label">{label}</div>
      <div
        className={`font-extrabold tracking-tight tabular-nums ${
          primary ? 'text-[22px] text-volt' : 'text-lg text-ink'
        }`}
      >
        {value}
      </div>
    </div>
  );
}
