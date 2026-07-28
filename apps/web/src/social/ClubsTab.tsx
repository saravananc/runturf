import type {
  ClubBattle,
  ClubBattleClub,
  ClubDetail,
  ClubEvent,
  ClubInvite,
  ClubMessage,
  ClubSummary,
} from '@runturf/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { del, get, post } from '../api/client';
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
  const { user } = useAuth();
  const isOwner = club.myRole === 'owner';
  const [invite, setInvite] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = () => qc.invalidateQueries({ queryKey: ['myClub'] });
  const leave = useMutation({ mutationFn: () => post('/clubs/leave'), onSuccess: refresh });
  const inviteMut = useMutation({
    mutationFn: (username: string) => post(`/clubs/${club.id}/invites`, { username }),
    onSuccess: () => {
      setNotice('Invite sent!');
      setInvite('');
    },
    onError: (e) => setNotice(e instanceof Error ? e.message : 'Could not invite'),
  });
  const kick = useMutation({
    mutationFn: (userId: string) => del(`/clubs/${club.id}/members/${userId}`),
    onSuccess: refresh,
  });
  const transfer = useMutation({
    mutationFn: (userId: string) => post(`/clubs/${club.id}/transfer`, { userId }),
    onSuccess: refresh,
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

      {isOwner && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (invite.trim()) inviteMut.mutate(invite.trim());
          }}
          className="card p-3"
        >
          <SectionHeading>Invite a runner</SectionHeading>
          <div className="flex gap-2">
            <input
              className="input flex-1 py-2 text-[13px]"
              placeholder="Username"
              value={invite}
              onChange={(e) => {
                setInvite(e.target.value);
                setNotice('');
              }}
            />
            <button
              disabled={inviteMut.isPending || !invite.trim()}
              className="btn btn-primary px-4 py-2 text-[13px]"
            >
              Invite
            </button>
          </div>
          {notice && <p className="mt-2 text-[12px] font-semibold text-volt">{notice}</p>}
        </form>
      )}

      <ClubBattles club={club} isOwner={isOwner} />

      <ClubEvents clubId={club.id} isOwner={isOwner} />

      <ClubChat clubId={club.id} />

      <section>
        <SectionHeading>Members</SectionHeading>
        <div className="space-y-2.5">
          {club.members.map((m) => {
            const isSelf = m.id === user?.id;
            const canModerate = isOwner && !isSelf;
            return (
              <div key={m.id} className="card flex items-center gap-3 p-3">
                <Avatar user={m} size={34} />
                <div className="min-w-0 flex-1">
                  <span className="text-[14px] font-bold text-ink">{m.displayName}</span>
                  {m.role === 'owner' && (
                    <span className="ml-2 inline-flex items-center gap-1 align-middle text-[11px] font-bold text-gold">
                      <CrownIcon size={14} /> owner
                    </span>
                  )}
                  <div className="text-[12px] text-ink-3">
                    Lv {m.level} · {m.cellsOwned} cells
                  </div>
                </div>
                {canModerate ? (
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      onClick={() => transfer.mutate(m.id)}
                      disabled={transfer.isPending}
                      title="Make owner"
                      className="btn btn-ghost px-2.5 py-1.5 text-[12px] text-gold"
                    >
                      <CrownIcon size={14} />
                    </button>
                    <button
                      onClick={() => kick.mutate(m.id)}
                      disabled={kick.isPending}
                      className="btn btn-danger-soft px-2.5 py-1.5 text-[12px]"
                    >
                      Kick
                    </button>
                  </div>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-ink-2">
                    <FlagIcon size={12} className="text-volt" /> {m.cellsOwned}
                  </span>
                )}
              </div>
            );
          })}
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

  const invites = useQuery({
    queryKey: ['clubInvites'],
    queryFn: () => get<ClubInvite[]>('/clubs/invites'),
    refetchInterval: 30_000,
  });

  const refreshClub = () => {
    qc.invalidateQueries({ queryKey: ['myClub'] });
    qc.invalidateQueries({ queryKey: ['clubInvites'] });
  };
  const join = useMutation({
    mutationFn: (id: string) => post(`/clubs/${id}/join`),
    onSuccess: refreshClub,
  });
  const respondInvite = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'accept' | 'decline' }) =>
      post(`/clubs/invites/${id}/${action}`),
    onSuccess: refreshClub,
  });
  const create = useMutation({
    mutationFn: () => post<ClubDetail>('/clubs', { name, tag }),
    onSuccess: refreshClub,
    onError: (e) => setError(e instanceof Error ? e.message : 'Failed to create club'),
  });

  return (
    <div className="space-y-4">
      {invites.data && invites.data.length > 0 && (
        <section>
          <SectionHeading>Invites</SectionHeading>
          <div className="space-y-2.5">
            {invites.data.map((inv) => (
              <div key={inv.id} className="card flex items-center gap-3 border-volt/30 bg-volt/5 p-3">
                <ClubBadge club={inv.club} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-bold text-ink">{inv.club.name}</div>
                  <div className="text-[12px] text-ink-3">
                    Invited by {inv.inviter.displayName}
                  </div>
                </div>
                <button
                  onClick={() => respondInvite.mutate({ id: inv.id, action: 'accept' })}
                  disabled={respondInvite.isPending}
                  className="btn btn-primary px-3.5 py-1.5 text-[13px]"
                >
                  Accept
                </button>
                <button
                  onClick={() => respondInvite.mutate({ id: inv.id, action: 'decline' })}
                  disabled={respondInvite.isPending}
                  className="btn btn-ghost px-3 py-1.5 text-[13px]"
                >
                  Decline
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

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

/* ---------- battles ---------- */

function timeLeft(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return 'ending…';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

function BattleSide({ club, score, right }: { club: ClubBattleClub; score: number; right?: boolean }) {
  return (
    <div className={`flex min-w-0 flex-1 items-center gap-2 ${right ? 'flex-row-reverse text-right' : ''}`}>
      <ClubBadge club={club} size={28} />
      <div className="min-w-0">
        <div className="truncate text-[12px] font-bold text-ink">{club.name}</div>
        <div className="text-[16px] font-extrabold tabular-nums text-volt">{score}</div>
      </div>
    </div>
  );
}

function BattleCard({
  club,
  battle,
  action,
}: {
  club: ClubDetail;
  battle: ClubBattle;
  action?: { accept: () => void; decline: () => void; pending: boolean };
}) {
  const iAmChallenger = battle.challenger.id === club.id;
  const won = battle.status === 'finished' && battle.winnerClubId === club.id;
  const lost =
    battle.status === 'finished' && !!battle.winnerClubId && battle.winnerClubId !== club.id;
  const tie = battle.status === 'finished' && !battle.winnerClubId;

  return (
    <div className="rounded-xl bg-elev2 p-3">
      <div className="flex items-center gap-2">
        <BattleSide club={battle.challenger} score={battle.challengerScore} />
        <span className="shrink-0 text-[11px] font-black text-ink-3">VS</span>
        <BattleSide club={battle.opponent} score={battle.opponentScore} right />
      </div>
      <div className="mt-2 text-center text-[11px] font-semibold">
        {battle.status === 'active' && battle.endsAt && (
          <span className="text-volt">● Live · {timeLeft(battle.endsAt)}</span>
        )}
        {battle.status === 'proposed' && (
          <span className="text-ink-3">
            {iAmChallenger ? 'Awaiting their answer' : 'Challenge received'}
          </span>
        )}
        {won && <span className="text-gold">🏆 Your club won — +100 coins each</span>}
        {lost && <span className="text-ink-3">Defeated</span>}
        {tie && <span className="text-ink-3">Tie — no winner</span>}
      </div>
      {action && (
        <div className="mt-2.5 flex gap-2">
          <button
            onClick={action.accept}
            disabled={action.pending}
            className="btn btn-primary flex-1 py-1.5 text-[12px]"
          >
            Accept
          </button>
          <button
            onClick={action.decline}
            disabled={action.pending}
            className="btn btn-ghost flex-1 py-1.5 text-[12px]"
          >
            Decline
          </button>
        </div>
      )}
    </div>
  );
}

function ProposeBattle({ club, onProposed }: { club: ClubDetail; onProposed: () => void }) {
  const [opponent, setOpponent] = useState('');
  const [hours, setHours] = useState(24);
  const [error, setError] = useState('');
  const { data: clubs } = useQuery({ queryKey: ['clubs'], queryFn: () => get<ClubSummary[]>('/clubs') });
  const others = clubs?.filter((c) => c.id !== club.id) ?? [];

  const propose = useMutation({
    mutationFn: () => post('/clubs/battles', { opponentClubId: opponent, durationHours: hours }),
    onSuccess: () => {
      setOpponent('');
      onProposed();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not start the battle'),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError('');
        if (opponent) propose.mutate();
      }}
      className="space-y-2"
    >
      <div className="flex gap-2">
        <select
          className="input flex-1 py-2 text-[13px]"
          value={opponent}
          onChange={(e) => {
            setOpponent(e.target.value);
            setError('');
          }}
        >
          <option value="">Challenge a club…</option>
          {others.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className="input py-2 text-[13px]"
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
        >
          <option value={24}>24h</option>
          <option value={48}>48h</option>
          <option value={72}>72h</option>
          <option value={168}>7d</option>
        </select>
        <button
          disabled={propose.isPending || !opponent}
          className="btn btn-primary px-4 py-2 text-[13px]"
        >
          Go
        </button>
      </div>
      {error && <p className="text-[12px] font-medium text-ember">{error}</p>}
    </form>
  );
}

function ClubBattles({ club, isOwner }: { club: ClubDetail; isOwner: boolean }) {
  const qc = useQueryClient();
  const { data: battles } = useQuery({
    queryKey: ['clubBattles', club.id],
    queryFn: () => get<ClubBattle[]>(`/clubs/${club.id}/battles`),
    refetchInterval: 10_000, // keep live scores and remaining time fresh
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['clubBattles', club.id] });
  const respond = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      post(`/clubs/battles/${id}/respond`, { accept }),
    onSuccess: refresh,
  });

  const active = battles?.filter((b) => b.status === 'active') ?? [];
  const proposed = battles?.filter((b) => b.status === 'proposed') ?? [];
  const finished = (battles?.filter((b) => b.status === 'finished') ?? []).slice(0, 5);

  return (
    <section className="card space-y-2.5 p-3">
      <SectionHeading>Turf wars</SectionHeading>
      {isOwner && <ProposeBattle club={club} onProposed={refresh} />}
      {active.map((b) => (
        <BattleCard key={b.id} club={club} battle={b} />
      ))}
      {proposed.map((b) => {
        const canRespond = isOwner && b.opponent.id === club.id;
        return (
          <BattleCard
            key={b.id}
            club={club}
            battle={b}
            action={
              canRespond
                ? {
                    accept: () => respond.mutate({ id: b.id, accept: true }),
                    decline: () => respond.mutate({ id: b.id, accept: false }),
                    pending: respond.isPending,
                  }
                : undefined
            }
          />
        );
      })}
      {finished.map((b) => (
        <BattleCard key={b.id} club={club} battle={b} />
      ))}
      {battles && battles.length === 0 && (
        <p className="py-1 text-[12px] text-ink-3">
          {isOwner ? 'Challenge a rival club to a turf war.' : 'No battles yet.'}
        </p>
      )}
    </section>
  );
}

/* ---------- events ---------- */

function formatEventTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function ClubEvents({ clubId, isOwner }: { clubId: string; isOwner: boolean }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const { data: events } = useQuery({
    queryKey: ['clubEvents', clubId],
    queryFn: () => get<ClubEvent[]>(`/clubs/${clubId}/events`),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['clubEvents', clubId] });

  const rsvp = useMutation({
    mutationFn: ({ id, going }: { id: string; going: boolean }) =>
      post(`/clubs/events/${id}/rsvp`, { going }),
    onSuccess: refresh,
  });
  const cancel = useMutation({
    mutationFn: (id: string) => del(`/clubs/events/${id}`),
    onSuccess: refresh,
  });

  return (
    <section className="mt-6">
      <SectionHeading
        action={
          isOwner ? (
            <button
              onClick={() => setAdding((v) => !v)}
              className="text-[12px] font-semibold text-volt"
            >
              {adding ? 'Cancel' : '+ Schedule'}
            </button>
          ) : undefined
        }
      >
        Events
      </SectionHeading>

      {adding && (
        <NewEventForm
          clubId={clubId}
          onCreated={() => {
            setAdding(false);
            refresh();
          }}
        />
      )}

      {events?.length === 0 && !adding && (
        <p className="text-[13px] text-ink-3">
          {isOwner ? 'No events yet — schedule a group run.' : 'No events scheduled yet.'}
        </p>
      )}

      <div className="space-y-2.5">
        {events?.map((e) => (
          <div key={e.id} className={`card p-3.5 ${e.cancelled ? 'opacity-60' : ''}`}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[14px] font-bold text-ink">
                {e.title}
                {e.cancelled && <span className="ml-2 text-[11px] text-ember">Cancelled</span>}
              </span>
              <span className="shrink-0 text-[12px] font-semibold text-volt">
                {e.goingCount} going
              </span>
            </div>
            <div className="mt-0.5 text-[12px] text-ink-2">
              {formatEventTime(e.startsAt)}
              {e.location && ` · ${e.location}`}
            </div>
            {e.description && <p className="mt-1.5 text-[13px] text-ink-2">{e.description}</p>}

            {!e.cancelled && (
              <div className="mt-2.5 flex gap-2">
                <button
                  onClick={() => rsvp.mutate({ id: e.id, going: true })}
                  disabled={rsvp.isPending}
                  className={`btn flex-1 py-1.5 text-[12px] ${
                    e.myRsvp === true ? 'btn-primary' : 'btn-ghost'
                  }`}
                >
                  Going
                </button>
                <button
                  onClick={() => rsvp.mutate({ id: e.id, going: false })}
                  disabled={rsvp.isPending}
                  className={`btn flex-1 py-1.5 text-[12px] ${
                    e.myRsvp === false ? 'btn-primary' : 'btn-ghost'
                  }`}
                >
                  Can't make it
                </button>
                {isOwner && (
                  <button
                    onClick={() => cancel.mutate(e.id)}
                    disabled={cancel.isPending}
                    className="btn btn-ghost px-3 py-1.5 text-[12px] text-ember"
                  >
                    Cancel
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function NewEventForm({ clubId, onCreated }: { clubId: string; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [error, setError] = useState('');

  const create = useMutation({
    // datetime-local has no timezone; the Date round-trip attaches the local one.
    mutationFn: () =>
      post(`/clubs/${clubId}/events`, {
        title,
        location: location || undefined,
        description: description || undefined,
        startsAt: new Date(startsAt).toISOString(),
      }),
    onSuccess: onCreated,
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not schedule that'),
  });

  return (
    <form
      onSubmit={(ev: FormEvent) => {
        ev.preventDefault();
        setError('');
        create.mutate();
      }}
      className="card mb-2.5 space-y-2.5 p-4"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (e.g. Saturday long run)"
        className="input w-full"
        maxLength={80}
      />
      <input
        type="datetime-local"
        value={startsAt}
        onChange={(e) => setStartsAt(e.target.value)}
        className="input w-full"
      />
      <input
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder="Where to meet (optional)"
        className="input w-full"
        maxLength={120}
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Details (optional)"
        className="input w-full"
        rows={2}
        maxLength={500}
      />
      {error && <p className="text-[12px] font-semibold text-ember">{error}</p>}
      <button
        type="submit"
        disabled={create.isPending || title.trim().length < 3 || !startsAt}
        className="btn btn-primary w-full py-2 text-[13px]"
      >
        {create.isPending ? 'Scheduling…' : 'Schedule event'}
      </button>
    </form>
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
