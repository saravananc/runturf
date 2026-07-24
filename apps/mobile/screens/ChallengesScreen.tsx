import type { Challenge, ChallengeStanding } from '@runturf/shared';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { get, post } from '../api';
import {
  Avatar,
  Btn,
  Card,
  Empty,
  ErrorNote,
  Loading,
  ProgressBar,
  ScreenTitle,
} from '../components/ui';
import { formatDistance } from '../format';
import { colors, font, space, type } from '../theme';

/** Standings for one challenge, loaded on demand when expanded. */
function Standings({ challenge }: { challenge: Challenge }) {
  const [rows, setRows] = useState<ChallengeStanding[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    get<ChallengeStanding[]>(`/challenges/${challenge.id}/leaderboard`)
      .then((r) => !cancelled && setRows(r))
      .catch(() => !cancelled && setRows([]));
    return () => {
      cancelled = true;
    };
  }, [challenge.id]);

  const fmt = (n: number) =>
    challenge.metric === 'distance_m' ? formatDistance(n) : `${Math.round(n)} cells`;

  if (!rows) return <Text style={s.standingsNote}>Loading…</Text>;
  if (rows.length === 0) return <Text style={s.standingsNote}>Nobody has joined yet.</Text>;

  return (
    <View style={s.standings}>
      {rows.map((row, i) => (
        <View key={row.user.id} style={s.standingRow}>
          <Text style={s.standingRank}>{i + 1}</Text>
          <Avatar user={row.user} size={24} />
          <Text style={s.standingName} numberOfLines={1}>
            {row.user.displayName}
          </Text>
          {row.completed && <Text style={s.standingDone}>DONE</Text>}
          <Text style={s.standingValue}>{fmt(row.progress)}</Text>
        </View>
      ))}
    </View>
  );
}

export function ChallengesScreen() {
  const [items, setItems] = useState<Challenge[] | null>(null);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [openStandings, setOpenStandings] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError('');
      setItems(await get<Challenge[]>('/challenges'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load challenges');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function join(id: string) {
    setJoining(id);
    try {
      await post(`/challenges/${id}/join`);
      await load();
    } catch (err) {
      Alert.alert('Could not join', err instanceof Error ? err.message : 'Network error');
    } finally {
      setJoining(null);
    }
  }

  if (!items && !error) return <Loading />;

  return (
    <FlatList
      style={s.flex}
      contentContainerStyle={s.content}
      data={items ?? []}
      keyExtractor={(c) => c.id}
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
          <ScreenTitle title="Challenges" subtitle="Join weekly goals, earn coins and XP" />
          {error ? <ErrorNote message={error} /> : null}
        </View>
      }
      ListEmptyComponent={
        error ? null : <Empty title="No active challenges" hint="New challenges appear each Monday." />
      }
      ItemSeparatorComponent={() => <View style={{ height: space(2.5) }} />}
      renderItem={({ item }) => {
        const progress = item.progress ?? 0;
        const pct = Math.min(1, progress / item.target);
        const fmt = (n: number) =>
          item.metric === 'distance_m' ? formatDistance(n) : `${Math.round(n)} cells`;
        return (
          <Card>
            <View style={s.head}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.title}>
                  {item.title}
                  {item.completed ? '  ✅' : ''}
                </Text>
                <Text style={s.desc}>{item.description}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.coin}>🪙 {item.coinReward}</Text>
                <Text style={s.xp}>✦ {item.xpReward} XP</Text>
              </View>
            </View>

            {item.joined ? (
              <View style={{ marginTop: space(3.5) }}>
                <ProgressBar progress={pct} color={item.completed ? colors.volt : colors.voltDeep} />
                <View style={s.progressRow}>
                  <Text style={s.progressText}>
                    {fmt(progress)} / {fmt(item.target)}
                  </Text>
                  <Text style={s.progressPct}>{Math.round(pct * 100)}%</Text>
                </View>
              </View>
            ) : (
              <Btn
                label={joining === item.id ? 'Joining…' : 'Join challenge'}
                variant="ghost"
                size="sm"
                disabled={joining === item.id}
                onPress={() => join(item.id)}
                style={{ marginTop: space(3.5), alignSelf: 'flex-start' }}
              />
            )}

            <Pressable
              onPress={() => setOpenStandings(openStandings === item.id ? null : item.id)}
              style={{ marginTop: space(3) }}
            >
              <Text style={s.standingsToggle}>
                {openStandings === item.id ? '▾ Hide standings' : '▸ Standings'}
              </Text>
            </Pressable>
            {openStandings === item.id && <Standings challenge={item} />}
          </Card>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.base },
  content: { padding: space(4), paddingBottom: space(10) },
  head: { flexDirection: 'row', gap: space(3) },
  title: { fontFamily: font.bold, fontSize: type.body, color: colors.ink },
  desc: { fontFamily: font.regular, fontSize: type.caption, color: colors.ink2, marginTop: 2 },
  coin: { fontFamily: font.bold, fontSize: type.caption, color: colors.gold },
  xp: { fontFamily: font.bold, fontSize: type.caption, color: colors.grape, marginTop: 2 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space(1.5) },
  progressText: { fontFamily: font.semibold, fontSize: type.caption, color: colors.ink2 },
  progressPct: {
    fontFamily: font.bold,
    fontSize: type.caption,
    color: colors.ink2,
    fontVariant: ['tabular-nums'],
  },
  standingsToggle: { fontFamily: font.semibold, fontSize: type.caption, color: colors.ink3 },
  standingsNote: {
    fontFamily: font.regular,
    fontSize: type.caption,
    color: colors.ink3,
    textAlign: 'center',
    paddingVertical: space(3),
  },
  standings: {
    marginTop: space(3),
    paddingTop: space(3),
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: space(1.5),
  },
  standingRow: { flexDirection: 'row', alignItems: 'center', gap: space(2.5) },
  standingRank: {
    width: 16,
    textAlign: 'center',
    fontFamily: font.bold,
    fontSize: type.label,
    color: colors.ink3,
  },
  standingName: { flex: 1, fontFamily: font.semibold, fontSize: type.caption, color: colors.ink },
  standingDone: { fontFamily: font.extrabold, fontSize: type.label, color: colors.volt },
  standingValue: {
    fontFamily: font.bold,
    fontSize: type.caption,
    color: colors.ink2,
    fontVariant: ['tabular-nums'],
  },
});
