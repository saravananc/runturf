import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { UserPublic } from '@runturf/shared';

/** Colored initial avatar, consistent everywhere a user appears. */
export function Avatar({
  user,
  size = 36,
  ring,
}: {
  user: Pick<UserPublic, 'displayName' | 'color'>;
  size?: number;
  ring?: boolean;
}) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-extrabold text-[#0a0f1e] select-none"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        backgroundColor: user.color,
        boxShadow: ring ? `0 0 0 2px var(--color-base), 0 0 0 4px ${user.color}` : undefined,
      }}
      aria-hidden="true"
    >
      {user.displayName.slice(0, 1).toUpperCase()}
    </div>
  );
}

/** Small labeled stat — the workhorse tile. */
export function StatTile({
  label,
  value,
  icon,
  tone,
  className,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: 'volt' | 'gold' | 'grape' | 'ember';
  className?: string;
}) {
  const toneColor =
    tone === 'volt'
      ? 'text-volt'
      : tone === 'gold'
        ? 'text-gold'
        : tone === 'grape'
          ? 'text-grape'
          : tone === 'ember'
            ? 'text-ember'
            : 'text-ink';
  return (
    <div className={`card flex flex-col gap-1 p-3 ${className ?? ''}`}>
      <div className="t-label flex items-center gap-1.5">
        {icon && <span className={toneColor}>{icon}</span>}
        {label}
      </div>
      <div className="t-stat">{value}</div>
    </div>
  );
}

/**
 * Animated SVG progress ring. Fills from 0 to `progress` on mount/update.
 * Center content is passed as children.
 */
export function ProgressRing({
  progress,
  size = 120,
  stroke = 9,
  color = 'var(--color-volt)',
  track = 'rgb(154 167 189 / 0.14)',
  children,
  label,
}: {
  /** 0..1 */
  progress: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));
  const [drawn, setDrawn] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(clamped));
    return () => cancelAnimationFrame(id);
  }, [clamped]);

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `${Math.round(clamped * 100)}% complete`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - drawn)}
          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

/** Number that counts up to its target — for reward moments only. */
export function CountUp({ to, duration = 800, prefix = '' }: { to: number; duration?: number; prefix?: string }) {
  const [value, setValue] = useState(0);
  const start = useRef<number | null>(null);
  useEffect(() => {
    let raf = 0;
    const tick = (t: number) => {
      start.current ??= t;
      const p = Math.min(1, (t - start.current) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(to * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration]);
  return (
    <span>
      {prefix}
      {value}
    </span>
  );
}

export function SectionHeading({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between">
      <h2 className="t-section">{children}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
  return (
    <div className="card flex flex-col items-center gap-2 border-dashed px-6 py-10 text-center">
      <div className="text-ink-3">{icon}</div>
      <p className="t-section">{title}</p>
      {hint && <p className="max-w-60 text-[13px] text-ink-2">{hint}</p>}
    </div>
  );
}
