import type { RunReport } from '@runturf/shared';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatDistance, formatDuration, formatPace } from '../format';
import { colors, font, radius, space, type } from '../theme';
import { Btn, Label } from './ui';

export function RunReportModal({
  report,
  onClose,
}: {
  report: RunReport;
  onClose: () => void;
}) {
  const { run, stats } = report;
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.card}>
          <ScrollView contentContainerStyle={{ padding: space(6) }}>
            <Label>Run complete</Label>
            <Text style={s.hero}>{formatDistance(run.distanceM)}</Text>
            <Text style={s.sub}>
              Lv {stats.level} · +{report.xpGained} XP
            </Text>

            <View style={s.grid}>
              <Cell label="Time" value={formatDuration(run.durationS)} />
              <Cell label="Pace" value={`${formatPace(run.avgPaceSPerKm)}/km`} />
              <Cell label="Coins" value={`+${report.coinsGained}`} color={colors.gold} />
              <Cell label="Captured" value={String(run.cellsCaptured)} color={colors.volt} />
              <Cell label="Stolen" value={String(run.cellsStolen)} color={colors.ember} />
              <Cell label="Streak" value={`${stats.streakDays}d`} color={colors.ember} />
            </View>

            {report.perksApplied.length > 0 && (
              <View style={s.perk}>
                <Text style={s.perkText}>✨ Perk applied — {report.perksApplied.join(', ')}</Text>
              </View>
            )}

            {report.personalBests.length > 0 && (
              <View style={s.pb}>
                <Text style={s.pbText}>
                  🏅 New personal best — {report.personalBests.join(', ')}
                </Text>
              </View>
            )}

            {report.newAchievements.map((a) => (
              <View key={a.code} style={s.achieve}>
                <Text style={{ fontSize: 24 }}>{a.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.achieveTitle}>{a.title}</Text>
                  <Text style={s.achieveDesc}>{a.description}</Text>
                </View>
              </View>
            ))}

            <Btn label="Nice!" onPress={onClose} style={{ marginTop: space(5) }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Cell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={s.cell}>
      <Label>{label}</Label>
      <Text style={[s.cellValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,15,30,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space(4),
  },
  card: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '88%',
    backgroundColor: colors.elev2,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  hero: {
    fontFamily: font.extrabold,
    fontSize: 40,
    color: colors.volt,
    textAlign: 'center',
    marginTop: space(2),
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  sub: {
    fontFamily: font.semibold,
    fontSize: type.small,
    color: colors.ink2,
    textAlign: 'center',
    marginTop: space(1),
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginTop: space(5) },
  cell: {
    flexBasis: '31%',
    flexGrow: 1,
    backgroundColor: colors.elev3,
    borderRadius: radius.ctl,
    paddingVertical: space(2.5),
    alignItems: 'center',
    gap: 2,
  },
  cellValue: {
    fontFamily: font.bold,
    fontSize: type.body,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  pb: {
    backgroundColor: 'rgba(173,235,46,0.10)',
    borderRadius: radius.ctl,
    padding: space(3),
    marginTop: space(4),
  },
  pbText: { fontFamily: font.bold, fontSize: type.small, color: colors.volt, textAlign: 'center' },
  perk: {
    backgroundColor: 'rgba(255,197,61,0.10)',
    borderRadius: radius.ctl,
    padding: space(3),
    marginTop: space(4),
  },
  perkText: { fontFamily: font.bold, fontSize: type.small, color: colors.gold, textAlign: 'center' },
  achieve: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    backgroundColor: 'rgba(255,197,61,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,197,61,0.25)',
    borderRadius: radius.ctl,
    padding: space(3),
    marginTop: space(2.5),
  },
  achieveTitle: { fontFamily: font.bold, fontSize: type.small, color: colors.gold },
  achieveDesc: { fontFamily: font.regular, fontSize: type.caption, color: colors.ink2 },
});
