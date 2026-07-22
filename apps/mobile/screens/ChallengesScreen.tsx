import type { Challenge } from '@runturf/shared';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { get, post } from '../api';
import { Btn, Card, Empty, ErrorNote, Loading, ProgressBar, ScreenTitle } from '../components/ui';
import { formatDistance } from '../format';
import { colors, font, space, type } from '../theme';

export function ChallengesScreen() {
  const [items, setItems] = useState<Challenge[] | null>(null);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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
});
