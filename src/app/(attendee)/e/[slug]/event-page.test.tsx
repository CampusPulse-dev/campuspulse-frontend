import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SEED_EVENTS } from '@/lib/campus-data';
import { EventDetailView } from '@/components/events/EventDetailClient';

afterEach(() => {
  cleanup();
});

describe('SSR Public Event Page & Commitment Controls (S4-02)', () => {
  it('renders full event title, venue, organizer, lineup and linked after-party with zero auth wall', () => {
    const event = SEED_EVENTS[0]!; // Sigma Havana Night
    const { getByText } = render(<EventDetailView event={event} isSignedOutPreview />);

    expect(getByText('Sigma Havana Night: Neon Pulse Edition')).toBeDefined();
    expect(getByText(/SUB Main Field, University of Ibadan/i)).toBeDefined();
    expect(getByText('Sigma Club UI')).toBeDefined();
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

  it('optimistically locks in Free RSVP and reveals offline QR pass CTA', () => {
    const event = SEED_EVENTS[0]!;
    const { getByRole, getByText } = render(<EventDetailView event={event} />);

    const rsvpBtn = getByRole('button', { name: /RSVP — Free/i });
    fireEvent.click(rsvpBtn);

    expect(getByText(/Going ✓ · Offline QR Saved/i)).toBeDefined();
  });
});
