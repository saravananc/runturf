import { useState } from 'react';
import { ClubsTab } from '../social/ClubsTab';
import { FeedTab } from '../social/FeedTab';
import { FriendsTab } from '../social/FriendsTab';

const tabs = ['Feed', 'Friends', 'Clubs'] as const;
type Tab = (typeof tabs)[number];

export function SocialPage() {
  const [tab, setTab] = useState<Tab>('Feed');

  return (
    <div className="mx-auto flex h-full w-full max-w-lg flex-col">
      <div className="shrink-0 p-3 pb-0" role="tablist" aria-label="Social sections">
        <div className="flex gap-1 rounded-xl bg-elev1 p-1">
          {tabs.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg py-2 text-[13px] font-bold transition-all ${
                tab === t
                  ? 'bg-elev3 text-ink shadow-[0_1px_6px_rgb(0_0_0/0.35)]'
                  : 'text-ink-3 hover:text-ink-2'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === 'Feed' && <FeedTab />}
        {tab === 'Friends' && <FriendsTab />}
        {tab === 'Clubs' && <ClubsTab />}
      </div>
    </div>
  );
}
