import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SEED_EVENTS } from '@/lib/campus-data';
import type * as AuthModule from '@/lib/auth-context';

const auth = vi.hoisted(() => ({
  interestedEventIds: [] as string[],
  toggleInterested: vi.fn(async () => true),
}));

vi.mock('@/lib/auth-context', async (importOriginal) => {
  const actual = await importOriginal<typeof AuthModule>();
  return {
    ...actual,
    useAuth: () => ({
      ...actual.useAuth(),
      user: {
        id: 'u-1',
        displayName: 'Tobi Adeyemi',
        avatarUrl: null,
        role: 'ATTENDEE',
        isVerifiedStudent: true,
      },
      interestedEventIds: auth.interestedEventIds,
      toggleInterested: auth.toggleInterested,
    }),
  };
});

import { EventCard } from './EventCard';
import { EventDetailView } from './EventDetailClient';

const event = SEED_EVENTS[0]!;
const saveButton = () => screen.getByRole('button', { name: 'Save event' });

afterEach(() => {
  cleanup();
  auth.interestedEventIds = [];
  auth.toggleInterested.mockClear();
});

describe('save pop (S4-02)', () => {
  it('pops the card bookmark on a tap that saves, then settles', () => {
    render(<EventCard event={event} />);
    expect(saveButton().className).not.toMatch(/savePop/);
    fireEvent.click(saveButton());
    expect(auth.toggleInterested).toHaveBeenCalledWith(event.id);
    expect(saveButton().className).toMatch(/savePop/);
    fireEvent.animationEnd(saveButton());
    expect(saveButton().className).not.toMatch(/savePop/);
  });

  it('never pops an event that was already saved, on load or when un-saving', () => {
    auth.interestedEventIds = [event.id];
    render(<EventCard event={event} />);
    expect(saveButton().className).not.toMatch(/savePop/);
    fireEvent.click(saveButton());
    expect(saveButton().className).not.toMatch(/savePop/);
  });

  it('pops the event page bookmark on save', () => {
    render(<EventDetailView event={event} />);
    fireEvent.click(saveButton());
    expect(saveButton().className).toMatch(/savePop/);
  });
});
