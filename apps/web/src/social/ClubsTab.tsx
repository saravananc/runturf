import type { ClubDetail, ClubMessage, ClubSummary } from '@runturf/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { get, post } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { CrownIcon, FlagIcon, ShieldIcon } from '../components/icons';
import { Avatar, EmptyState, SectionHeading } from '../components/ui';

export function ClubsTab() {
  const { data: myClub, isLoading } = useQuery({
    queryKey: ['myClub'],
    queryFn: () => get<ClubDetail | null>('/clubs/mine'),
  });

  if (isLoading) return <p className="py-10 text-center text-ink-2">Loading…</p>;
  return myClub ? <MyClub club={myClub} /> : <BrowseClubs />;
}

function ClubBadge({ club, size = 44 }: { club: { tag: string; color: string }; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-xl font-black text-[#0a0f1e]"
      style={{ width: size, height: size, fontSize: size * 0.28, backgroundColor: club.color }}
      aria-hidden="true"
    >
      {club.tag}
    </div>
  );
}

function MyClub({ club }: { club: ClubDetail }) {
  const qc = useQueryClient();
  const leave = useMutation({
    mutationFn: () => post('/clubs/leave'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myClub'] }),
  });

  return (
    <div className="space-y-3">
      <div className="card anim-rise p-4">
        <div className="flex items-center gap-3">
          <ClubBadge club={club} size={48} />
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-extrabold break-words text-ink">{club.name}</h2>
            <p className="truncate text-[12px] text-ink-2">
              {club.description || 'No description'}
            </p>
          </div>
          <button
            onClick={() => leave.mutate()}
            disabled={leave.isPending}
            className="btn btn-danger-soft px-3 py-1.5 text-[12px]"
          >
            Leave
          </button>
        </div>
        <div className="mt-3.5 grid grid-cols-3 gap-2">
          <ClubStat label="Members" value={String(club.memberCount)} />
          <ClubStat label="Turf owned" value={String(club.cellsOwned)} volt />
          <ClubStat label="This week" value={`+${club.weeklyCellsCaptured}`} volt />
        </div>
      </div>

      <ClubChat clubId={club.id} />

      <section>
        <SectionHeading>Members</SectionHeading>
        <div className="space-y-2.5">
          {club.members.map((m) => (
            <div key={m.id} className="card flex items-center gap-3 p-3">
              <Avatar user={m} size={34} />
              <div className="min-w-0 flex-1">
                <span className="text-[14px] font-bold text-ink">{m.displayName}</span>
                {m.role === 'owner' && (
                  <span className="ml-2 inline-flex items-center gap-1 align-middle text-[11px] font-bold text-gold">
                    <CrownIcon size={14} /> owner
                  </span>
                )}
              </div>
              <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-ink-2">
                Lv {m.level} · <FlagIcon size={12} className="text-volt" /> {m.cellsOwned}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ClubChat({ clubId }: { clubId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages } = useQuery({
    queryKey: ['clubChat', clubId],
    queryFn: () => get<ClubMessage[]>(`/clubs/${clubId}/messages`),
    refetchInterval: 5_000,
  });

  const send = useMutation({
    mutationFn: (body: string) => post<ClubMessage>(`/clubs/${clubId}/messages`, { body }),
    onSuccess: () => {
      setDraft('');
      qc.invalidateQueries({ queryKey: ['clubChat', clubId] });
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages?.length]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (draft.trim()) send.mutate(draft);
  }

  return (
    <section className="card overflow-hidden">
      <h3 className="border-b border-white/6 px-4 py-2.5 text-[14px] font-bold text-ink">
        Club chat
      </h3>
      <div className="h-56 space-y-2.5 overflow-y-auto p-3">
        {messages?.length === 0 && (
          <p className="py-8 text-center text-[13px] text-ink-3">Say hello 👋</p>
        )}
        {messages?.map((m) => {
          const mine = m.user.id === user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[13px] leading-snug ${
                  mine
                    ? 'rounded-br-md bg-volt/15 text-ink'
                    : 'rounded-bl-md bg-elev2 text-ink'
                }`}
              >
                {!mine && (
                  <div className="mb-0.5 text-[11px] font-bold" style={{ color: m.user.color }}>
                    {m.user.displayName}
                  </div>
                )}
                {m.body}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={onSubmit} className="flex gap-2 border-t border-white/6 p-3">
        <input
          className="input flex-1 py-2 text-[13px]"
          placeholder="Message your club…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={500}
        />
        <button
          disabled={send.isPending || !draft.trim()}
          className="btn btn-primary px-4 py-2 text-[13px]"
        >
          Send
        </button>
      </form>
    </section>
  );
}

function BrowseClubs() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [error, setError] = useState('');

  const { data: clubs } = useQuery({
    queryKey: ['clubs'],
    queryFn: () => get<ClubSummary[]>('/clubs'),
  });

  const join = useMutation({
    mutationFn: (id: string) => post(`/clubs/${id}/join`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myClub'] }),
  });
  const create = useMutation({
    mutationFn: () => post<ClubDetail>('/clubs', { name, tag }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myClub'] }),
    onError: (e) => setError(e instanceof Error ? e.message : 'Failed to create club'),
  });

  return (
    <div className="space-y-4">
      {creating ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError('');
            create.mutate();
          }}
          className="card anim-pop space-y-2.5 p-4"
        >
          <h3 className="t-section">Create a club</h3>
          <input
            className="input"
            placeholder="Club name (3-32 chars)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            className="input tracking-widest uppercase"
            placeholder="TAG (2-5 letters)"
            value={tag}
            onChange={(e) => setTag(e.target.value.toUpperCase())}
            maxLength={5}
            required
          />
          {error && <p className="text-[13px] font-medium text-ember">{error}</p>}
          <div className="flex gap-2">
            <button disabled={create.isPending} className="btn btn-primary flex-1 py-2.5">
              Create
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="btn btn-ghost px-4 py-2.5"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="w-full rounded-2xl border border-dashed border-white/15 py-3 text-[14px] font-bold text-ink-2 transition-colors hover:border-volt/50 hover:text-volt"
        >
          + Create a club
        </button>
      )}

      <section>
        <SectionHeading>Club rankings</SectionHeading>
        <div className="space-y-2.5">
          {clubs?.length === 0 && (
            <EmptyState
              icon={<ShieldIcon size={32} />}
              title="No clubs yet"
              hint="Start the first one and rally your crew."
            />
          )}
          {clubs?.map((c, i) => (
            <div
              key={c.id}
              className="card anim-rise flex items-center gap-3 p-3"
              style={{ animationDelay: `${Math.min(i * 0.05, 0.3)}s` }}
            >
              <span className="w-5 text-center text-[13px] font-bold text-ink-3">{i + 1}</span>
              <ClubBadge club={c} size={40} />
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-bold break-words text-ink">{c.name}</div>
                <div className="text-[12px] text-ink-3">
                  {c.memberCount} members ·{' '}
                  <span className="font-semibold text-volt">{c.cellsOwned} cells</span> · +
                  {c.weeklyCellsCaptured} this wk
                </div>
              </div>
              <button
                onClick={() => join.mutate(c.id)}
                disabled={join.isPending}
                className="btn btn-ghost px-3.5 py-1.5 text-[13px] text-skyx"
              >
                Join
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ClubStat({ label, value, volt }: { label: string; value: string; volt?: boolean }) {
  return (
    <div className="rounded-xl bg-elev2 px-2 py-2 text-center">
      <div className="t-label">{label}</div>
      <div className={`mt-0.5 text-[15px] font-extrabold tabular-nums ${volt ? 'text-volt' : 'text-ink'}`}>
        {value}
      </div>
    </div>
  );
}
