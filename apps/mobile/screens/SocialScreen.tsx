import type {
  ClubBattle,
  ClubBattleClub,
  ClubDetail,
  ClubInvite,
  ClubMessage,
  ClubSummary,
  FeedItem,
  FriendEntry,
  FriendRequest,
  UserPublic,
} from '@runturf/shared';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '../AuthContext';
import { del, get, post } from '../api';
import {
  Avatar,
  Btn,
  Card,
  Empty,
  ErrorNote,
  Input,
  Loading,
  SectionHeading,
} from '../components/ui';
import { formatDateTime, formatDistance, formatDuration, formatPace } from '../format';
import { colors, font, radius, space, type } from '../theme';

const TABS = ['Feed', 'Friends', 'Clubs'] as const;
type Tab = (typeof TABS)[number];

export function SocialScreen() {
  const [tab, setTab] = useState<Tab>('Feed');
  return (
    <View style={s.flex}>
      <View style={s.segment}>
        {TABS.map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t }}
            style={[s.segmentBtn, tab === t && s.segmentActive]}
          >
            <Text style={[s.segmentText, tab === t && s.segmentTextActive]}>{t}</Text>
          </Pressable>
        ))}
      </View>
      {tab === 'Feed' && <FeedTab />}
      {tab === 'Friends' && <FriendsTab />}
      {tab === 'Clubs' && <ClubsTab />}
    </View>
  );
}

/* ---------- feed ---------- */

function FeedTab() {
  const { user } = useAuth();
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      setItems(await get<FeedItem[]>('/social/feed'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load feed');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!items && !error) return <Loading />;

  return (
    <FlatList
      contentContainerStyle={s.content}
      data={items ?? []}
      keyExtractor={(i) => i.id}
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
      ListHeaderComponent={error ? <ErrorNote message={error} /> : null}
      ListEmptyComponent={
        error ? null : <Empty title="Nothing here yet" hint="Run, or add friends to see activity." />
      }
      ItemSeparatorComponent={() => <View style={{ height: space(2.5) }} />}
      renderItem={({ item }) => (
        <Card>
          <View style={s.row}>
            <Avatar user={item.user} size={38} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.feedLine}>
                <Text style={s.bold}>
                  {item.user.id === user?.id ? 'You' : item.user.displayName}
                </Text>
                <Text style={s.muted}> ran </Text>
                <Text style={s.bold}>{formatDistance(item.distanceM)}</Text>
              </Text>
              <Text style={s.timestamp}>{formatDateTime(item.startedAt)}</Text>
            </View>
            <Text style={s.xp}>+{item.xpGained} XP</Text>
          </View>
          <View style={s.feedMeta}>
            <Text style={s.muted}>{formatDuration(item.durationS)}</Text>
            <Text style={s.dot}>·</Text>
            <Text style={s.muted}>{formatPace(item.avgPaceSPerKm)}/km</Text>
            <View style={{ flex: 1 }} />
            <Text style={s.captured}>🚩 {item.cellsCaptured}</Text>
            {item.cellsStolen > 0 && <Text style={s.stolen}>⚔ {item.cellsStolen}</Text>}
          </View>
        </Card>
      )}
    />
  );
}

/* ---------- friends ---------- */

function FriendsTab() {
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [results, setResults] = useState<UserPublic[]>([]);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setError('');
      const [f, r] = await Promise.all([
        get<FriendEntry[]>('/social/friends'),
        get<FriendRequest[]>('/social/requests'),
      ]);
      setFriends(f);
      setRequests(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load friends');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Debounced search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const id = setTimeout(async () => {
      try {
        setResults(await get<UserPublic[]>(`/social/search?q=${encodeURIComponent(q)}`));
      } catch {
        setResults([]);
      }
    }, 350);
    return () => clearTimeout(id);
  }, [query]);

  async function sendRequest(username: string) {
    try {
      await post('/social/requests', { username });
      setNotice('Request sent!');
      await load();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function respond(id: string, action: 'accept' | 'decline') {
    try {
      await post(`/social/requests/${id}/${action}`);
      await load();
    } catch (err) {
      Alert.alert('Failed', err instanceof Error ? err.message : 'Network error');
    }
  }

  function confirmRemove(entry: FriendEntry) {
    Alert.alert('Remove friend?', entry.user.displayName, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await del(`/social/friends/${entry.user.id}`);
          load();
        },
      },
    ]);
  }

  if (loading) return <Loading />;

  const incoming = requests.filter((r) => r.direction === 'incoming');
  const outgoing = requests.filter((r) => r.direction === 'outgoing');

  return (
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      {error ? <ErrorNote message={error} /> : null}
      <Input
        placeholder="Find runners by name…"
        autoCapitalize="none"
        value={query}
        onChangeText={(t) => {
          setQuery(t);
          setNotice('');
        }}
      />
      {notice ? <Text style={s.notice}>{notice}</Text> : null}

      {results.length > 0 && (
        <View style={{ gap: space(2.5), marginTop: space(2.5) }}>
          {results.map((u) => (
            <Card key={u.id} style={s.row}>
              <Avatar user={u} size={36} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.bold}>{u.displayName}</Text>
                <Text style={s.timestamp}>@{u.username}</Text>
              </View>
              <Btn label="Add" size="sm" onPress={() => sendRequest(u.username)} />
            </Card>
          ))}
        </View>
      )}
      {query.trim().length >= 2 && results.length === 0 && (
        <Text style={s.timestamp}>No runners match “{query.trim()}”.</Text>
      )}

      {incoming.length > 0 && (
        <View style={{ marginTop: space(6) }}>
          <SectionHeading>Requests</SectionHeading>
          <View style={{ gap: space(2.5) }}>
            {incoming.map((r) => (
              <Card key={r.id} style={[s.row, s.highlight]}>
                <Avatar user={r.user} size={36} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.bold}>{r.user.displayName}</Text>
                  <Text style={s.timestamp}>@{r.user.username}</Text>
                </View>
                <Btn label="Accept" size="sm" onPress={() => respond(r.id, 'accept')} />
                <Btn
                  label="Decline"
                  size="sm"
                  variant="ghost"
                  onPress={() => respond(r.id, 'decline')}
                />
              </Card>
            ))}
          </View>
        </View>
      )}

      <View style={{ marginTop: space(6) }}>
        <SectionHeading action={<Text style={s.timestamp}>{friends.length}</Text>}>
          Friends
        </SectionHeading>
        {friends.length === 0 ? (
          <Text style={s.timestamp}>No friends yet — search above to add some.</Text>
        ) : (
          <View style={{ gap: space(2.5) }}>
            {friends.map((f) => (
              <Card key={f.user.id} style={s.row}>
                <Avatar user={f.user} size={36} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.bold}>{f.user.displayName}</Text>
                  <Text style={s.timestamp}>
                    Lv {f.level} · {f.cellsOwned} cells · {formatDistance(f.totalDistanceM)}
                  </Text>
                </View>
                <Btn
                  label="Remove"
                  size="sm"
                  variant="dangerSoft"
                  onPress={() => confirmRemove(f)}
                />
              </Card>
            ))}
          </View>
        )}
      </View>

      {outgoing.length > 0 && (
        <View style={{ marginTop: space(6) }}>
          <SectionHeading>Sent</SectionHeading>
          <View style={{ gap: space(2.5) }}>
            {outgoing.map((r) => (
              <Card key={r.id} style={s.row}>
                <Avatar user={r.user} size={36} />
                <View style={{ flex: 1 }}>
                  <Text style={s.bold}>{r.user.displayName}</Text>
                  <Text style={s.timestamp}>Pending…</Text>
                </View>
              </Card>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

/* ---------- clubs ---------- */

function ClubsTab() {
  const [myClub, setMyClub] = useState<ClubDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      setMyClub(await get<ClubDetail | null>('/clubs/mine'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load clubs');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading) return <Loading />;
  if (error) return <ErrorNote message={error} />;
  return myClub ? <MyClub club={myClub} onChanged={load} /> : <BrowseClubs onJoined={load} />;
}

function MyClub({ club, onChanged }: { club: ClubDetail; onChanged: () => void }) {
  const { user } = useAuth();
  const isOwner = club.myRole === 'owner';
  const [messages, setMessages] = useState<ClubMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [invite, setInvite] = useState('');
  const [notice, setNotice] = useState('');
  const listRef = useRef<FlatList<ClubMessage>>(null);

  async function sendInvite() {
    const username = invite.trim();
    if (!username) return;
    try {
      await post(`/clubs/${club.id}/invites`, { username });
      setNotice('Invite sent!');
      setInvite('');
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not invite');
    }
  }

  function confirmKick(m: { id: string; displayName: string }) {
    Alert.alert('Remove member?', `Kick ${m.displayName} from the club.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Kick',
        style: 'destructive',
        onPress: async () => {
          await del(`/clubs/${club.id}/members/${m.id}`);
          onChanged();
        },
      },
    ]);
  }

  function confirmTransfer(m: { id: string; displayName: string }) {
    Alert.alert('Make owner?', `Hand ownership to ${m.displayName}. You become a member.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Make owner',
        onPress: async () => {
          await post(`/clubs/${club.id}/transfer`, { userId: m.id });
          onChanged();
        },
      },
    ]);
  }

  const loadMessages = useCallback(async () => {
    try {
      setMessages(await get<ClubMessage[]>(`/clubs/${club.id}/messages`));
    } catch {
      /* keep what we have */
    }
  }, [club.id]);

  // Poll chat while the tab is focused.
  useFocusEffect(
    useCallback(() => {
      loadMessages();
      const id = setInterval(loadMessages, 5000);
      return () => clearInterval(id);
    }, [loadMessages]),
  );

  async function send() {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    try {
      await post(`/clubs/${club.id}/messages`, { body });
      setDraft('');
      await loadMessages();
    } catch (err) {
      Alert.alert('Could not send', err instanceof Error ? err.message : 'Network error');
    } finally {
      setSending(false);
    }
  }

  function confirmLeave() {
    Alert.alert('Leave club?', `You will leave ${club.name}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          await post('/clubs/leave');
          onChanged();
        },
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Card>
        <View style={s.row}>
          <View style={[s.clubBadge, { backgroundColor: club.color }]}>
            <Text style={s.clubTag}>{club.tag}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.clubName}>{club.name}</Text>
            <Text style={s.timestamp}>{club.description || 'No description'}</Text>
          </View>
          <Btn label="Leave" size="sm" variant="dangerSoft" onPress={confirmLeave} />
        </View>
        <View style={s.clubStats}>
          <ClubStat label="Members" value={String(club.memberCount)} />
          <ClubStat label="Turf" value={String(club.cellsOwned)} volt />
          <ClubStat label="This week" value={`+${club.weeklyCellsCaptured}`} volt />
        </View>
      </Card>

      <ClubBattles club={club} isOwner={isOwner} />

      <Card style={{ marginTop: space(3), padding: 0, overflow: 'hidden' }}>
        <Text style={s.chatHeader}>Club chat</Text>
        <FlatList
          ref={listRef}
          style={{ height: 220 }}
          contentContainerStyle={{ padding: space(3), gap: space(2) }}
          data={messages}
          keyExtractor={(m) => m.id}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={<Text style={s.chatEmpty}>Say hello 👋</Text>}
          renderItem={({ item }) => {
            const mine = item.user.id === user?.id;
            return (
              <View style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
                <View style={[s.bubble, mine ? s.bubbleMine : s.bubbleOther]}>
                  {!mine && (
                    <Text style={[s.bubbleAuthor, { color: item.user.color }]}>
                      {item.user.displayName}
                    </Text>
                  )}
                  <Text style={s.bubbleText}>{item.body}</Text>
                </View>
              </View>
            );
          }}
        />
        <View style={s.chatInputRow}>
          <Input
            style={{ flex: 1 }}
            placeholder="Message your club…"
            value={draft}
            onChangeText={setDraft}
            maxLength={500}
            onSubmitEditing={send}
            returnKeyType="send"
          />
          <Btn label="Send" size="sm" disabled={sending || !draft.trim()} onPress={send} />
        </View>
      </Card>

      {isOwner && (
        <Card style={{ marginTop: space(3) }}>
          <SectionHeading>Invite a runner</SectionHeading>
          <View style={{ flexDirection: 'row', gap: space(2) }}>
            <Input
              style={{ flex: 1 }}
              placeholder="Username"
              autoCapitalize="none"
              value={invite}
              onChangeText={(t) => {
                setInvite(t);
                setNotice('');
              }}
              onSubmitEditing={sendInvite}
            />
            <Btn label="Invite" size="sm" disabled={!invite.trim()} onPress={sendInvite} />
          </View>
          {notice ? <Text style={s.notice}>{notice}</Text> : null}
        </Card>
      )}

      <View style={{ marginTop: space(6) }}>
        <SectionHeading>Members</SectionHeading>
        <View style={{ gap: space(2.5) }}>
          {club.members.map((m) => {
            const canModerate = isOwner && m.id !== user?.id;
            return (
              <Card key={m.id} style={s.row}>
                <Avatar user={m} size={34} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.bold}>
                    {m.displayName}
                    {m.role === 'owner' ? '  👑' : ''}
                  </Text>
                  <Text style={s.timestamp}>
                    Lv {m.level} · {m.cellsOwned} 🚩
                  </Text>
                </View>
                {canModerate && (
                  <View style={{ flexDirection: 'row', gap: space(1.5) }}>
                    <Btn label="👑" size="sm" variant="ghost" onPress={() => confirmTransfer(m)} />
                    <Btn label="Kick" size="sm" variant="dangerSoft" onPress={() => confirmKick(m)} />
                  </View>
                )}
              </Card>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

function BrowseClubs({ onJoined }: { onJoined: () => void }) {
  const [clubs, setClubs] = useState<ClubSummary[]>([]);
  const [invites, setInvites] = useState<ClubInvite[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, inv] = await Promise.all([
        get<ClubSummary[]>('/clubs'),
        get<ClubInvite[]>('/clubs/invites'),
      ]);
      setClubs(c);
      setInvites(inv);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load clubs');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function respondInvite(id: string, action: 'accept' | 'decline') {
    try {
      await post(`/clubs/invites/${id}/${action}`);
      onJoined();
    } catch (err) {
      Alert.alert('Failed', err instanceof Error ? err.message : 'Network error');
    }
  }

  async function create() {
    setBusy(true);
    setError('');
    try {
      await post('/clubs', { name: name.trim(), tag: tag.trim().toUpperCase() });
      onJoined();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create club');
    } finally {
      setBusy(false);
    }
  }

  async function join(id: string) {
    try {
      await post(`/clubs/${id}/join`);
      onJoined();
    } catch (err) {
      Alert.alert('Could not join', err instanceof Error ? err.message : 'Network error');
    }
  }

  return (
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      {invites.length > 0 && (
        <View style={{ marginBottom: space(5) }}>
          <SectionHeading>Invites</SectionHeading>
          <View style={{ gap: space(2.5) }}>
            {invites.map((inv) => (
              <Card key={inv.id} style={[s.row, s.highlight]}>
                <View style={[s.clubBadge, { backgroundColor: inv.club.color, width: 40, height: 40 }]}>
                  <Text style={[s.clubTag, { fontSize: 11 }]}>{inv.club.tag}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.bold}>{inv.club.name}</Text>
                  <Text style={s.timestamp}>Invited by {inv.inviter.displayName}</Text>
                </View>
                <Btn label="Accept" size="sm" onPress={() => respondInvite(inv.id, 'accept')} />
                <Btn
                  label="Decline"
                  size="sm"
                  variant="ghost"
                  onPress={() => respondInvite(inv.id, 'decline')}
                />
              </Card>
            ))}
          </View>
        </View>
      )}

      {creating ? (
        <Card style={{ gap: space(2.5) }}>
          <Text style={s.bold}>Create a club</Text>
          <Input placeholder="Club name (3-32 chars)" value={name} onChangeText={setName} />
          <Input
            placeholder="TAG (2-5 letters)"
            value={tag}
            onChangeText={(t) => setTag(t.toUpperCase())}
            maxLength={5}
            autoCapitalize="characters"
          />
          {error ? <ErrorNote message={error} /> : null}
          <View style={{ flexDirection: 'row', gap: space(2) }}>
            <Btn
              label="Cancel"
              variant="ghost"
              onPress={() => setCreating(false)}
              style={{ flex: 1 }}
            />
            <Btn
              label={busy ? 'Creating…' : 'Create'}
              disabled={busy || name.trim().length < 3 || tag.trim().length < 2}
              onPress={create}
              style={{ flex: 1 }}
            />
          </View>
        </Card>
      ) : (
        <Btn label="+ Create a club" variant="ghost" onPress={() => setCreating(true)} />
      )}

      <View style={{ marginTop: space(5) }}>
        <SectionHeading>Club rankings</SectionHeading>
        {clubs.length === 0 ? (
          <Empty title="No clubs yet" hint="Start the first one and rally your crew." />
        ) : (
          <View style={{ gap: space(2.5) }}>
            {clubs.map((c, i) => (
              <Card key={c.id} style={s.row}>
                <Text style={s.rank}>{i + 1}</Text>
                <View style={[s.clubBadge, { backgroundColor: c.color, width: 40, height: 40 }]}>
                  <Text style={[s.clubTag, { fontSize: 11 }]}>{c.tag}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.bold}>{c.name}</Text>
                  <Text style={s.timestamp}>
                    {c.memberCount} members · {c.cellsOwned} 🚩 · +{c.weeklyCellsCaptured} wk
                  </Text>
                </View>
                <Btn label="Join" size="sm" variant="ghost" onPress={() => join(c.id)} />
              </Card>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function ClubStat({ label, value, volt }: { label: string; value: string; volt?: boolean }) {
  return (
    <View style={s.clubStat}>
      <Text style={s.clubStatLabel}>{label.toUpperCase()}</Text>
      <Text style={[s.clubStatValue, volt && { color: colors.volt }]}>{value}</Text>
    </View>
  );
}

function battleTimeLeft(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return 'ending…';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

function BattleSide({ club, score }: { club: ClubBattleClub; score: number }) {
  return (
    <View style={s.battleSide}>
      <View style={[s.battleBadge, { backgroundColor: club.color }]}>
        <Text style={s.battleBadgeTag}>{club.tag}</Text>
      </View>
      <Text style={s.battleScore}>{score}</Text>
    </View>
  );
}

function ClubBattles({ club, isOwner }: { club: ClubDetail; isOwner: boolean }) {
  const [battles, setBattles] = useState<ClubBattle[]>([]);
  const [others, setOthers] = useState<ClubSummary[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setBattles(await get<ClubBattle[]>(`/clubs/${club.id}/battles`));
    } catch {
      /* keep what we have */
    }
  }, [club.id]);

  useFocusEffect(
    useCallback(() => {
      load();
      if (isOwner) {
        get<ClubSummary[]>('/clubs')
          .then((cs) => setOthers(cs.filter((c) => c.id !== club.id)))
          .catch(() => {});
      }
      const id = setInterval(load, 10_000);
      return () => clearInterval(id);
    }, [load, isOwner, club.id]),
  );

  async function propose(opponentClubId: string) {
    setBusy(true);
    try {
      await post('/clubs/battles', { opponentClubId, durationHours: 24 });
      await load();
    } catch (e) {
      Alert.alert('Could not start battle', e instanceof Error ? e.message : 'Network error');
    } finally {
      setBusy(false);
    }
  }

  async function respond(id: string, accept: boolean) {
    setBusy(true);
    try {
      await post(`/clubs/battles/${id}/respond`, { accept });
      await load();
    } catch (e) {
      Alert.alert('Failed', e instanceof Error ? e.message : 'Network error');
    } finally {
      setBusy(false);
    }
  }

  const active = battles.filter((b) => b.status === 'active');
  const proposed = battles.filter((b) => b.status === 'proposed');
  const finished = battles.filter((b) => b.status === 'finished').slice(0, 5);
  // Clubs already tied up in an open battle with us can't be challenged again.
  const engaged = new Set(
    battles
      .filter((b) => b.status === 'proposed' || b.status === 'active')
      .flatMap((b) => [b.challenger.id, b.opponent.id]),
  );
  const challengeable = others.filter((c) => !engaged.has(c.id)).slice(0, 4);

  function BattleCard({ b }: { b: ClubBattle }) {
    const canRespond = isOwner && b.status === 'proposed' && b.opponent.id === club.id;
    const iAmChallenger = b.challenger.id === club.id;
    const won = b.status === 'finished' && b.winnerClubId === club.id;
    const lost = b.status === 'finished' && !!b.winnerClubId && b.winnerClubId !== club.id;
    const tie = b.status === 'finished' && !b.winnerClubId;
    return (
      <View style={s.battleCard}>
        <View style={s.battleRow}>
          <BattleSide club={b.challenger} score={b.challengerScore} />
          <Text style={s.battleVs}>VS</Text>
          <BattleSide club={b.opponent} score={b.opponentScore} />
        </View>
        <Text
          style={[
            s.battleStatus,
            b.status === 'active' && { color: colors.volt },
            won && { color: colors.gold },
          ]}
        >
          {b.status === 'active' && b.endsAt && `● Live · ${battleTimeLeft(b.endsAt)}`}
          {b.status === 'proposed' && (iAmChallenger ? 'Awaiting their answer' : 'Challenge received')}
          {won && '🏆 Your club won — +100 coins each'}
          {lost && 'Defeated'}
          {tie && 'Tie — no winner'}
        </Text>
        {canRespond && (
          <View style={s.battleActions}>
            <Btn label="Accept" size="sm" disabled={busy} onPress={() => respond(b.id, true)} />
            <Btn
              label="Decline"
              size="sm"
              variant="ghost"
              disabled={busy}
              onPress={() => respond(b.id, false)}
            />
          </View>
        )}
      </View>
    );
  }

  return (
    <Card style={{ marginTop: space(3) }}>
      <Text style={s.battleTitle}>Turf wars</Text>
      {isOwner && challengeable.length > 0 && (
        <View style={{ gap: space(2), marginBottom: space(2) }}>
          {challengeable.map((c) => (
            <View key={c.id} style={s.challengeRow}>
              <View style={[s.battleBadge, { backgroundColor: c.color }]}>
                <Text style={s.battleBadgeTag}>{c.tag}</Text>
              </View>
              <Text style={s.challengeName} numberOfLines={1}>
                {c.name}
              </Text>
              <Btn label="⚔ 24h" size="sm" disabled={busy} onPress={() => propose(c.id)} />
            </View>
          ))}
        </View>
      )}
      {[...active, ...proposed, ...finished].map((b) => (
        <BattleCard key={b.id} b={b} />
      ))}
      {battles.length === 0 && challengeable.length === 0 && (
        <Text style={s.timestamp}>
          {isOwner ? 'Challenge a rival club to a turf war.' : 'No battles yet.'}
        </Text>
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.base },
  content: { padding: space(4), paddingBottom: space(10) },
  segment: {
    flexDirection: 'row',
    gap: space(1),
    margin: space(3),
    marginBottom: 0,
    padding: space(1),
    backgroundColor: colors.elev1,
    borderRadius: radius.ctl,
  },
  segmentBtn: { flex: 1, paddingVertical: space(2), borderRadius: radius.ctl - 2, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.elev3 },
  segmentText: { fontFamily: font.bold, fontSize: type.small, color: colors.ink3 },
  segmentTextActive: { color: colors.ink },

  row: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  bold: { fontFamily: font.bold, fontSize: type.small, color: colors.ink },
  muted: { fontFamily: font.regular, fontSize: type.small, color: colors.ink2 },
  timestamp: { fontFamily: font.regular, fontSize: type.caption, color: colors.ink3 },
  notice: { fontFamily: font.semibold, fontSize: type.caption, color: colors.volt, marginTop: space(2) },
  feedLine: { fontFamily: font.regular, fontSize: type.small, color: colors.ink },
  feedMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(1.5),
    marginTop: space(3),
    paddingTop: space(2.5),
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dot: { color: colors.ink3 },
  xp: { fontFamily: font.bold, fontSize: type.small, color: colors.volt },
  captured: { fontFamily: font.semibold, fontSize: type.small, color: colors.volt },
  stolen: {
    fontFamily: font.semibold,
    fontSize: type.small,
    color: colors.ember,
    marginLeft: space(2),
  },
  highlight: { borderColor: 'rgba(173,235,46,0.3)', backgroundColor: 'rgba(173,235,46,0.05)' },
  rank: { width: 20, textAlign: 'center', fontFamily: font.bold, fontSize: type.small, color: colors.ink3 },

  clubBadge: { width: 48, height: 48, borderRadius: radius.ctl, alignItems: 'center', justifyContent: 'center' },
  clubTag: { fontFamily: font.extrabold, fontSize: 13, color: colors.base },
  clubName: { fontFamily: font.extrabold, fontSize: 17, color: colors.ink },
  clubStats: { flexDirection: 'row', gap: space(2), marginTop: space(3.5) },
  clubStat: {
    flex: 1,
    backgroundColor: colors.elev2,
    borderRadius: radius.ctl,
    paddingVertical: space(2),
    alignItems: 'center',
  },
  clubStatLabel: { fontFamily: font.semibold, fontSize: type.label, letterSpacing: 0.9, color: colors.ink3 },
  clubStatValue: { fontFamily: font.extrabold, fontSize: type.body, color: colors.ink },

  battleTitle: { fontFamily: font.bold, fontSize: type.small, color: colors.ink, marginBottom: space(2) },
  battleCard: {
    backgroundColor: colors.elev2,
    borderRadius: radius.ctl,
    padding: space(3),
    marginTop: space(2),
  },
  battleRow: { flexDirection: 'row', alignItems: 'center' },
  battleSide: { flex: 1, alignItems: 'center', gap: space(1) },
  battleBadge: { width: 30, height: 30, borderRadius: radius.ctl, alignItems: 'center', justifyContent: 'center' },
  battleBadgeTag: { fontFamily: font.extrabold, fontSize: 11, color: colors.base },
  battleScore: { fontFamily: font.extrabold, fontSize: 16, color: colors.volt },
  battleVs: { fontFamily: font.extrabold, fontSize: type.label, color: colors.ink3, marginHorizontal: space(2) },
  battleStatus: {
    fontFamily: font.semibold,
    fontSize: type.label,
    color: colors.ink3,
    textAlign: 'center',
    marginTop: space(2),
  },
  battleActions: { flexDirection: 'row', gap: space(2), justifyContent: 'center', marginTop: space(2) },
  challengeRow: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  challengeName: { flex: 1, fontFamily: font.semibold, fontSize: type.small, color: colors.ink },

  chatHeader: {
    fontFamily: font.bold,
    fontSize: type.small,
    color: colors.ink,
    padding: space(3.5),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  chatEmpty: {
    fontFamily: font.regular,
    fontSize: type.caption,
    color: colors.ink3,
    textAlign: 'center',
    paddingVertical: space(8),
  },
  bubble: { maxWidth: '82%', borderRadius: 16, paddingHorizontal: space(3.5), paddingVertical: space(2) },
  bubbleMine: { backgroundColor: 'rgba(173,235,46,0.15)', borderBottomRightRadius: 6 },
  bubbleOther: { backgroundColor: colors.elev2, borderBottomLeftRadius: 6 },
  bubbleAuthor: { fontFamily: font.bold, fontSize: type.label, marginBottom: 2 },
  bubbleText: { fontFamily: font.regular, fontSize: type.small, color: colors.ink },
  chatInputRow: {
    flexDirection: 'row',
    gap: space(2),
    padding: space(3),
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
});
