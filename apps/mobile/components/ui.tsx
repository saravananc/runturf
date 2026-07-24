import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { colors, font, radius, space, type } from '../theme';

/* ---------- buttons ---------- */

export function Btn({
  label,
  onPress,
  variant = 'primary',
  disabled,
  size = 'md',
  style,
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'dangerSoft';
  disabled?: boolean;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
  /** Stable handle for device tests; labels carry emoji and change with copy. */
  testID?: string;
}) {
  const bg = {
    primary: s.btnPrimary,
    ghost: s.btnGhost,
    danger: s.btnDanger,
    dangerSoft: s.btnDangerSoft,
  }[variant];
  const fg = {
    primary: s.btnPrimaryText,
    ghost: s.btnGhostText,
    danger: s.btnDangerText,
    dangerSoft: s.btnDangerSoftText,
  }[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      style={({ pressed }) => [
        s.btn,
        size === 'sm' && s.btnSm,
        bg,
        style,
        pressed && !disabled && { transform: [{ scale: 0.96 }] },
        disabled && { opacity: 0.45 },
      ]}
    >
      <Text style={[s.btnText, size === 'sm' && { fontSize: type.small }, fg]}>{label}</Text>
    </Pressable>
  );
}

export function Input(props: TextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={colors.ink3}
      {...props}
      onFocus={(e) => {
        setFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        props.onBlur?.(e);
      }}
      style={[s.input, focused && { borderColor: colors.volt }, props.style]}
    />
  );
}

/* ---------- surfaces ---------- */

export function Card({
  children,
  style,
  onPress,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [s.card, style, pressed && { opacity: 0.8 }]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[s.card, style]}>{children}</View>;
}

export function ScreenTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ marginBottom: space(4) }}>
      <Text style={s.screenTitle}>{title}</Text>
      {subtitle ? <Text style={s.screenSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function SectionHeading({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <View style={s.sectionRow}>
      <Text style={s.section}>{children}</Text>
      {action}
    </View>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={s.label}>{String(children).toUpperCase()}</Text>;
}

/* ---------- data display ---------- */

export function Avatar({
  user,
  size = 36,
  ring,
}: {
  user: { displayName: string; color: string };
  size?: number;
  ring?: boolean;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: user.color,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: ring ? 2 : 0,
        borderColor: colors.base,
      }}
    >
      <Text style={{ fontFamily: font.extrabold, fontSize: size * 0.42, color: colors.base }}>
        {user.displayName.slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}

export function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: 'volt' | 'gold' | 'ember';
}) {
  const color =
    tone === 'volt'
      ? colors.volt
      : tone === 'gold'
        ? colors.gold
        : tone === 'ember'
          ? colors.ember
          : colors.ink;
  return (
    <View style={s.statTile}>
      <Label>{label}</Label>
      <Text style={[s.statValue, { color }]}>{value}</Text>
    </View>
  );
}

/** Horizontal progress bar; `progress` is 0..1. */
export function ProgressBar({
  progress,
  color = colors.volt,
  height = 10,
}: {
  progress: number;
  color?: string;
  height?: number;
}) {
  const pct = Math.max(0, Math.min(1, progress)) * 100;
  return (
    <View style={[s.track, { height, borderRadius: height / 2 }]}>
      <View
        style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: height / 2 }}
      />
    </View>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={s.empty}>
      <Text style={s.emptyTitle}>{title}</Text>
      {hint ? <Text style={s.emptyHint}>{hint}</Text> : null}
    </View>
  );
}

export function Loading() {
  return (
    <View style={s.loading}>
      <ActivityIndicator color={colors.volt} />
    </View>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return <Text style={s.error}>{message}</Text>;
}

const s = StyleSheet.create({
  btn: {
    borderRadius: radius.ctl,
    paddingVertical: space(3.25),
    paddingHorizontal: space(5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSm: { paddingVertical: space(2), paddingHorizontal: space(3.5) },
  btnText: { fontFamily: font.bold, fontSize: type.body },
  btnPrimary: {
    backgroundColor: colors.volt,
    shadowColor: colors.volt,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  btnPrimaryText: { color: colors.base },
  btnGhost: { backgroundColor: colors.elev2, borderWidth: 1, borderColor: colors.borderStrong },
  btnGhostText: { color: colors.ink2 },
  btnDanger: { backgroundColor: colors.ember },
  btnDangerText: { color: '#ffffff' },
  btnDangerSoft: { backgroundColor: 'rgba(255,93,115,0.12)' },
  btnDangerSoftText: { color: '#ff8ea0' },

  input: {
    borderRadius: radius.ctl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.elev1,
    paddingHorizontal: space(3.5),
    paddingVertical: space(3),
    color: colors.ink,
    fontFamily: font.regular,
    fontSize: type.body,
  },

  card: {
    backgroundColor: colors.elev1,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space(4),
  },

  screenTitle: {
    fontFamily: font.extrabold,
    fontSize: type.title,
    color: colors.ink,
    letterSpacing: -0.4,
  },
  screenSubtitle: {
    fontFamily: font.regular,
    fontSize: type.small,
    color: colors.ink2,
    marginTop: 2,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space(2.5),
  },
  section: { fontFamily: font.bold, fontSize: type.section, color: colors.ink },
  label: {
    fontFamily: font.semibold,
    fontSize: type.label,
    letterSpacing: 0.9,
    color: colors.ink3,
  },

  statTile: {
    flex: 1,
    backgroundColor: colors.elev1,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space(3),
    gap: 2,
  },
  statValue: {
    fontFamily: font.extrabold,
    fontSize: type.stat,
    fontVariant: ['tabular-nums'],
  },

  track: { width: '100%', backgroundColor: colors.elev3, overflow: 'hidden' },

  empty: {
    alignItems: 'center',
    paddingVertical: space(10),
    paddingHorizontal: space(6),
    gap: space(1.5),
  },
  emptyTitle: { fontFamily: font.bold, fontSize: type.section, color: colors.ink },
  emptyHint: {
    fontFamily: font.regular,
    fontSize: type.small,
    color: colors.ink2,
    textAlign: 'center',
  },
  loading: { paddingVertical: space(10), alignItems: 'center' },
  error: {
    fontFamily: font.medium,
    fontSize: type.small,
    color: colors.ember,
    textAlign: 'center',
    paddingVertical: space(2),
  },
});
