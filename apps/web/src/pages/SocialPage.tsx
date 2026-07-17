import { useState } from 'react';
import { ClubsTab } from '../social/ClubsTab';
import { FeedTab } from '../social/FeedTab';
import { FriendsTab } from '../social/FriendsTab';

const tabs = ['Feed', 'Friends', 'Clubs'] as const;
type Tab = (typeof tabs)[number];

export function SocialPage() {
  const [tab, setTab] = useState<Tab>('Feed');

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 gap-1 p-3 pb-0">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
              tab === t
                ? 'bg-emerald-500 text-slate-900'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === 'Feed' && <FeedTab />}
        {tab === 'Friends' && <FriendsTab />}
        {tab === 'Clubs' && <ClubsTab />}
      </div>
    </div>
  );
}
