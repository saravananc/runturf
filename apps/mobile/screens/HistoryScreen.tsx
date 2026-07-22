import type { RunSummary, UserStats } from '@runturf/shared';
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { del, get } from '../api';
import { Card, Empty, ErrorNote, Label, Loading, ScreenTitle, StatTile } from '../components/ui';
import { formatDate, formatDistance, formatDuration, formatPace } from '../format';
import { colors, font, space, type } from '../theme';

export function HistoryScreen() {
  const [runs, setRuns] = useState<RunSummary[] | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      const [r, s] = await Promise.all([
        get<RunSummary[]>('/runs'),
        get<UserStats>('/users/me/stats'),
      ]);
      setRuns(r);
      setStats(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load history');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function confirmDelete(run: RunSummary) {
    Alert.alert('Delete run?', `${formatDistance(run.distanceM)} on ${formatDate(run.startedAt)}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await del(`/runs/${run.id}`);
            load();
          } catch (err) {
            Alert.alert('Delete failed', err instanceof Error ? err.message : 'Network error');
          }
        },
      },
    ]);
  }

  if (!runs && !error) return <Loading />;

  return (
    <FlatList
      style={s.flex}
      contentContainerStyle={s.content}
      data={runs ?? []}
      keyExtractor={(r) => r.id}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={colors.ink2}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
      ListHeaderComponent={
        <View>
          <ScreenTitle title="History" />
          {error ? <ErrorNote message={error} /> : null}
          {stats && (
            <View style={s.tiles}>
              <StatTile label="Runs" value={stats.totalRuns} tone="volt" />
              <StatTile label="Distance" value={formatDistance(stats.totalDistanceM)} tone="volt" />
              <StatTile label="Turf" value={stats.cellsOwned} tone="volt" />
            </View>
          )}
        </View>
      }
      ListEmptyComponent={
        error ? null : (
          <Empty title="No runs yet" hint="Head to the Record tab and claim your first turf." />
        )
      }
      renderItem={({ item }) => (
        <Card style={s.run} onPress={() => confirmDelete(item)}>
          <View style={s.runTop}>
            <Text style={s.runDistance}>{formatDistance(item.distanceM)}</Text>
            <Text style={s.runXp}>+{item.xpGained} XP</Text>
          </View>
          <View style={s.runMeta}>
            <Text style={s.metaText}>{formatDate(item.startedAt)}</Text>
            <Text style={s.dot}>·</Text>
            <Text style={s.metaText}>{formatDuration(item.durationS)}</Text>
            <Text style={s.dot}>·</Text>
            <Text style={s.metaText}>{formatPace(item.avgPaceSPerKm)}/km</Text>
            <View style={{ flex: 1 }} />
            <Text style={s.captured}>🚩 {item.cellsCaptured}</Text>
            {item.cellsStolen > 0 && <Text style={s.stolen}>⚔ {item.cellsStolen}</Text>}
          </View>
        </Card>
      )}
      ItemSeparatorComponent={() => <View style={{ height: space(2.5) }} />}
    />
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.base },
  content: { padding: space(4), paddingBottom: space(10) },
  tiles: { flexDirection: 'row', gap: space(2.5), marginBottom: space(4) },
  run: { padding: space(4) },
  runTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  runDistance: {
    fontFamily: font.extrabold,
    fontSize: 19,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  runXp: { fontFamily: font.bold, fontSize: type.small, color: colors.volt },
  runMeta: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), marginTop: space(1.5) },
  metaText: { fontFamily: font.regular, fontSize: type.small, color: colors.ink2 },
  dot: { color: colors.ink3 },
  captured: { fontFamily: font.semibold, fontSize: type.small, color: colors.volt },
  stolen: {
    fontFamily: font.semibold,
    fontSize: type.small,
    color: colors.ember,
    marginLeft: space(2),
  },
});
