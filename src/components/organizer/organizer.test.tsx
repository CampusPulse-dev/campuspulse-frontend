import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SEED_ORGANIZERS } from '@/lib/campus-data';
import type { OrganizerDashboardData } from '@/lib/organizer-data';
import { EventWizard } from './EventWizard';
import { OrganizerDashboardView } from './OrganizerDashboard';
vi.mock('@/lib/mode', () => ({ DEMO_MODE: true, DATA_MODE: 'demo', DEV_AUTH_MODE: false }));

afterEach(() => {
  cleanup();
});

const NOW = new Date('2026-11-02T12:00:00.000Z');

function dashboard(overrides: Partial<OrganizerDashboardData> = {}): OrganizerDashboardData {
  return {
    organizer: SEED_ORGANIZERS[0]!,
    role: 'OWNER',
    verification: { status: 'VERIFIED', reviewerNote: null },
    kpis: { followers: 4820, upcomingRsvps: 578, showUpRate: 0.82, activeStories: 1 },
    events: [
      {
        id: 'live-1',
        title: 'Live Night',
        slug: null,
        category: 'SOCIAL_PARTY',
        template: 'CONCERT_PARTY',
        status: 'PUBLISHED',
        startsAt: '2026-11-02T10:00:00.000Z',
        endsAt: '2026-11-02T16:00:00.000Z',
        venueName: 'SUB Field',
        rsvpCount: 482,
        capacity: 500,
        checkInCount: 184,
      },
      {
        id: 'draft-1',
        title: 'Unfinished Mixer',
        slug: null,
        category: 'SOCIAL_PARTY',
        template: 'GENERIC',
        status: 'DRAFT',
        startsAt: null,
        endsAt: null,
        venueName: '',
        rsvpCount: 0,
        capacity: null,
        checkInCount: null,
      },
      {
        id: 'past-1',
        title: 'Old Show',
        slug: null,
        category: 'PERFORMANCE_ARTS',
        template: 'GENERIC',
        status: 'COMPLETED',
        startsAt: '2026-10-20T18:00:00.000Z',
        endsAt: '2026-10-20T22:00:00.000Z',
        venueName: 'Theatre',
        rsvpCount: 100,
        capacity: null,
        checkInCount: 80,
      },
    ],
    ...overrides,
  };
}

describe('OrganizerDashboardView (S5-01)', () => {
  it('shows KPIs and groups events, with a door scanner link for live events', () => {
    render(<OrganizerDashboardView data={dashboard()} now={NOW} />);
    expect(screen.getByRole('heading', { name: 'Sigma Club UI' })).toBeDefined();
    expect(screen.getByText('4,820')).toBeDefined();
    expect(screen.getByText('82%', { selector: 'dd' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Live / Today' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Drafts' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Past' })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Upcoming' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Open Door Scanner' }).getAttribute('href')).toBe(
      '/organizer/door/live-1',
    );
  });

  it('hides the verification banner for verified clubs', () => {
    render(<OrganizerDashboardView data={dashboard()} now={NOW} />);
    expect(screen.queryByLabelText('Club verification status')).toBeNull();
  });

  it('shows the reviewer note for a club that needs more information', () => {
    render(
      <OrganizerDashboardView
        data={dashboard({
          verification: { status: 'MORE_INFO', reviewerNote: 'Upload the approval letter.' },
        })}
        now={NOW}
      />,
    );
    expect(screen.getByRole('heading', { name: 'More info requested' })).toBeDefined();
    expect(screen.getByText('Upload the approval letter.')).toBeDefined();
  });

  it('shows an empty state with no events and dashes for missing rates', () => {
    render(
      <OrganizerDashboardView
        data={dashboard({
          events: [],
          kpis: { followers: 0, upcomingRsvps: 0, showUpRate: null, activeStories: 0 },
        })}
        now={NOW}
      />,
    );
    expect(screen.getByText('No events yet')).toBeDefined();
    expect(screen.getByText('—')).toBeDefined();
  });
});

function renderWizard(canPublish = true) {
  const onSaveDraft = vi.fn().mockResolvedValue(undefined);
  const onPublish = vi.fn().mockResolvedValue(undefined);
  render(
    <EventWizard
      canPublish={canPublish}
      parentOptions={[{ id: 'p1', title: 'Havana Night' }]}
      onSaveDraft={onSaveDraft}
      onPublish={onPublish}
    />,
  );
  return { onSaveDraft, onPublish };
}

function pickTemplate(label: string) {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(label) }));
}

function fillStepOne(category = 'SOCIAL_PARTY') {
  fireEvent.change(screen.getByLabelText('Category'), { target: { value: category } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
}

function fillStepTwo() {
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Neon Night' } });
  fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'A big night.' } });
  fireEvent.change(screen.getByLabelText('Starts (WAT)'), {
    target: { value: '2026-11-20T19:00' },
  });
  fireEvent.change(screen.getByLabelText('Ends (WAT)'), { target: { value: '2026-11-20T23:00' } });
  fireEvent.change(screen.getByLabelText('Venue name'), { target: { value: 'SUB Field' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
}

describe('EventWizard (S5-01)', () => {
  it('blocks step 1 until a category is chosen', async () => {
    renderWizard();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Choose a category.')).toBeDefined();
    expect(screen.getByRole('heading', { name: /Template/ })).toBeDefined();
  });

  it('turns students-only on by default for clubs, until the organizer changes it', async () => {
    renderWizard();
    fillStepOne('CLUB_SOCIETY');
    const toggle = (await screen.findByLabelText('UI students only')) as HTMLInputElement;
    expect(toggle.checked).toBe(true);
  });

  it('keeps students-only off by default for parties', async () => {
    renderWizard();
    fillStepOne('SOCIAL_PARTY');
    expect(((await screen.findByLabelText('UI students only')) as HTMLInputElement).checked).toBe(
      false,
    );
  });

  it('only offers the waitlist once a capacity is set', async () => {
    renderWizard();
    fillStepOne();
    const waitlist = (await screen.findByLabelText('Waitlist when full')) as HTMLInputElement;
    expect(waitlist.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Capacity'), { target: { value: '200' } });
    expect(waitlist.disabled).toBe(false);
    expect(waitlist.checked).toBe(true);
  });

  it('shows only the Concert / Party blocks on step 3', async () => {
    renderWizard();
    pickTemplate('Concert / Party');
    fillStepOne();
    await screen.findByLabelText('Title');
    fillStepTwo();
    expect(await screen.findByRole('heading', { name: 'Lineup' })).toBeDefined();
    expect(screen.getByLabelText('Dress code')).toBeDefined();
    expect(screen.getByLabelText('Door policy')).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Showtimes' })).toBeNull();
    expect(screen.queryByLabelText('Home team')).toBeNull();
  });

  it('shows only the match blocks for a fixture', async () => {
    renderWizard();
    pickTemplate('Match / Fixture');
    fillStepOne('SPORTS_RECREATION');
    await screen.findByLabelText('Title');
    fillStepTwo();
    expect(await screen.findByLabelText('Home team')).toBeDefined();
    expect(screen.getByLabelText('Away team')).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Lineup' })).toBeNull();
  });

  it('saves a draft from any step once it has a title and category', async () => {
    const { onSaveDraft } = renderWizard();
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    expect(await screen.findByText('Give the event a title before saving a draft.')).toBeDefined();
    expect(onSaveDraft).not.toHaveBeenCalled();

    fillStepOne();
    fireEvent.change(await screen.findByLabelText('Title'), { target: { value: 'Neon Night' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(onSaveDraft).toHaveBeenCalledTimes(1));
    expect(onSaveDraft.mock.calls[0]![0]).toMatchObject({
      title: 'Neon Night',
      category: 'SOCIAL_PARTY',
    });
  });

  it('publishes a complete event for a verified club', async () => {
    const { onPublish } = renderWizard(true);
    fillStepOne();
    await screen.findByLabelText('Title');
    fillStepTwo();
    const publish = (await screen.findByRole('button', {
      name: 'Publish Now',
    })) as HTMLButtonElement;
    expect(publish.disabled).toBe(false);
    fireEvent.click(publish);
    await waitFor(() => expect(onPublish).toHaveBeenCalledTimes(1));
  });

  it('disables publishing and explains why for an unverified club', async () => {
    const { onPublish } = renderWizard(false);
    fillStepOne();
    await screen.findByLabelText('Title');
    fillStepTwo();
    const publish = (await screen.findByRole('button', {
      name: 'Publish Now',
    })) as HTMLButtonElement;
    expect(publish.disabled).toBe(true);
    expect(screen.getByText(/Publishing unlocks once your club is verified/)).toBeDefined();
    fireEvent.click(publish);
    expect(onPublish).not.toHaveBeenCalled();
  });

  it('shows the server error when publishing fails', async () => {
    const onPublish = vi.fn().mockRejectedValue(new Error('This club must be verified.'));
    render(
      <EventWizard canPublish parentOptions={[]} onSaveDraft={vi.fn()} onPublish={onPublish} />,
    );
    fillStepOne();
    await screen.findByLabelText('Title');
    fillStepTwo();
    fireEvent.click(await screen.findByRole('button', { name: 'Publish Now' }));
    expect(await screen.findByText('This club must be verified.')).toBeDefined();
  });
});
