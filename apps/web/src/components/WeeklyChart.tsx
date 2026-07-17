import type { RunSummary } from '@runturf/shared';
import { useMemo, useState } from 'react';
import { formatDistance } from '../record/recorder';

const DAY_MS = 86_400_000;

/**
 * Last-7-days distance bar chart. Single series (volt), per-bar hover tooltip,
 * direct label on the max day only, recessive baseline.
 */
export function WeeklyChart({ runs }: { runs: RunSummary[] }) {
  const days = useMemo(() => buildDays(runs), [runs]);
  const [hover, setHover] = useState<number | null>(null);

  const max = Math.max(...days.map((d) => d.distanceM), 1);
  const W = 320;
  const H = 120;
  const plotH = 86;
  const barMaxH = plotH - 18; // headroom so the direct label never clips
  const gap = 10;
  const barW = (W - gap * (days.length - 1)) / days.length;
  const maxIdx = days.reduce((best, d, i) => (d.distanceM > days[best].distanceM ? i : best), 0);
  const total = days.reduce((s, d) => s + d.distanceM, 0);

  return (
    <div className="card p-4">
      <div className="mb-1 flex items-baseline justify-between">
        <h2 className="t-section">Last 7 days</h2>
        <span className="text-[13px] font-semibold text-ink-2">{formatDistance(total)}</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`Distance per day over the last 7 days, total ${formatDistance(total)}`}
      >
        {days.map((d, i) => {
          const h = d.distanceM === 0 ? 3 : Math.max(6, (d.distanceM / max) * barMaxH);
          const x = i * (barW + gap);
          const y = plotH - h;
          const active = hover === i;
          const showLabel = d.distanceM > 0 && (i === maxIdx || active);
          return (
            <g key={d.key}>
              {/* generous hit target */}
              <rect
                x={x - gap / 2}
                y={0}
                width={barW + gap}
                height={H}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={4}
                fill={
                  d.distanceM === 0
                    ? 'rgb(154 167 189 / 0.15)'
                    : active
                      ? 'var(--color-volt)'
                      : 'var(--color-volt-deep)'
                }
                style={{ transition: 'fill 0.15s ease' }}
                pointerEvents="none"
              />
              {showLabel && (
                <text
                  x={x + barW / 2}
                  y={y - 7}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="700"
                  fill="var(--color-ink)"
                  pointerEvents="none"
                >
                  {formatDistance(d.distanceM)}
                </text>
              )}
              <text
                x={x + barW / 2}
                y={H - 6}
                textAnchor="middle"
                fontSize="10.5"
                fontWeight={d.isToday ? 750 : 500}
                fill={d.isToday ? 'var(--color-ink)' : 'var(--color-ink-3)'}
                pointerEvents="none"
              >
                {d.label}
              </text>
            </g>
          );
        })}
        <line
          x1={0}
          y1={plotH + 0.5}
          x2={W}
          y2={plotH + 0.5}
          stroke="rgb(154 167 189 / 0.2)"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}

function buildDays(runs: RunSummary[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today.getTime() - i * DAY_MS);
    days.push({
      key: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString(undefined, { weekday: 'narrow' }),
      isToday: i === 0,
      start: date.getTime(),
      distanceM: 0,
    });
  }
  for (const run of runs) {
    const t = new Date(run.startedAt).getTime();
    const day = days.find((d) => t >= d.start && t < d.start + DAY_MS);
    if (day) day.distanceM += run.distanceM;
  }
  return days;
}
