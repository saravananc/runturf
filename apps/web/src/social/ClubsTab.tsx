import type { ClubDetail, ClubMessage, ClubSummary } from '@runturf/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { get, post } from '../api/client';
import { useAuth } from '../auth/AuthContext';

export function ClubsTab() {
  const { data: myClub, isLoading } = useQuery({
    queryKey: ['myClub'],
    queryFn: () => get<ClubDetail | null>('/clubs/mine'),
  });

  if (isLoading) return <p className="py-10 text-center text-slate-400">Loading…</p>;
  return myClub ? <MyClub club={myClub} /> : <BrowseClubs />;
}

function MyClub({ club }: { club: ClubDetail }) {
  const qc = useQueryClient();
  const leave = useMutation({
    mutationFn: () => post('/clubs/leave'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myClub'] }),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl text-sm font-black text-slate-900"
            style={{ backgroundColor: club.color }}
          >
            {club.tag}
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white">{club.name}</h2>
            <p className="text-xs text-slate-400">{club.description || 'No description'}</p>
          </div>
          <button
            onClick={() => leave.mutate()}
            disabled={leave.isPending}
            className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-red-500/30 hover:text-red-300"
          >
            Leave
          </button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
          <Stat label="Members" value={String(club.memberCount)} />
          <Stat label="Turf owned" value={`${club.cellsOwned} 🚩`} />
          <Stat label="This week" value={`+${club.weeklyCellsCaptured}`} />
        </div>
      </div>

      <ClubChat clubId={club.id} />

      <section>
        <h3 className="mb-2 font-bold text-white">Members</h3>
        <div className="space-y-2">
          {club.members.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/60 p-3"
            >
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-slate-900"
                style={{ backgroundColor: m.color }}
              >
                {m.displayName.slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1">
                <span className="font-semibold text-white">{m.displayName}</span>
                {m.role === 'owner' && <span className="ml-2 text-xs text-amber-300">👑 owner</span>}
              </div>
              <span className="text-sm text-slate-300">
                Lv {m.level} · {m.cellsOwned} 🚩
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
    <section className="rounded-xl border border-slate-700 bg-slate-800/60">
      <h3 className="border-b border-slate-700 px-4 py-2 font-bold text-white">Club chat</h3>
      <div className="h-56 space-y-2 overflow-y-auto p-3">
        {messages?.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-400">Say hello 👋</p>
        )}
        {messages?.map((m) => (
          <div key={m.id} className={m.user.id === user?.id ? 'text-right' : ''}>
            <div
              className={`inline-block max-w-[80%] rounded-xl px-3 py-1.5 text-sm ${
                m.user.id === user?.id
                  ? 'bg-emerald-500/20 text-emerald-100'
                  : 'bg-slate-700 text-slate-100'
              }`}
            >
              {m.user.id !== user?.id && (
                <div className="text-xs font-semibold" style={{ color: m.user.color }}>
                  {m.user.displayName}
                </div>
              )}
              {m.body}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={onSubmit} className="flex gap-2 border-t border-slate-700 p-3">
        <input
          className="min-w-0 flex-1 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400"
          placeholder="Message your club…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={500}
        />
        <button
          disabled={send.isPending || !draft.trim()}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-emerald-400 disabled:opacity-50"
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
          className="space-y-2 rounded-xl border border-slate-700 bg-slate-800/60 p-4"
        >
          <h3 className="font-bold text-white">Create a club</h3>
          <input
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:border-emerald-400"
            placeholder="Club name (3-32 chars)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 tracking-widest text-slate-100 uppercase outline-none focus:border-emerald-400"
            placeholder="TAG (2-5 letters)"
            value={tag}
            onChange={(e) => setTag(e.target.value.toUpperCase())}
            maxLength={5}
            required
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              disabled={create.isPending}
              className="flex-1 rounded-lg bg-emerald-500 py-2 font-semibold text-slate-900 hover:bg-emerald-400 disabled:opacity-50"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="rounded-lg bg-slate-700 px-4 py-2 text-slate-200"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="w-full rounded-xl border border-dashed border-slate-600 py-3 font-semibold text-slate-300 hover:border-emerald-400 hover:text-emerald-300"
        >
          + Create a club
        </button>
      )}

      <section>
        <h3 className="mb-2 font-bold text-white">Club rankings</h3>
        <div className="space-y-2">
          {clubs?.length === 0 && (
            <p className="text-sm text-slate-400">No clubs yet — start the first one!</p>
          )}
          {clubs?.map((c, i) => (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/60 p-3"
            >
              <span className="w-6 text-center font-bold text-slate-400">{i + 1}</span>
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg text-xs font-black text-slate-900"
                style={{ backgroundColor: c.color }}
              >
                {c.tag}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-white">{c.name}</div>
                <div className="text-xs text-slate-400">
                  {c.memberCount} members · {c.cellsOwned} 🚩 · +{c.weeklyCellsCaptured} this week
                </div>
              </div>
              <button
                onClick={() => join.mutate(c.id)}
                disabled={join.isPending}
                className="rounded-lg bg-sky-500 px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-sky-400 disabled:opacity-50"
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-900/60 p-2">
      <div className="text-[10px] tracking-wide text-slate-400 uppercase">{label}</div>
      <div className="text-sm font-bold text-white">{value}</div>
    </div>
  );
}
