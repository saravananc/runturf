import { haversineM, type RunPointInput } from '@runturf/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

export type RecorderStatus = 'idle' | 'recording' | 'paused' | 'finished';

export interface PointSource {
  start(onPoint: (p: RunPointInput) => void): void;
  stop(): void;
}

/** Real GPS via the browser Geolocation API. */
export function gpsSource(): PointSource {
  let watchId: number | null = null;
  return {
    start(onPoint) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          onPoint({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            t: pos.timestamp,
            acc: pos.coords.accuracy,
          });
        },
        (err) => console.warn('GPS error', err),
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
      );
    },
    stop() {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      watchId = null;
    },
  };
}

export interface RecorderState {
  status: RecorderStatus;
  points: RunPointInput[];
  distanceM: number;
  /** Moving time in seconds — wall-clock minus time spent paused. */
  elapsedS: number;
  startedAt: Date | null;
  /** Total milliseconds spent paused, excluded from elapsed/pace. */
  pausedMs: number;
}

const MAX_ACCURACY_M = 50; // drop very inaccurate fixes

const INITIAL: RecorderState = {
  status: 'idle',
  points: [],
  distanceM: 0,
  elapsedS: 0,
  startedAt: null,
  pausedMs: 0,
};

export function useRecorder() {
  const [state, setState] = useState<RecorderState>(INITIAL);
  const sourceRef = useRef<PointSource | null>(null);
  const pausedRef = useRef(false);
  /**
   * Timestamp (in the point source's own timebase) of the last fix before the
   * current pause. Measuring the pause as the gap between that fix and the first
   * fix after resuming keeps elapsed time correct for real GPS *and* for the
   * accelerated simulator, where wall-clock and point time differ.
   */
  const pauseAnchorRef = useRef<number | null>(null);
  const awaitingResumeRef = useRef(false);
  /** Mirror of state.pausedMs, readable synchronously by finish(). */
  const pausedMsRef = useRef(0);
  /** Running distance so we never re-walk the whole path on each fix. */
  const distanceRef = useRef(0);
  /** Last accepted fix, kept outside state so the updater stays pure. */
  const lastPointRef = useRef<RunPointInput | null>(null);

  const onPoint = useCallback((p: RunPointInput) => {
    if (pausedRef.current) return;
    if (p.acc !== undefined && p.acc > MAX_ACCURACY_M) return;

    // First fix after a resume: the gap since the pre-pause fix was paused time.
    let addedPause = 0;
    if (awaitingResumeRef.current) {
      awaitingResumeRef.current = false;
      if (pauseAnchorRef.current !== null) {
        addedPause = Math.max(0, p.t - pauseAnchorRef.current);
        pausedMsRef.current += addedPause;
      }
      pauseAnchorRef.current = null;
    }

    // Incremental distance (was O(n) per fix, O(n²) per run). Accumulated here
    // rather than inside the updater, which StrictMode invokes twice.
    const prev = lastPointRef.current;
    if (prev) distanceRef.current += haversineM(prev, p);
    lastPointRef.current = p;
    const distanceM = distanceRef.current;

    setState((s) => {
      if (s.status !== 'recording') return s;
      const points = [...s.points, p];
      const pausedMs = s.pausedMs + addedPause;
      return {
        ...s,
        points,
        pausedMs,
        distanceM,
        // Moving time: span since the first fix, minus time spent paused.
        elapsedS:
          points.length > 1 ? Math.max(0, Math.round((p.t - points[0].t - pausedMs) / 1000)) : 0,
      };
    });
  }, []);

  const start = useCallback(
    (source: PointSource) => {
      sourceRef.current?.stop();
      sourceRef.current = source;
      pausedRef.current = false;
      pauseAnchorRef.current = null;
      awaitingResumeRef.current = false;
      pausedMsRef.current = 0;
      distanceRef.current = 0;
      lastPointRef.current = null;
      setState({ ...INITIAL, status: 'recording', startedAt: new Date() });
      source.start(onPoint);
    },
    [onPoint],
  );

  const pause = useCallback(() => {
    if (pausedRef.current) return;
    pausedRef.current = true;
    setState((s) => {
      if (s.status !== 'recording') return s;
      // Anchor on the last recorded fix; the gap to the next one is paused time.
      pauseAnchorRef.current = s.points[s.points.length - 1]?.t ?? null;
      return { ...s, status: 'paused' };
    });
  }, []);

  const resume = useCallback(() => {
    if (!pausedRef.current) return;
    pausedRef.current = false;
    awaitingResumeRef.current = true;
    setState((s) => (s.status === 'paused' ? { ...s, status: 'recording' } : s));
  }, []);

  /**
   * Stops recording and returns the final totals. Callers must use the returned
   * value rather than reading state, which has not re-rendered yet at this point.
   */
  const finish = useCallback((): { pausedMs: number } => {
    sourceRef.current?.stop();
    sourceRef.current = null;
    // A trailing pause needs no adjustment: the run's span ends at the last
    // recorded fix, so time after it was never counted in the first place.
    pausedRef.current = false;
    pauseAnchorRef.current = null;
    awaitingResumeRef.current = false;
    const finalPausedMs = pausedMsRef.current;
    setState((s) => ({ ...s, status: 'finished' }));
    return { pausedMs: finalPausedMs };
  }, []);

  const reset = useCallback(() => {
    sourceRef.current?.stop();
    sourceRef.current = null;
    pausedRef.current = false;
    pauseAnchorRef.current = null;
    awaitingResumeRef.current = false;
    pausedMsRef.current = 0;
    distanceRef.current = 0;
    lastPointRef.current = null;
    setState(INITIAL);
  }, []);

  useEffect(() => () => sourceRef.current?.stop(), []);

  return { ...state, start, pause, resume, finish, reset };
}

export function formatPace(sPerKm: number | null): string {
  if (!sPerKm || !Number.isFinite(sPerKm)) return '–';
  const m = Math.floor(sPerKm / 60);
  const s = Math.round(sPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')} /km`;
}

export function formatDuration(totalS: number): string {
  const h = Math.floor(totalS / 3600);
  const m = Math.floor((totalS % 3600) / 60);
  const s = totalS % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

export function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
}
