import type { FriendEntry, FriendRequest, UserPublic } from '@runturf/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { del, get, post } from '../api/client';
import { formatDistance } from '../record/recorder';

export function FriendsTab() {
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');

  const friends = useQuery({
    queryKey: ['friends'],
    queryFn: () => get<FriendEntry[]>('/social/friends'),
  });
  const requests = useQuery({
    queryKey: ['friendRequests'],
    queryFn: () => get<FriendRequest[]>('/social/requests'),
    refetchInterval: 30_000,
  });
  const results = useQuery({
    queryKey: ['userSearch', query],
    queryFn: () => get<UserPublic[]>(`/social/search?q=${encodeURIComponent(query)}`),
    enabled: query.trim().length >= 2,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['friends'] });
    qc.invalidateQueries({ queryKey: ['friendRequests'] });
  };

  const sendRequest = useMutation({
    mutationFn: (username: string) => post('/social/requests', { username }),
    onSuccess: () => {
      setNotice('Request sent!');
      invalidate();
    },
    onError: (e) => setNotice(e instanceof Error ? e.message : 'Failed'),
  });
  const respond = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'accept' | 'decline' }) =>
      post(`/social/requests/${id}/${action}`),
    onSuccess: invalidate,
  });
  const unfriend = useMutation({
    mutationFn: (userId: string) => del(`/social/friends/${userId}`),
    onSuccess: invalidate,
  });

  const incoming = requests.data?.filter((r) => r.direction === 'incoming') ?? [];
  const outgoing = requests.data?.filter((r) => r.direction === 'outgoing') ?? [];

  return (
    <div className="space-y-6">
      <div>
        <input
          className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-slate-100 outline-none focus:border-emerald-400"
          placeholder="Find runners by name…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setNotice('');
          }}
        />
        {notice && <p className="mt-2 text-sm text-emerald-300">{notice}</p>}
        {results.data && results.data.length > 0 && (
          <div className="mt-2 space-y-2">
            {results.data.map((u) => (
              <Row key={u.id} user={u}>
                <button
                  onClick={() => sendRequest.mutate(u.username)}
                  disabled={sendRequest.isPending}
                  className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-emerald-400 disabled:opacity-50"
                >
                  Add friend
                </button>
              </Row>
            ))}
          </div>
        )}
        {results.data?.length === 0 && (
          <p className="mt-2 text-sm text-slate-400">No runners match “{query}”.</p>
        )}
      </div>

      {incoming.length > 0 && (
        <section>
          <h2 className="mb-2 font-bold text-white">Requests</h2>
          <div className="space-y-2">
            {incoming.map((r) => (
              <Row key={r.id} user={r.user}>
                <button
                  onClick={() => respond.mutate({ id: r.id, action: 'accept' })}
                  className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-emerald-400"
                >
                  Accept
                </button>
                <button
                  onClick={() => respond.mutate({ id: r.id, action: 'decline' })}
                  className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-600"
                >
                  Decline
                </button>
              </Row>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-bold text-white">Friends ({friends.data?.length ?? 0})</h2>
        <div className="space-y-2">
          {friends.data?.length === 0 && (
            <p className="text-sm text-slate-400">No friends yet — search above to add some.</p>
          )}
          {friends.data?.map((f) => (
            <Row key={f.user.id} user={f.user} sub={`Lv ${f.level} · ${f.cellsOwned} 🚩 · ${formatDistance(f.totalDistanceM)} total`}>
              <button
                onClick={() => unfriend.mutate(f.user.id)}
                className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-red-500/30 hover:text-red-300"
              >
                Remove
              </button>
            </Row>
          ))}
        </div>
      </section>

      {outgoing.length > 0 && (
        <section>
          <h2 className="mb-2 font-bold text-white">Sent</h2>
          <div className="space-y-2">
            {outgoing.map((r) => (
              <Row key={r.id} user={r.user} sub="Pending…" />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Row({
  user,
  sub,
  children,
}: {
  user: UserPublic;
  sub?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/60 p-3">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-slate-900"
        style={{ backgroundColor: user.color }}
      >
        {user.displayName.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-white">{user.displayName}</div>
        <div className="truncate text-xs text-slate-400">{sub ?? `@${user.username}`}</div>
      </div>
      {children}
    </div>
  );
}
