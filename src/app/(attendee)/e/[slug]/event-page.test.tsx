import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SEED_EVENTS } from '@/lib/campus-data';
import { EventDetailView } from '@/components/events/EventDetailClient';

afterEach(() => {
  cleanup();
});

describe('SSR Public Event Page & Commitment Controls (S4-02)', () => {
  it('renders full event title, venue, organizer, lineup and linked after-party with zero auth wall', () => {
    const event = SEED_EVENTS[0]!; // Sigma Havana Night
    const { getByText, getByRole } = render(<EventDetailView event={event} isSignedOutPreview />);

    expect(getByRole('heading', { name: 'Sigma Havana Night: Neon Pulse Edition' })).toBeDefined();
    expect(getByText(/SUB Main Field, University of Ibadan/i)).toBeDefined();
    expect(getByRole('link', { name: /Sigma Club UI/ })).toBeDefined();
    expect(getByText('DJ Spinz UI')).toBeDefined();
    expect(getByText(/Havana Official After-Party/i)).toBeDefined();
  });

  it('renders live scoreboard for MATCH_TOURNAMENT template events', () => {
    const matchEvent = SEED_EVENTS[1]!; // Mellanby vs Tedder
    const { getByText } = render(<EventDetailView event={matchEvent} />);

    expect(getByText('Mellanby Hall')).toBeDefined();
    expect(getByText('Tedder Hall')).toBeDefined();
    expect(getByText(/LIVE · 68'/i)).toBeDefined();
  });

  it('requires sign-in instead of issuing a local pass to a signed-out visitor', () => {
    const { getByRole } = render(<EventDetailView event={SEED_EVENTS[0]!} />);
    expect(document.querySelector('button[aria-busy]')).toBeNull();
    const href = getByRole('link', { name: /Sign in to RSVP/i }).getAttribute('href') ?? '';
    // autoRsvp=1 lets the event page finish the RSVP once the visitor is back from sign-in.
    expect(href).toContain('/sign-in?autoRsvp=1&next=');
    expect(href).toContain(encodeURIComponent('/e/' + SEED_EVENTS[0]!.slug));
  });
});
