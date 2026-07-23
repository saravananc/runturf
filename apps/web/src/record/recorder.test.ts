import { haversineM, type RunPointInput } from '@runturf/shared';
import { act, renderHook } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, expect, it } from 'vitest';
import {
  formatDistance,
  formatDuration,
  formatPace,
  useRecorder,
  type PointSource,
} from './recorder';

/** A PointSource whose fixes we emit by hand, with controlled timestamps. */
function controllableSource() {
  let onPoint: (p: RunPointInput) => void = () => {};
  let stopped = false;
  const source: PointSource = {
    start(cb) {
      onPoint = cb;
    },
    stop() {
      stopped = true;
    },
  };
  return {
    source,
    emit: (p: RunPointInput) => onPoint(p),
    get stopped() {
      return stopped;
    },
  };
}

const T0 = 1_700_000_000_000;
const p = (lat: number, dtMs: number, acc = 5): RunPointInput => ({
  lat,
  lng: 80.25,
  t: T0 + dtMs,
  acc,
});

// Render under StrictMode so setState updaters are double-invoked — this is the
// regression guard for the distance double-count bug (fixed by accumulating
// distance outside the updater).
const strict = { wrapper: StrictMode };

describe('useRecorder', () => {
  it('starts idle and transitions to recording', () => {
    const { result } = renderHook(() => useRecorder(), strict);
    expect(result.current.status).toBe('idle');
    const src = controllableSource();
    act(() => result.current.start(src.source));
    expect(result.current.status).toBe('recording');
    expect(result.current.startedAt).toBeInstanceOf(Date);
  });

  it('accumulates distance exactly once per fix (no StrictMode double-count)', () => {
    const { result } = renderHook(() => useRecorder(), strict);
    const src = controllableSource();
    act(() => result.current.start(src.source));

    const a = p(13.05, 0);
    const b = p(13.051, 2000);
    const c = p(13.052, 4000);
    act(() => src.emit(a));
    act(() => src.emit(b));
    act(() => src.emit(c));

    const expected = haversineM(a, b) + haversineM(b, c);
    expect(result.current.distanceM).toBeCloseTo(expected, 6);
    expect(result.current.points).toHaveLength(3);
  });

  it('drops fixes with poor accuracy', () => {
    const { result } = renderHook(() => useRecorder(), strict);
    const src = controllableSource();
    act(() => result.current.start(src.source));
    act(() => src.emit(p(13.05, 0)));
    act(() => src.emit(p(13.06, 2000, 200))); // 200 m accuracy — rejected
    expect(result.current.points).toHaveLength(1);
  });

  it('excludes paused time from moving time', () => {
    const { result } = renderHook(() => useRecorder(), strict);
    const src = controllableSource();
    act(() => result.current.start(src.source));

    act(() => src.emit(p(13.05, 0)));
    act(() => src.emit(p(13.051, 2000))); // 2 s of moving time so far
    act(() => result.current.pause());
    act(() => result.current.resume());
    // First fix after resume is 8 s later in the GPS timebase — all paused.
    act(() => src.emit(p(13.052, 10_000)));

    // Wall span is 10 s; 8 s was paused, so moving time is 2 s.
    expect(result.current.elapsedS).toBe(2);
    expect(result.current.pausedMs).toBe(8000);
  });

  it('finish() returns final pausedMs and stops the source', () => {
    const { result } = renderHook(() => useRecorder(), strict);
    const src = controllableSource();
    act(() => result.current.start(src.source));
    act(() => src.emit(p(13.05, 0)));
    act(() => src.emit(p(13.051, 2000)));
    act(() => result.current.pause());
    act(() => result.current.resume());
    act(() => src.emit(p(13.052, 7000))); // 5 s paused

    let returned: { pausedMs: number } | undefined;
    act(() => {
      returned = result.current.finish();
    });
    expect(returned?.pausedMs).toBe(5000);
    expect(result.current.status).toBe('finished');
    expect(src.stopped).toBe(true);
  });

  it('reset() returns to a clean idle state', () => {
    const { result } = renderHook(() => useRecorder(), strict);
    const src = controllableSource();
    act(() => result.current.start(src.source));
    act(() => src.emit(p(13.05, 0)));
    act(() => src.emit(p(13.06, 2000)));
    act(() => result.current.reset());
    expect(result.current.status).toBe('idle');
    expect(result.current.points).toHaveLength(0);
    expect(result.current.distanceM).toBe(0);
    expect(result.current.pausedMs).toBe(0);
  });
});

describe('formatters', () => {
  it('formatDistance switches to km at 1000 m', () => {
    expect(formatDistance(850)).toBe('850 m');
    expect(formatDistance(1500)).toBe('1.50 km');
  });

  it('formatDuration shows m:ss and h:mm:ss', () => {
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(3725)).toBe('1:02:05');
  });

  it('formatPace renders min/km and handles the empty case', () => {
    expect(formatPace(325)).toBe('5:25 /km');
    expect(formatPace(null)).toBe('–');
    expect(formatPace(Infinity)).toBe('–');
  });
});
