import { USER_COLORS, type AchievementDef, type UnlockedAchievement, type UserStats } from '@runturf/shared';
import { useFocusEffect, type NavigationProp } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '../AuthContext';
import { get, patch } from '../api';
import {
  Avatar,
  Btn,
  Card,
  ErrorNote,
  Input,
  Label,
  Loading,
  ProgressBar,
  SectionHeading,
  StatTile,
} from '../components/ui';
import { formatDistance, levelProgress } from '../format';
import { colors, font, radius, space, type } from '../theme';

export function ProfileScreen({ navigation }: { navigation: NavigationProp<never> }) {
  const { user, logout, setUser } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [unlocked, setUnlocked] = useState<UnlockedAchievement[]>([]);
  const [catalog, setCatalog] = useState<AchievementDef[]>([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      const [s, u, c] = await Promise.all([
        get<UserStats>('/users/me/stats'),
        get<UnlockedAchievement[]>('/users/me/achievements'),
        get<AchievementDef[]>('/achievements'),
      ]);
      setStats(s);
      setUnlocked(u);
      setCatalog(c);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load profile');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!user) return null;
  if (!stats && !error) return <Loading />;

  const lp = stats ? levelProgress(stats.xp) : null;
  const unlockedCodes = new Set(unlocked.map((a) => a.code));

  return (
    <ScrollView
      style={s.flex}
      contentContainerStyle={s.content}
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
    >
      <View style={s.header}>
        <Avatar user={user} size={56} ring />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.name}>{user.displayName}</Text>
          <Text style={s.handle}>@{user.username}</Text>
        </View>
        <View style={{ gap: space(1.5) }}>
          <Btn label="Edit" variant="ghost" size="sm" onPress={() => setEditing(true)} />
          <Btn
            label="Sign out"
            variant="ghost"
            size="sm"
            onPress={() =>
              Alert.alert('Sign out?', 'You will need to sign in again.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign out', style: 'destructive', onPress: logout },
              ])
            }
          />
        </View>
      </View>

      {error ? <ErrorNote message={error} /> : null}

      {stats && lp && (
        <>
          <Card style={s.levelCard}>
            <View style={s.levelTop}>
              <View>
                <Label>Level</Label>
                <Text style={s.level}>{lp.level}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: space(4) }}>
                <Text style={s.xpText}>
                  {stats.xp - lp.currentLevelXp}
                  <Text style={s.xpMuted}>
                    {' '}
                    / {lp.nextLevelXp - lp.currentLevelXp} XP to Lv {lp.level + 1}
                  </Text>
                </Text>
                <View style={{ marginTop: space(2) }}>
                  <ProgressBar progress={lp.progress} />
                </View>
                <View style={s.economy}>
                  <Text style={s.coins}>🪙 {stats.coins} coins</Text>
                  <Text style={s.streak}>🔥 {stats.streakDays}-day streak</Text>
                </View>
              </View>
            </View>
          </Card>

          <View style={s.tiles}>
            <StatTile label="Runs" value={stats.totalRuns} tone="volt" />
            <StatTile label="Distance" value={formatDistance(stats.totalDistanceM)} tone="volt" />
            <StatTile label="Turf" value={stats.cellsOwned} tone="volt" />
          </View>
        </>
      )}

      <Card style={s.linkCard} onPress={() => navigation.navigate('Shop' as never)}>
        <Text style={s.linkText}>🪙  Shop</Text>
        {stats && <Text style={s.linkCoins}>{stats.coins} 🪙</Text>}
        <Text style={s.linkArrow}>→</Text>
      </Card>

      <Card style={s.linkCard} onPress={() => navigation.navigate('Challenges' as never)}>
        <Text style={s.linkText}>🎯  Weekly challenges</Text>
        <Text style={s.linkArrow}>→</Text>
      </Card>

      <View style={{ marginTop: space(6) }}>
        <SectionHeading
          action={
            <Text style={s.badgeCount}>
              {unlockedCodes.size}/{catalog.length || '–'}
            </Text>
          }
        >
          Badges
        </SectionHeading>
        <View style={s.badgeGrid}>
          {catalog.map((a) => {
            const has = unlockedCodes.has(a.code);
            return (
              <View key={a.code} style={[s.badge, !has && s.badgeLocked]}>
                <Text style={{ fontSize: 26 }}>{a.icon}</Text>
                <Text style={[s.badgeTitle, !has && { color: colors.ink2 }]}>{a.title}</Text>
                <Text style={s.badgeDesc}>{a.description}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {editing && (
        <EditProfile
          user={user}
          onClose={() => setEditing(false)}
          onSaved={(u) => {
            setUser(u);
            setEditing(false);
          }}
        />
      )}
    </ScrollView>
  );
}

function EditProfile({
  user,
  onSaved,
  onClose,
}: {
  user: { displayName: string; color: string };
  onSaved: (u: never) => void;
  onClose: () => void;
}) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [color, setColor] = useState(user.color);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const trimmed = displayName.trim();
  const invalid = trimmed.length === 0 || trimmed.length > 48;
  const unchanged = trimmed === user.displayName && color === user.color;

  async function save() {
    setBusy(true);
    setError('');
    try {
      const updated = await patch('/users/me', { displayName: trimmed, color });
      onSaved(updated as never);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save changes');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.editCard}>
          <Text style={s.editTitle}>Edit profile</Text>

          <View style={s.editRow}>
            <Avatar user={{ displayName: trimmed || user.displayName, color }} size={52} ring />
            <View style={{ flex: 1 }}>
              <Label>Display name</Label>
              <Input value={displayName} onChangeText={setDisplayName} maxLength={48} autoFocus />
            </View>
          </View>

          <View style={{ marginTop: space(4) }}>
            <Label>Colour</Label>
            <View style={s.swatches}>
              {USER_COLORS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setColor(c)}
                  accessibilityLabel={`Colour ${c}`}
                  style={[
                    s.swatch,
                    { backgroundColor: c },
                    color === c && { borderWidth: 3, borderColor: colors.ink },
                  ]}
                />
              ))}
            </View>
          </View>

          {error ? <ErrorNote message={error} /> : null}

          <View style={s.editActions}>
            <Btn label="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
            <Btn
              label={busy ? 'Saving…' : 'Save'}
              disabled={busy || invalid || unchanged}
              onPress={save}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.base },
  content: { padding: space(4), paddingBottom: space(10) },
  header: { flexDirection: 'row', alignItems: 'center', gap: space(3.5) },
  name: { fontFamily: font.extrabold, fontSize: 19, color: colors.ink },
  handle: { fontFamily: font.regular, fontSize: type.small, color: colors.ink2 },
  levelCard: { marginTop: space(5) },
  levelTop: { flexDirection: 'row', alignItems: 'center' },
  level: { fontFamily: font.extrabold, fontSize: 34, color: colors.volt },
  xpText: { fontFamily: font.bold, fontSize: type.small, color: colors.ink },
  xpMuted: { fontFamily: font.regular, color: colors.ink3 },
  economy: { flexDirection: 'row', gap: space(4), marginTop: space(2.5) },
  coins: { fontFamily: font.semibold, fontSize: type.small, color: colors.gold },
  streak: { fontFamily: font.semibold, fontSize: type.small, color: colors.ember },
  tiles: { flexDirection: 'row', gap: space(2.5), marginTop: space(2.5) },
  linkCard: {
    marginTop: space(2.5),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  linkText: { fontFamily: font.bold, fontSize: type.small, color: colors.ink, flex: 1 },
  linkCoins: { fontFamily: font.bold, fontSize: type.small, color: colors.gold, marginRight: space(2) },
  linkArrow: { color: colors.ink3, fontSize: 16 },
  badgeCount: { fontFamily: font.semibold, fontSize: type.caption, color: colors.ink3 },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2.5) },
  badge: {
    flexBasis: '31%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 2,
    padding: space(3),
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: 'rgba(255,197,61,0.25)',
    backgroundColor: 'rgba(255,197,61,0.08)',
  },
  badgeLocked: {
    opacity: 0.45,
    borderColor: colors.border,
    backgroundColor: colors.elev1,
  },
  badgeTitle: {
    fontFamily: font.bold,
    fontSize: type.caption,
    color: colors.gold,
    textAlign: 'center',
  },
  badgeDesc: {
    fontFamily: font.regular,
    fontSize: type.label,
    color: colors.ink3,
    textAlign: 'center',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,15,30,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space(4),
  },
  editCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.elev2,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: space(6),
  },
  editTitle: { fontFamily: font.bold, fontSize: 17, color: colors.ink },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: space(3.5), marginTop: space(5) },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginTop: space(2) },
  swatch: { width: 36, height: 36, borderRadius: 18 },
  editActions: { flexDirection: 'row', gap: space(2), marginTop: space(6) },
});
