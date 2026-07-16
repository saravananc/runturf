import type { RunPointInput } from '@runturf/shared';
import type { PointSource } from './recorder';

/**
 * Replays a synthetic run for desktop testing: a smooth random loop starting
 * at `start`, at a realistic running pace, delivered at `speedup`× real time.
 * The emitted timestamps are simulated run time, so pace/distance are plausible.
 */
export function simulatorSource(opts: {
  start: { lat: number; lng: number };
  /** target distance in meters (default ~1500) */
  distanceM?: number;
  /** how much faster than real time points arrive (default 15×) */
  speedup?: number;
}): PointSource {
  const targetM = opts.distanceM ?? 1500;
  const speedup = opts.speedup ?? 15;
  const SPEED_MS = 3.1; // ~5:22 /km
  const TICK_SIM_S = 2; // one GPS fix every 2 simulated seconds
  let timer: ReturnType<typeof setInterval> | null = null;

  return {
    start(onPoint) {
      let lat = opts.start.lat;
      let lng = opts.start.lng;
      let heading = Math.random() * 2 * Math.PI;
      let traveled = 0;
      let simT = Date.now();
      const totalTicks = Math.ceil(targetM / (SPEED_MS * TICK_SIM_S));
      let tick = 0;

      // Curve gently; bias turns so the route loops back toward the start.
      onPoint({ lat, lng, t: simT, acc: 5 });
      timer = setInterval(
        () => {
          tick++;
          const progress = tick / totalTicks;
          // steer: gentle wobble + increasing pull back to start in second half
          heading += (Math.random() - 0.5) * 0.35;
          if (progress > 0.5) {
            const backBearing = Math.atan2(opts.start.lng - lng, opts.start.lat - lat);
            const pull = (progress - 0.5) * 0.5;
            heading += normalizeAngle(backBearing - heading) * pull;
          }
          const stepM = SPEED_MS * TICK_SIM_S * (0.9 + Math.random() * 0.2);
          const dLat = (stepM * Math.cos(heading)) / 111_320;
          const dLng = (stepM * Math.sin(heading)) / (111_320 * Math.cos((lat * Math.PI) / 180));
          lat += dLat;
          lng += dLng;
          traveled += stepM;
          simT += TICK_SIM_S * 1000;
          const p: RunPointInput = { lat, lng, t: simT, acc: 4 + Math.random() * 6 };
          onPoint(p);
          if (traveled >= targetM && timer) {
            clearInterval(timer);
            timer = null;
          }
        },
        (TICK_SIM_S * 1000) / speedup,
      );
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}

function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

/** Default simulator start: Chennai Marina Beach area. Used when GPS is unavailable. */
export const DEFAULT_SIM_START = { lat: 13.0475, lng: 80.2824 };
