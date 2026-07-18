/**
 * Night Turf design tokens — mirrors apps/web/src/styles.css.
 * ink3 is the QA-corrected value (>=4.5:1 on every surface).
 */

export const colors = {
  base: '#0a0f1e',
  elev1: '#121a2e',
  elev2: '#182340',
  elev3: '#1f2c50',

  ink: '#f1f5fb',
  ink2: '#9aa7bd',
  ink3: '#8290ac',

  volt: '#adeb2e',
  voltDeep: '#8fd920',
  grape: '#9d8cff',
  skyx: '#38bdf8',
  gold: '#ffc53d',
  ember: '#ff5d73',

  border: 'rgba(154, 167, 189, 0.10)',
  borderStrong: 'rgba(154, 167, 189, 0.16)',
  glass: 'rgba(10, 15, 30, 0.82)',
} as const;

export const radius = {
  card: 16,
  ctl: 12,
  pill: 999,
} as const;

export const space = (n: number) => n * 4;

export const font = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
} as const;

export const type = {
  display: 30,
  title: 22,
  stat: 20,
  section: 15,
  body: 15,
  small: 13,
  caption: 12,
  label: 11,
} as const;
