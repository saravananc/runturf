import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import type { AxeResults } from 'axe-core';
import { AuthPage } from '../pages/AuthPage';
import { HistoryPage } from '../pages/HistoryPage';
import { ProfilePage } from '../pages/ProfilePage';
import { Avatar, EmptyState, ProgressRing, SectionHeading, StatTile } from '../components/ui';
import { FlagIcon } from '../components/icons';

/**
 * Automated accessibility checks. axe catches the mechanical failures —
 * unlabelled controls, broken roles, duplicate ids — which are exactly the
 * regressions that slip in unnoticed during UI work.
 *
 * Two honest limits. axe's `color-contrast` rule needs real layout and so does
 * not run under jsdom; palette contrast was set deliberately (see the `ink3`
 * note in the theme) but is not enforced here. And axe cannot judge focus order
 * or whether a label is *meaningful*. This is a floor, not a ceiling.
 */

// maplibre needs WebGL and object URLs, neither of which jsdom provides. The map
// itself is not what these assertions are about, so stub the module out.
vi.mock('maplibre-gl', () => ({
  default: {
    Map: class {
      addControl() {}
      on() {}
      remove() {}
      getSource() {}
      fitBounds() {}
    },
    NavigationControl: class {},
    LngLatBounds: class {
      extend() {
        return this;
      }
    },
  },
}));

const user = {
  id: 'u1',
  username: 'demo',
  displayName: 'Demo Runner',
  color: '#f97316',
  createdAt: new Date().toISOString(),
};

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user, login: vi.fn(), register: vi.fn(), logout: vi.fn(), setUser: vi.fn() }),
}));

// Route API reads to fixtures so the pages render their full, populated markup —
// an empty page would exercise almost none of the interactive controls.
vi.mock('../api/client', () => {
  const stats = {
    xp: 1200,
    level: 4,
    coins: 90,
    streakDays: 3,
    lastRunDate: null,
    totalRuns: 8,
    totalDistanceM: 6140,
    cellsOwned: 12,
  };
  const runs = [
    {
      id: 'r1',
      startedAt: new Date().toISOString(),
      durationS: 1800,
      distanceM: 5000,
      avgPaceSPerKm: 360,
      cellsCaptured: 7,
      cellsStolen: 2,
      xpGained: 160,
    },
  ];
  return {
    ApiError: class ApiError extends Error {},
    get: vi.fn((path: string) => {
      if (path.startsWith('/runs')) return Promise.resolve(runs);
      if (path === '/users/me/stats') return Promise.resolve(stats);
      if (path === '/users/me/settings')
        return Promise.resolve({ shareActivity: true, discoverable: true, role: 'user' });
      if (path === '/users/me/achievements') return Promise.resolve([]);
      if (path === '/achievements') return Promise.resolve([]);
      return Promise.resolve([]);
    }),
    post: vi.fn(() => Promise.resolve({})),
    patch: vi.fn(() => Promise.resolve({})),
    del: vi.fn(() => Promise.resolve({})),
    getBlob: vi.fn(),
  };
});

function withProviders(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

/** axe returns its report; the matcher asserts the violations list is empty. */
async function expectNoViolations(container: HTMLElement) {
  const results = (await axe(container)) as unknown as AxeResults;
  expect(results).toHaveNoViolations();
}

describe('accessibility', () => {
  it('sign-in page has no violations', async () => {
    const { container } = render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>,
    );
    await expectNoViolations(container);
  });

  it('stat tiles and section headings have no violations', async () => {
    const { container } = render(
      <div>
        <SectionHeading>Stats</SectionHeading>
        <StatTile label="Turf" value={42} icon={<FlagIcon size={14} />} tone="volt" />
        <StatTile label="Distance" value="6.1 km" tone="volt" />
      </div>,
    );
    await expectNoViolations(container);
  });

  it('empty state has no violations', async () => {
    const { container } = render(
      <EmptyState icon={<FlagIcon size={32} />} title="No runs yet" hint="Go claim some turf." />,
    );
    await expectNoViolations(container);
  });

  it('avatar and progress ring have no violations', async () => {
    const { container } = render(
      <div>
        <Avatar user={user} size={44} ring />
        <ProgressRing progress={0.6} size={100} stroke={8} label="Level 4 progress">
          <span>4</span>
        </ProgressRing>
      </div>,
    );
    await expectNoViolations(container);
  });

  it('history page — including the filter controls — has no violations', async () => {
    const { container } = render(withProviders(<HistoryPage />));
    // Wait for data so the run list and sort control are actually in the tree.
    await waitFor(() => expect(screen.getByLabelText('Sort runs')).toBeInTheDocument());
    await expectNoViolations(container);
  });

  it('profile page — including the privacy switches — has no violations', async () => {
    const { container } = render(withProviders(<ProfilePage />));
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Share activity' })).toBeInTheDocument());
    await expectNoViolations(container);
  });
});
