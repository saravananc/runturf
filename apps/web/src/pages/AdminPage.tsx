import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, del, get, post } from '../api/client';
import { SectionHeading, StatTile } from '../components/ui';

interface Overview {
  users: number;
  runs: number;
  cells: number;
  activeBattles: number;
}

export function AdminPage() {
  const qc = useQueryClient();
  const { data, error, isLoading } = useQuery({
    queryKey: ['adminOverview'],
    queryFn: () => get<Overview>('/admin/overview'),
    retry: false,
  });
  const [wipeId, setWipeId] = useState('');
  const [msg, setMsg] = useState('');

  const decay = useMutation({
    mutationFn: () => post<{ removed: number }>('/admin/territory/decay'),
    onSuccess: (r) => {
      setMsg(`Decay sweep removed ${r.removed} cell${r.removed === 1 ? '' : 's'}.`);
      qc.invalidateQueries({ queryKey: ['adminOverview'] });
    },
  });
  const wipe = useMutation({
    mutationFn: (id: string) => del<{ removed: number }>(`/admin/users/${id}/territory`),
    onSuccess: (r) => {
      setMsg(`Cleared ${r.removed} cell${r.removed === 1 ? '' : 's'}.`);
      setWipeId('');
      qc.invalidateQueries({ queryKey: ['adminOverview'] });
    },
    onError: (e) => setMsg(e instanceof Error ? e.message : 'Failed'),
  });

  if (isLoading) return <div className="p-4 text-ink-2">Loading…</div>;
  if (error instanceof ApiError && error.status === 403) {
    return <div className="mx-auto max-w-lg p-4 text-ink-2">You don't have admin access.</div>;
  }

  return (
    <div className="mx-auto h-full w-full max-w-lg overflow-y-auto p-4 pb-8">
      <h1 className="t-title text-ink">Admin</h1>
      <p className="mt-0.5 text-[13px] text-ink-2">Site overview and moderation tools</p>

      {data && (
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <StatTile label="Users" value={data.users} tone="volt" />
          <StatTile label="Runs" value={data.runs} tone="volt" />
          <StatTile label="Owned cells" value={data.cells} tone="volt" />
          <StatTile label="Active battles" value={data.activeBattles} tone="volt" />
        </div>
      )}

      <div className="mt-6">
        <SectionHeading>Territory</SectionHeading>
        <button
          onClick={() => decay.mutate()}
          disabled={decay.isPending}
          className="btn btn-ghost w-full py-3"
        >
          {decay.isPending ? 'Running…' : 'Run decay sweep now'}
        </button>
      </div>

      <div className="mt-4">
        <SectionHeading>Clear a user's territory</SectionHeading>
        <div className="flex gap-2">
          <input
            value={wipeId}
            onChange={(e) => setWipeId(e.target.value.trim())}
            placeholder="user id (UUID)"
            className="input flex-1"
          />
          <button
            onClick={() => wipe.mutate(wipeId)}
            disabled={!wipeId || wipe.isPending}
            className="btn btn-ghost px-4"
          >
            Clear
          </button>
        </div>
      </div>

      {msg && <p className="mt-4 text-[13px] font-semibold text-ink">{msg}</p>}
    </div>
  );
}
