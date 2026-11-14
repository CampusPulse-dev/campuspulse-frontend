import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SEED_EVENTS, SEED_STORIES } from '@/lib/campus-data';
import { StoryViewer } from './StoryViewer';
import { StoriesTray } from './StoriesTray';
import { HomeFeedClient } from '@/components/events/HomeFeedClient';
import type * as MotionLibrary from 'framer-motion';
const motionPreference = vi.hoisted(() => ({ reduced: false }));
vi.mock('framer-motion', async (original) => ({
  ...(await original<typeof MotionLibrary>()),
  useReducedMotion: () => motionPreference.reduced,
}));
vi.mock('@/lib/api', async (original) => ({
  ...(await original()),
  fetchEventFeed: vi.fn(async (params?: { category?: string }) => ({
    items: SEED_EVENTS.filter((e) => !params?.category || e.category === params.category),
    nextCursor: null,
  })),
}));
afterEach(() => {
  motionPreference.reduced = false;
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
function feed() {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <HomeFeedClient initialEvents={SEED_EVENTS} stories={SEED_STORIES} />
    </QueryClientProvider>,
  );
}
describe('Stories and discovery', () => {
  it('does not auto-advance with reduced motion and retains manual navigation', () => {
    vi.useFakeTimers();
    motionPreference.reduced = true;
    const select = vi.fn();
    const close = vi.fn();
    const view = render(
      <StoryViewer stories={SEED_STORIES} activeIndex={0} onSelectIndex={select} onClose={close} />,
    );
    act(() => vi.advanceTimersByTime(10000));
    expect(select).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    fireEvent.click(view.getByRole('button', { name: 'Next story' }));
    expect(select).toHaveBeenCalledWith(1);
  });
  it('hides an empty story tray', () => {
    expect(render(<StoriesTray stories={[]} />).container.firstChild).toBeNull();
  });
  it('advances a story after five seconds', () => {
    vi.useFakeTimers();
    const select = vi.fn();
    render(
      <StoryViewer
        stories={SEED_STORIES}
        activeIndex={0}
        onSelectIndex={select}
        onClose={vi.fn()}
      />,
    );
    act(() => vi.advanceTimersByTime(4999));
    expect(select).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(select).toHaveBeenCalledWith(1);
  });
  it('opens media, traps focus, and restores the trigger after Escape', async () => {
    const view = render(<StoriesTray stories={SEED_STORIES} />);
    const trigger = view.getByRole('button', { name: /Sigma Club UI/i });
    trigger.focus();
    fireEvent.click(trigger);
    // The viewer is code-split and arrives a tick after the first open.
    expect(await view.findByRole('dialog')).toBeDefined();
    expect(view.getByRole('img', { name: /Soundcheck Live at SUB Field/i })).toBeDefined();
    const close = view.getByRole('button', { name: /Pause stories/i });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(view.getByRole('link', { name: /View Event & RSVP/i }));
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(view.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });
  it('filters category and dates, resets, and hides personalized content while signed out', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-01T16:00:00Z'));
    const view = feed();
    expect(view.queryByRole('region', { name: 'Recommended For You' })).toBeNull();
    fireEvent.click(view.getByRole('button', { name: /^Sports$/i }));
    await view.findByRole('heading', { name: /Inter-Hall Football Final/ });
    expect(view.queryByRole('heading', { name: /The Lion & The Jewel/ })).toBeNull();
    fireEvent.click(view.getByRole('button', { name: 'Academic' }));
    await view.findByRole('heading', { name: /Building Offline-First Products/ });
    fireEvent.click(view.getByRole('button', { name: 'Tonight' }));
    expect(view.getByText(/No events in this view/)).toBeDefined();
    fireEvent.click(view.getByRole('button', { name: /Reset Filters/i }));
    await view.findByRole('heading', { name: /Sigma Havana Night: Neon Pulse Edition/ });
  });
  it('pauses the remaining story time until resumed', () => {
    vi.useFakeTimers();
    const select = vi.fn();
    const view = render(
      <StoryViewer
        stories={SEED_STORIES}
        activeIndex={0}
        onSelectIndex={select}
        onClose={vi.fn()}
      />,
    );
    act(() => vi.advanceTimersByTime(2000));
    fireEvent.click(view.getByRole('button', { name: 'Pause stories' }));
    act(() => vi.advanceTimersByTime(6000));
    expect(select).not.toHaveBeenCalled();
    fireEvent.click(view.getByRole('button', { name: 'Resume stories' }));
    act(() => vi.advanceTimersByTime(3000));
    expect(select).toHaveBeenCalledWith(1);
  });
});
