import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CountUp, ProgressRing } from './ui';

/**
 * These components animate with requestAnimationFrame, but the number and the
 * arc are *information*, not decoration. rAF does not fire in background tabs,
 * throttled webviews or headless browsers, so the tests below pin the thing
 * that actually matters: the true value ends up on screen either way.
 */

function suspendRaf() {
  // Never invoke the callback — exactly what a background tab does.
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 1),
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
}

function setReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: reduce && query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('CountUp', () => {
  it('still shows the real number when rAF never fires', () => {
    vi.useFakeTimers();
    setReducedMotion(false);
    suspendRaf();

    render(<CountUp to={209} prefix="+" />);
    expect(screen.getByText('+0')).toBeInTheDocument(); // animation start

    act(() => void vi.advanceTimersByTime(1200)); // safety net fires
    expect(screen.getByText('+209')).toBeInTheDocument();
  });

  it('renders the target immediately under prefers-reduced-motion', () => {
    setReducedMotion(true);
    suspendRaf();

    render(<CountUp to={209} prefix="+" />);
    // No animation at all: correct on first paint, never passes through 0.
    expect(screen.getByText('+209')).toBeInTheDocument();
  });

  it('animates toward the target when rAF is available', () => {
    setReducedMotion(false);
    let cb: FrameRequestCallback | null = null;
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((fn: FrameRequestCallback) => {
        cb = fn;
        return 1;
      }),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<CountUp to={100} duration={800} />);
    act(() => cb!(0)); // t=0
    act(() => cb!(800)); // t=duration -> eased to 1
    expect(screen.getByText('100')).toBeInTheDocument();
  });
});

describe('ProgressRing', () => {
  const offset = () => document.querySelectorAll('circle')[1].getAttribute('stroke-dashoffset');

  it('draws the arc even when rAF never fires', () => {
    vi.useFakeTimers();
    setReducedMotion(false);
    suspendRaf();

    render(<ProgressRing progress={0.5} size={100} stroke={10} />);
    const empty = offset();

    act(() => void vi.advanceTimersByTime(500));
    expect(offset()).not.toBe(empty); // no longer stuck at "no progress"
  });

  it('is drawn on first paint under prefers-reduced-motion', () => {
    setReducedMotion(true);
    suspendRaf();

    const { container } = render(<ProgressRing progress={1} size={100} stroke={10} />);
    const arc = container.querySelectorAll('circle')[1];
    // progress 1 => dashoffset 0 (a full ring) with no animation frame needed.
    expect(Number(arc.getAttribute('stroke-dashoffset'))).toBeCloseTo(0);
  });

  it('exposes progress to assistive tech regardless of animation', () => {
    setReducedMotion(false);
    suspendRaf();

    render(<ProgressRing progress={0.42} size={100} stroke={10} />);
    expect(screen.getByRole('img', { name: '42% complete' })).toBeInTheDocument();
  });
});
