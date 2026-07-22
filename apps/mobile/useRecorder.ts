import { haversineM, type RunPointInput } from '@runturf/shared';
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';

export type RecorderStatus = 'idle' | 'recording' | 'paused' | 'finished';

export interface RecorderState {
  status: RecorderStatus;
  points: RunPointInput[];
  distanceM: number;
  /** Moving time in seconds — excludes time spent paused. */
  elapsedS: number;
  startedAt: Date | null;
  pausedMs: number;
}

const MAX_ACCURACY_M = 50;

const INITIAL: RecorderState = {
  status: 'idle',
  points: [],
  distanceM: 0,
  elapsedS: 0,
  startedAt: null,
  pausedMs: 0,
};

/**
 * GPS run recorder. Mirrors the web recorder, including pause handling:
 * paused time is measured as the gap between the last fix before pausing and
 * the first fix after resuming, so it is correct in the GPS timebase.
 */
export function useRecorder() {
  const [state, setState] = useState<RecorderState>(INITIAL);
  const subRef = useRef<Location.LocationSubscription | null>(null);
  const pausedRef = useRef(false);
  const pauseAnchorRef = useRef<number | null>(null);
  const awaitingResumeRef = useRef(false);
  const pausedMsRef = useRef(0);
  const distanceRef = useRef(0);
  const lastPointRef = useRef<RunPointInput | null>(null);

  const onPoint = useCallback((p: RunPointInput) => {
    if (pausedRef.current) return;
    if (p.acc !== undefined && p.acc > MAX_ACCURACY_M) return;

    let addedPause = 0;
    if (awaitingResumeRef.current) {
      awaitingResumeRef.current = false;
      if (pauseAnchorRef.current !== null) {
        addedPause = Math.max(0, p.t - pauseAnchorRef.current);
        pausedMsRef.current += addedPause;
      }
      pauseAnchorRef.current = null;
    }

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
        elapsedS:
          points.length > 1 ? Math.max(0, Math.round((p.t - points[0].t - pausedMs) / 1000)) : 0,
      };
    });
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return false;

    subRef.current?.remove();
    pausedRef.current = false;
    pauseAnchorRef.current = null;
    awaitingResumeRef.current = false;
    pausedMsRef.current = 0;
    distanceRef.current = 0;
    lastPointRef.current = null;
    setState({ ...INITIAL, status: 'recording', startedAt: new Date() });

    subRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 2000, distanceInterval: 5 },
      (pos) =>
        onPoint({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          t: pos.timestamp,
          acc: pos.coords.accuracy ?? undefined,
        }),
    );
    return true;
  }, [onPoint]);

  const pause = useCallback(() => {
    if (pausedRef.current) return;
    pausedRef.current = true;
    setState((s) => {
      if (s.status !== 'recording') return s;
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

  /** Stops recording and returns final totals (state has not re-rendered yet). */
  const finish = useCallback((): { pausedMs: number } => {
    subRef.current?.remove();
    subRef.current = null;
    pausedRef.current = false;
    pauseAnchorRef.current = null;
    awaitingResumeRef.current = false;
    setState((s) => ({ ...s, status: 'finished' }));
    return { pausedMs: pausedMsRef.current };
  }, []);

  const reset = useCallback(() => {
    subRef.current?.remove();
    subRef.current = null;
    pausedRef.current = false;
    pauseAnchorRef.current = null;
    awaitingResumeRef.current = false;
    pausedMsRef.current = 0;
    distanceRef.current = 0;
    lastPointRef.current = null;
    setState(INITIAL);
  }, []);

  useEffect(() => () => subRef.current?.remove(), []);

  return { ...state, start, pause, resume, finish, reset };
}
