import { pathDistanceM, type RunPointInput } from '@runturf/shared';
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
  elapsedS: number;
  startedAt: Date | null;
}

const MAX_ACCURACY_M = 50; // drop very inaccurate fixes

export function useRecorder() {
  const [state, setState] = useState<RecorderState>({
    status: 'idle',
    points: [],
    distanceM: 0,
    elapsedS: 0,
    startedAt: null,
  });
  const sourceRef = useRef<PointSource | null>(null);
  const pausedRef = useRef(false);

  const onPoint = useCallback((p: RunPointInput) => {
    if (pausedRef.current) return;
    if (p.acc !== undefined && p.acc > MAX_ACCURACY_M) return;
    setState((s) => {
      if (s.status !== 'recording') return s;
      const points = [...s.points, p];
      return {
        ...s,
        points,
        distanceM: pathDistanceM(points),
        elapsedS: points.length > 1 ? Math.round((p.t - points[0].t) / 1000) : 0,
      };
    });
  }, []);

  const start = useCallback(
    (source: PointSource) => {
      sourceRef.current?.stop();
      sourceRef.current = source;
      pausedRef.current = false;
      setState({
        status: 'recording',
        points: [],
        distanceM: 0,
        elapsedS: 0,
        startedAt: new Date(),
      });
      source.start(onPoint);
    },
    [onPoint],
  );

  const pause = useCallback(() => {
    pausedRef.current = true;
    setState((s) => (s.status === 'recording' ? { ...s, status: 'paused' } : s));
  }, []);

  const resume = useCallback(() => {
    pausedRef.current = false;
    setState((s) => (s.status === 'paused' ? { ...s, status: 'recording' } : s));
  }, []);

  const finish = useCallback(() => {
    sourceRef.current?.stop();
    sourceRef.current = null;
    setState((s) => ({ ...s, status: 'finished' }));
  }, []);

  const reset = useCallback(() => {
    sourceRef.current?.stop();
    sourceRef.current = null;
    setState({ status: 'idle', points: [], distanceM: 0, elapsedS: 0, startedAt: null });
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
