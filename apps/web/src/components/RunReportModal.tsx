import { levelProgress, type RunReport } from '@runturf/shared';
import { formatDistance, formatDuration, formatPace } from '../record/recorder';
import { CoinIcon, FlagIcon, FlameIcon, SwordsIcon } from './icons';
import { CountUp, ProgressRing } from './ui';

export function RunReportModal({ report, onClose }: { report: RunReport; onClose: () => void }) {
  const { run, stats } = report;
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-base/80 p-4 backdrop-blur-sm">
      <div className="card-raised anim-pop max-h-full w-full max-w-sm overflow-y-auto p-6">
        <p className="t-label text-center">Run complete</p>

        {/* Hero: distance inside the ring; ring shows progress toward next level */}
        <div className="mt-4 flex justify-center">
          <ProgressRing
            progress={levelProgress(stats.xp).progress}
            size={150}
            stroke={10}
            label={`Level ${stats.level} progress`}
          >
            <span className="t-display text-[26px] text-ink">{formatDistance(run.distanceM)}</span>
            <span className="mt-0.5 text-[12px] font-semibold text-ink-2">
              Lv {stats.level} · <CountUp to={report.xpGained} prefix="+" /> XP
            </span>
          </ProgressRing>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <Cell label="Time" value={formatDuration(run.durationS)} delay={0.1} />
          <Cell label="Pace" value={formatPace(run.avgPaceSPerKm)} delay={0.18} />
          <Cell
            label="Coins"
            value={
              <span className="inline-flex items-center gap-1 text-gold">
                <CoinIcon size={14} /> +{report.coinsGained}
              </span>
            }
            delay={0.26}
          />
          <Cell
            label="Captured"
            value={
              <span className="inline-flex items-center gap-1 text-volt">
                <FlagIcon size={14} /> {run.cellsCaptured}
              </span>
            }
            delay={0.34}
          />
          <Cell
            label="Stolen"
            value={
              <span className="inline-flex items-center gap-1 text-ember">
                <SwordsIcon size={14} /> {run.cellsStolen}
              </span>
            }
            delay={0.42}
          />
          <Cell
            label="Streak"
            value={
              <span className="inline-flex items-center gap-1 text-ember">
                <FlameIcon size={14} /> {stats.streakDays}d
              </span>
            }
            delay={0.5}
          />
        </div>

        {report.personalBests.length > 0 && (
          <div
            className="anim-rise mt-4 rounded-xl bg-volt/10 px-4 py-2.5 text-center text-[13px] font-bold text-volt"
            style={{ animationDelay: '0.55s' }}
          >
            🏅 New personal best — {report.personalBests.join(', ')}
          </div>
        )}

        {report.newAchievements.length > 0 && (
          <div className="mt-4 space-y-2.5">
            {report.newAchievements.map((a, i) => (
              <div
                key={a.code}
                className="anim-rise flex items-center gap-3 rounded-xl border border-gold/25 bg-gold/8 p-3"
                style={{ animationDelay: `${0.6 + i * 0.12}s` }}
              >
                <span className="text-2xl" aria-hidden="true">
                  {a.icon}
                </span>
                <div className="min-w-0">
                  <div className="text-[14px] font-bold text-gold">{a.title}</div>
                  <div className="truncate text-xs text-ink-2">{a.description}</div>
                </div>
                <span className="ml-auto text-xs font-bold text-ink-2">+{a.xpReward}</span>
              </div>
            ))}
          </div>
        )}

        <button onClick={onClose} className="btn btn-primary mt-6 w-full py-3">
          Nice!
        </button>
      </div>
    </div>
  );
}

function Cell({
  label,
  value,
  delay,
}: {
  label: string;
  value: React.ReactNode;
  delay: number;
}) {
  return (
    <div
      className="anim-rise rounded-xl bg-elev2 px-2 py-2.5 text-center"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="t-label">{label}</div>
      <div className="mt-0.5 text-[15px] font-bold text-ink tabular-nums">{value}</div>
    </div>
  );
}