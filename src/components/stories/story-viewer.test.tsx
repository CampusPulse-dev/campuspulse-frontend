import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SEED_EVENTS, SEED_STORIES } from '@/lib/campus-data';
import { StoryViewer } from './StoryViewer';
import { StoriesTray } from './StoriesTray';
import { HomeFeedClient } from '@/components/events/HomeFeedClient';
vi.mock('@/lib/api', async (original) => ({
  ...(await original()),
  fetchEventFeed: vi.fn(async (params?: { category?: string }) => ({
    items: SEED_EVENTS.filter((e) => !params?.category || e.category === params.category),
    nextCursor: null,
  })),
}));
afterEach(() => {
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
    expect(view.getByRole('dialog')).toBeDefined();
    expect(view.getByRole('img', { name: /Soundcheck Live at SUB Field/i })).toBeDefined();
    const close = view.getByRole('button', { name: /Close stories/i });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(view.getByRole('link', { name: /View Event & RSVP/i }));
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(view.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });
  it('filters category and six-hour mood window, resets, and hides personalized content while signed out', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-01T16:00:00Z'));
    const view = feed();
    expect(view.queryByRole('region', { name: 'Recommended For You' })).toBeNull();
    fireEvent.click(view.getByRole('button', { name: /^Sports$/i }));
    await view.findByText(/Inter-Hall Football Final/);
    expect(view.queryByText(/The Lion & The Jewel/)).toBeNull();
    fireEvent.click(view.getByRole('button', { name: /Learn/i }));
    expect(view.getByText(/Nothing live in this filter tonight/)).toBeDefined();
    fireEvent.click(view.getByRole('button', { name: /Reset Filters/i }));
    await view.findByText(/Sigma Havana Night: Neon Pulse Edition/);
    fireEvent.click(view.getByRole('button', { name: /Learn/i }));
    expect(view.queryByText(/Trenchard/)).toBeNull();
  });
});
