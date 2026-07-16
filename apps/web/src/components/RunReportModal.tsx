import type { RunReport } from '@runturf/shared';
import { formatDistance, formatDuration, formatPace } from '../record/recorder';

export function RunReportModal({ report, onClose }: { report: RunReport; onClose: () => void }) {
  const { run } = report;
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <h2 className="text-center text-2xl font-bold text-white">Run complete! 🎉</h2>

        <div className="mt-5 grid grid-cols-3 gap-3 text-center">
          <Stat label="Distance" value={formatDistance(run.distanceM)} />
          <Stat label="Time" value={formatDuration(run.durationS)} />
          <Stat label="Pace" value={formatPace(run.avgPaceSPerKm)} />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <Stat label="Captured" value={`${run.cellsCaptured} 🚩`} accent />
          <Stat label="Stolen" value={`${run.cellsStolen} ⚔️`} accent />
          <Stat label="XP" value={`+${report.xpGained}`} accent />
        </div>

        {report.coinsGained > 0 && (
          <p className="mt-3 text-center text-amber-300">+{report.coinsGained} coins 🪙</p>
        )}

        {report.personalBests.length > 0 && (
          <div className="mt-4 rounded-lg bg-emerald-500/10 p-3 text-center text-sm text-emerald-300">
            🏅 New personal best: {report.personalBests.join(', ')}
          </div>
        )}

        {report.newAchievements.length > 0 && (
          <div className="mt-4 space-y-2">
            {report.newAchievements.map((a) => (
              <div
                key={a.code}
                className="flex items-center gap-3 rounded-lg bg-amber-500/10 p-3 text-sm"
              >
                <span className="text-2xl">{a.icon}</span>
                <div>
                  <div className="font-semibold text-amber-300">{a.title}</div>
                  <div className="text-xs text-slate-400">{a.description}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-6 w-full rounded-lg bg-emerald-500 py-2.5 font-semibold text-slate-900 hover:bg-emerald-400"
        >
          Nice!
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg bg-slate-800 p-2">
      <div className="text-[10px] tracking-wide text-slate-400 uppercase">{label}</div>
      <div className={`text-sm font-bold tabular-nums ${accent ? 'text-emerald-300' : 'text-white'}`}>
        {value}
      </div>
    </div>
  );
}
