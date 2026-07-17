import type { FriendEntry, FriendRequest, UserPublic } from '@runturf/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { del, get, post } from '../api/client';
import { Avatar, SectionHeading } from '../components/ui';
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
          className="input"
          placeholder="Find runners by name…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setNotice('');
          }}
        />
        {notice && (
          <p className="anim-rise mt-2 text-[13px] font-semibold text-volt">{notice}</p>
        )}
        {results.data && results.data.length > 0 && (
          <div className="mt-2.5 space-y-2.5">
            {results.data.map((u) => (
              <Row key={u.id} user={u}>
                <button
                  onClick={() => sendRequest.mutate(u.username)}
                  disabled={sendRequest.isPending}
                  className="btn btn-primary px-3.5 py-1.5 text-[13px]"
                >
                  Add friend
                </button>
              </Row>
            ))}
          </div>
        )}
        {results.data?.length === 0 && (
          <p className="mt-2 text-[13px] text-ink-3">No runners match “{query}”.</p>
        )}
      </div>

      {incoming.length > 0 && (
        <section>
          <SectionHeading>Requests</SectionHeading>
          <div className="space-y-2.5">
            {incoming.map((r) => (
              <Row key={r.id} user={r.user} highlight>
                <button
                  onClick={() => respond.mutate({ id: r.id, action: 'accept' })}
                  className="btn btn-primary px-3.5 py-1.5 text-[13px]"
                >
                  Accept
                </button>
                <button
                  onClick={() => respond.mutate({ id: r.id, action: 'decline' })}
                  className="btn btn-ghost px-3 py-1.5 text-[13px]"
                >
                  Decline
                </button>
              </Row>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionHeading
          action={
            <span className="text-[12px] font-semibold text-ink-3">
              {friends.data?.length ?? 0}
            </span>
          }
        >
          Friends
        </SectionHeading>
        <div className="space-y-2.5">
          {friends.data?.length === 0 && (
            <p className="text-[13px] text-ink-3">No friends yet — search above to add some.</p>
          )}
          {friends.data?.map((f) => (
            <Row
              key={f.user.id}
              user={f.user}
              sub={`Lv ${f.level} · ${f.cellsOwned} cells · ${formatDistance(f.totalDistanceM)} total`}
            >
              <button
                onClick={() => unfriend.mutate(f.user.id)}
                className="btn btn-danger-soft px-3 py-1.5 text-[12px]"
              >
                Remove
              </button>
            </Row>
          ))}
        </div>
      </section>

      {outgoing.length > 0 && (
        <section>
          <SectionHeading>Sent</SectionHeading>
          <div className="space-y-2.5">
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
  highlight,
  children,
}: {
  user: UserPublic;
  sub?: string;
  highlight?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`card flex items-center gap-3 p-3 ${highlight ? 'border-volt/30 bg-volt/5' : ''}`}
    >
      <Avatar user={user} size={36} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-bold text-ink">{user.displayName}</div>
        <div className="truncate text-[12px] text-ink-3">{sub ?? `@${user.username}`}</div>
      </div>
      {children}
    </div>
  );
}
