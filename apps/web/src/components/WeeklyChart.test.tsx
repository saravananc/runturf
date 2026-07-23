import type { RunSummary } from '@runturf/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WeeklyChart } from './WeeklyChart';

function run(overrides: Partial<RunSummary>): RunSummary {
  return {
    id: Math.random().toString(36).slice(2),
    startedAt: new Date().toISOString(),
    durationS: 600,
    distanceM: 1000,
    avgPaceSPerKm: 360,
    cellsCaptured: 3,
    cellsStolen: 0,
    xpGained: 50,
    ...overrides,
  };
}

describe('WeeklyChart', () => {
  it('sums the week and exposes an accessible total', () => {
    const today = new Date().toISOString();
    render(<WeeklyChart runs={[run({ distanceM: 1500, startedAt: today }), run({ distanceM: 500, startedAt: today })]} />);

    // Total (2.00 km) is both shown and in the chart's accessible name.
    expect(screen.getByText('Last 7 days')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAccessibleName(/2\.00 km/);
  });

  it('renders seven day-of-week labels', () => {
    render(<WeeklyChart runs={[]} />);
    // Narrow weekday labels can repeat (e.g. two "S"), so count text nodes.
    const svg = screen.getByRole('img');
    const labels = svg.querySelectorAll('text');
    // 7 day labels, plus at most one direct value label (none when empty).
    expect(labels.length).toBeGreaterThanOrEqual(7);
  });
});
