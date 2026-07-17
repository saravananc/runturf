import type { AchievementDef, UnlockedAchievement, UserStats } from '@runturf/shared';
import { levelProgress } from '@runturf/shared';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { get } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { CoinIcon, FlagIcon, FlameIcon, MapIcon, RouteIcon, TargetIcon } from '../components/icons';
import { Avatar, ProgressRing, SectionHeading, StatTile } from '../components/ui';
import { formatDistance } from '../record/recorder';

export function ProfilePage() {
  const { user, logout } = useAuth();
  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: () => get<UserStats>('/users/me/stats'),
  });
  const { data: unlocked } = useQuery({
    queryKey: ['myAchievements'],
    queryFn: () => get<UnlockedAchievement[]>('/users/me/achievements'),
  });
  const { data: catalog } = useQuery({
    queryKey: ['achievementCatalog'],
    queryFn: () => get<AchievementDef[]>('/achievements'),
  });

  const lp = stats ? levelProgress(stats.xp) : null;
  const unlockedCodes = new Set(unlocked?.map((a) => a.code));

  return (
    <div className="mx-auto h-full w-full max-w-lg overflow-y-auto p-4 pb-8">
      <div className="flex items-center gap-3.5">
        {user && <Avatar user={user} size={56} ring />}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[19px] font-extrabold text-ink">{user?.displayName}</h1>
          <p className="text-[13px] text-ink-2">@{user?.username}</p>
        </div>
        <button onClick={logout} className="btn btn-ghost px-3.5 py-2 text-[13px]">
          Sign out
        </button>
      </div>

      {stats && lp && (
        <>
          {/* Level hero */}
          <div className="card anim-rise mt-5 flex items-center gap-5 p-5">
            <ProgressRing progress={lp.progress} size={116} stroke={10} label={`Level ${lp.level}`}>
              <span className="t-label">Level</span>
              <span className="t-display text-[30px] text-volt">{lp.level}</span>
            </ProgressRing>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-bold text-ink">
                {stats.xp - lp.currentLevelXp}
                <span className="font-medium text-ink-3">
                  {' '}
                  / {lp.nextLevelXp - lp.currentLevelXp} XP to Lv {lp.level + 1}
                </span>
              </div>
              <div className="mt-3 flex flex-col gap-2 text-[13px] font-semibold">
                <span className="inline-flex items-center gap-1.5 text-gold">
                  <CoinIcon size={14} /> {stats.coins} coins
                </span>
                <span className="inline-flex items-center gap-1.5 text-ember">
                  <FlameIcon size={14} /> {stats.streakDays}-day streak
                </span>
              </div>
            </div>
          </div>

          <div className="mt-2.5 grid grid-cols-3 gap-2.5">
            <StatTile label="Runs" value={stats.totalRuns} icon={<RouteIcon size={14} />} tone="volt" />
            <StatTile
              label="Distance"
              value={formatDistance(stats.totalDistanceM)}
              icon={<MapIcon size={14} />}
              tone="volt"
            />
            <StatTile label="Turf" value={stats.cellsOwned} icon={<FlagIcon size={14} />} tone="volt" />
          </div>
        </>
      )}

      <Link to="/challenges" className="card mt-2.5 flex items-center gap-3 p-4 transition-colors hover:bg-elev2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-grape/15 text-grape">
          <TargetIcon size={18} />
        </span>
        <span className="flex-1 text-[14px] font-bold text-ink">Weekly challenges</span>
        <span className="text-ink-3">→</span>
      </Link>

      <div className="mt-6">
        <SectionHeading
          action={
            <span className="text-[12px] font-semibold text-ink-3">
              {unlockedCodes.size}/{catalog?.length ?? '–'}
            </span>
          }
        >
          Badges
        </SectionHeading>
        <div className="grid grid-cols-3 gap-2.5">
          {catalog?.map((a, i) => {
            const isUnlocked = unlockedCodes.has(a.code);
            return (
              <div
                key={a.code}
                className={`anim-rise flex flex-col items-center gap-1 rounded-2xl border p-3 text-center ${
                  isUnlocked
                    ? 'border-gold/25 bg-gold/8'
                    : 'border-white/6 bg-elev1 opacity-45 grayscale'
                }`}
                style={{ animationDelay: `${Math.min(i * 0.03, 0.3)}s` }}
                title={a.description}
              >
                <span className="text-[26px]" aria-hidden="true">
                  {a.icon}
                </span>
                <span
                  className={`text-[12px] leading-tight font-bold ${
                    isUnlocked ? 'text-gold' : 'text-ink-2'
                  }`}
                >
                  {a.title}
                </span>
                <span className="text-[11px] leading-snug text-ink-3">{a.description}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
