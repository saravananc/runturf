import type { RunReport, RunSummary, UserStats } from '@runturf/shared';
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { del, get, post } from '../api';
import { RunReportModal } from '../components/RunReportModal';
import { Btn, Card, Empty, ErrorNote, Label, Loading, ScreenTitle, StatTile } from '../components/ui';
import { formatDate, formatDistance, formatDuration, formatPace } from '../format';
import { colors, font, space, type } from '../theme';

export function HistoryScreen() {
  const [runs, setRuns] = useState<RunSummary[] | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [imported, setImported] = useState<RunReport | null>(null);
  const [importing, setImporting] = useState(false);

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

  async function importGpx() {
    setImporting(true);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        // GPX has no universal MIME type across platforms, so accept broadly
        // and let the server reject anything that is not a GPX track.
        type: ['application/gpx+xml', 'application/xml', 'text/xml', '*/*'],
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets?.[0]) return;

      const gpx = await FileSystem.readAsStringAsync(picked.assets[0].uri);
      const report = await post<RunReport>('/runs/import', { gpx });
      setImported(report);
      await load();
    } catch (err) {
      Alert.alert('Import failed', err instanceof Error ? err.message : 'Could not read that file');
    } finally {
      setImporting(false);
    }
  }

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
    <>
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
          <View style={s.headerRow}>
            <ScreenTitle title="History" />
            <Btn
              label={importing ? 'Importing…' : '↥ Import GPX'}
              size="sm"
              variant="ghost"
              disabled={importing}
              onPress={importGpx}
            />
          </View>
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
      {/* An imported run earns rewards like any other, so show the same report. */}
      {imported && <RunReportModal report={imported} onClose={() => setImported(null)} />}
    </>
  );
}


const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.base },
  content: { padding: space(4), paddingBottom: space(10) },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
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
