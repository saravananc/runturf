import type { LeaderboardEntry } from '@runturf/shared';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../AuthContext';
import { get } from '../api';
import { Avatar, Card, Empty, ErrorNote, Loading, ScreenTitle } from '../components/ui';
import { formatDistance } from '../format';
import { colors, font, space, type } from '../theme';

const MEDALS = ['🥇', '🥈', '🥉'];

export function LeaderboardScreen() {
  const { user } = useAuth();
  const [rows, setRows] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      setRows(await get<LeaderboardEntry[]>('/territory/leaderboard'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load leaderboard');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!rows && !error) return <Loading />;

  return (
    <FlatList
      style={s.flex}
      contentContainerStyle={s.content}
      data={rows ?? []}
      keyExtractor={(e) => e.user.id}
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
          <ScreenTitle title="Leaderboard" subtitle="Who owns the most turf?" />
          {error ? <ErrorNote message={error} /> : null}
        </View>
      }
      ListEmptyComponent={
        error ? null : (
          <Empty title="No territory claimed yet" hint="Be the first — every run claims cells." />
        )
      }
      ItemSeparatorComponent={() => <View style={{ height: space(2.5) }} />}
      renderItem={({ item, index }) => {
        const isMe = item.user.id === user?.id;
        return (
          <Card style={[s.row, isMe && s.me]}>
            <Text style={s.rank}>{MEDALS[index] ?? index + 1}</Text>
            <Avatar user={item.user} size={38} />
            <View style={s.info}>
              <Text style={s.name}>{item.user.displayName}</Text>
              <Text style={s.meta}>
                Lv {item.level} · {formatDistance(item.weeklyDistanceM)} this week
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.cells}>{item.cellsOwned} 🚩</Text>
              <Text style={s.xp}>{item.xp} XP</Text>
            </View>
          </Card>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.base },
  content: { padding: space(4), paddingBottom: space(10) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(3) },
  me: { borderColor: 'rgba(173,235,46,0.4)', backgroundColor: 'rgba(173,235,46,0.05)' },
  rank: { width: 26, textAlign: 'center', fontFamily: font.bold, fontSize: type.small, color: colors.ink3 },
  info: { flex: 1, minWidth: 0 },
  name: { fontFamily: font.bold, fontSize: type.small, color: colors.ink },
  meta: { fontFamily: font.regular, fontSize: type.caption, color: colors.ink2, marginTop: 1 },
  cells: {
    fontFamily: font.extrabold,
    fontSize: type.small,
    color: colors.volt,
    fontVariant: ['tabular-nums'],
  },
  xp: { fontFamily: font.regular, fontSize: type.label, color: colors.ink3 },
});
