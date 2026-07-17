/** Minimal 24px stroke icon set (lucide-style, hand-rolled, no dependency). */

interface IconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
}

function Icon({
  size = 20,
  className,
  strokeWidth = 2,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const MapIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 3 3.6 5.4a1 1 0 0 0-.6.92V20l6-2.5 6 2.5 5.4-2.4a1 1 0 0 0 .6-.92V6l-6 2.5L9 6Z" />
    <path d="M9 3v15M15 8.5V21" />
  </Icon>
);

export const RecordIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none" />
  </Icon>
);

export const UsersIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5" />
    <circle cx="17" cy="9" r="2.6" />
    <path d="M16.4 14.6c2.4.3 4.3 1.8 5.1 4.4" />
  </Icon>
);

export const HistoryIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.2 2" />
  </Icon>
);

export const TrophyIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 4h8v5a4 4 0 0 1-8 0Z" />
    <path d="M8 5H4.5a0 0 0 0 0 0 0c0 3 1.5 4.8 3.5 5.3M16 5h3.5c0 3-1.5 4.8-3.5 5.3" />
    <path d="M12 13v4m-4 4h8m-6.5 0v-2.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V21" />
  </Icon>
);

export const UserIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4.5 21c1-3.8 4-6 7.5-6s6.5 2.2 7.5 6" />
  </Icon>
);

export const FlagIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 21V4" />
    <path d="M5 4c4-2.4 8 2.4 12 0v9c-4 2.4-8-2.4-12 0" />
  </Icon>
);

export const SwordsIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m4 4 9.5 9.5M4 4v4m0-4h4M20 4l-9.5 9.5M20 4v4m0-4h-4" />
    <path d="m7 17-2.5 2.5M9.5 14.5 12 17m-7.5 0L7 19.5M17 17l2.5 2.5M14.5 14.5 12 17m7.5 0L17 19.5" />
  </Icon>
);

export const FlameIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3s1 2.5-.5 4.5S8 10 8 13a4 4 0 0 0 8 0c0-1.5-.5-2.5-1-3.5 0 0-.4 1.5-1.5 2 .5-2 .3-5.5-1.5-8.5Z" />
  </Icon>
);

export const CoinIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5v9M9.5 9.8c0-1 1.1-1.7 2.5-1.7s2.5.7 2.5 1.7-1 1.5-2.5 1.9-2.5.9-2.5 1.9 1.1 1.7 2.5 1.7 2.5-.7 2.5-1.7" />
  </Icon>
);

export const RouteIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="6" cy="19" r="2.5" />
    <circle cx="18" cy="5" r="2.5" />
    <path d="M8.5 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.5" strokeDasharray="0" />
  </Icon>
);

export const BoltIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2Z" />
  </Icon>
);

export const PlayIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 4.5v15l12-7.5Z" fill="currentColor" stroke="none" />
  </Icon>
);

export const PauseIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" />
    <rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" />
  </Icon>
);

export const StopIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />
  </Icon>
);

export const FlaskIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 3v6L4.7 18a2 2 0 0 0 1.8 3h11a2 2 0 0 0 1.8-3L14 9V3" />
    <path d="M8.5 3h7M7.5 15h9" />
  </Icon>
);

export const DownloadIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4v11m0 0 4.5-4.5M12 15l-4.5-4.5" />
    <path d="M4.5 20h15" />
  </Icon>
);

export const CrownIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m4 8 4 3.5L12 5l4 6.5L20 8l-1.5 10h-13Z" />
  </Icon>
);

export const ShieldIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 2.5 5 5.5v6c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10v-6Z" />
  </Icon>
);

export const TargetIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
  </Icon>
);
