import { USER_COLORS, type UserPublic } from '@runturf/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { patch } from '../api/client';
import { Avatar } from './ui';

const MAX_NAME = 48;

export function EditProfileModal({
  user,
  onSaved,
  onClose,
}: {
  user: UserPublic;
  onSaved: (u: UserPublic) => void;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [color, setColor] = useState(user.color);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const trimmed = displayName.trim();
  const nameInvalid = trimmed.length === 0 || trimmed.length > MAX_NAME;
  const unchanged = trimmed === user.displayName && color === user.color;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (nameInvalid || busy) return;
    setBusy(true);
    setError('');
    try {
      const updated = await patch<UserPublic>('/users/me', { displayName: trimmed, color });
      onSaved(updated);
      // Names and colours appear in the feed, leaderboard, clubs and territory.
      qc.invalidateQueries();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save changes');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-base/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Edit profile"
    >
      <form onSubmit={onSubmit} className="card-raised anim-pop w-full max-w-sm p-6">
        <h2 className="t-section text-[17px]">Edit profile</h2>

        <div className="mt-5 flex items-center gap-3.5">
          <Avatar user={{ displayName: trimmed || user.displayName, color }} size={52} ring />
          <div className="min-w-0 flex-1">
            <label htmlFor="displayName" className="t-label">
              Display name
            </label>
            <input
              id="displayName"
              className="input mt-1"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={MAX_NAME}
              autoFocus
              required
            />
          </div>
        </div>

        <fieldset className="mt-5">
          <legend className="t-label">Colour</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {USER_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Colour ${c}`}
                aria-pressed={color === c}
                className={`h-9 w-9 rounded-full transition-transform ${
                  color === c ? 'scale-110 ring-2 ring-ink ring-offset-2 ring-offset-elev2' : ''
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="anim-rise mt-4 text-[13px] font-medium text-ember">
            {error}
          </p>
        )}

        <div className="mt-6 flex gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost flex-1 py-2.5">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || nameInvalid || unchanged}
            className="btn btn-primary flex-1 py-2.5"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
