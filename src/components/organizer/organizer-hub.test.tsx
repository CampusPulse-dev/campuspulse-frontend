import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { OrganizerEventSummary } from '@/lib/organizer-data';
import {
  deriveEventDetail,
  type OrganizerEventHubData,
  type StoryComposerData,
} from '@/lib/organizer-hub-data';
import { EventHubView } from './EventHub';
import { StoryComposerView } from './StoryComposer';

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  cleanup();
});

const NOW = new Date('2026-11-02T12:00:00.000Z');

function hubData(overrides: Partial<OrganizerEventSummary> = {}): OrganizerEventHubData {
  return {
    organizerSlug: 'sigma-club-ui',
    organizerName: 'Sigma Club UI',
    role: 'OWNER',
    event: deriveEventDetail({
      id: 'e1',
      title: 'Havana Night',
      slug: 'havana-night',
      category: 'SOCIAL_PARTY',
      template: 'CONCERT_PARTY',
      status: 'PUBLISHED',
      startsAt: '2026-11-02T10:00:00.000Z',
      endsAt: '2026-11-02T16:00:00.000Z',
      venueName: 'SUB Field',
      rsvpCount: 482,
      capacity: 500,
      checkInCount: 184,
      ...overrides,
    }),
  };
}

const matchFixture = {
  homeTeam: 'Mellanby Hall',
  awayTeam: 'Tedder Hall',
  homeScore: 2,
  awayScore: 1,
  isLive: true,
  periodLabel: "LIVE · 68'",
};

function renderHub(data = hubData(), handlers: Partial<Parameters<typeof EventHubView>[0]> = {}) {
  const onSaveScore = vi.fn().mockResolvedValue(undefined);
  const onExportCsv = vi.fn().mockResolvedValue(undefined);
  render(
    <EventHubView
      data={data}
      now={NOW}
      onSaveScore={onSaveScore}
      onExportCsv={onExportCsv}
      {...handlers}
    />,
  );
  return { onSaveScore, onExportCsv };
}

describe('EventHubView (S5-01)', () => {
  it('shows live attendance stats and the ambassador breakdown', () => {
    renderHub();
    const stats = screen.getByLabelText('Event stats');
    expect(within(stats).getByText('482 / 500')).toBeDefined();
    expect(within(stats).getByText('184')).toBeDefined();
    expect(within(stats).getByText('38%')).toBeDefined();
    expect(screen.getByText('Duplicate scans')).toBeDefined();
    expect(screen.getByText('Manual check-ins')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Ambassador attribution' })).toBeDefined();
    expect(screen.getByText('Bisola')).toBeDefined();
    expect(screen.getByRole('link', { name: '← Back to dashboard' }).getAttribute('href')).toBe(
      '/organizer/sigma-club-ui',
    );
  });

  it('has no score updater for events without a scoreboard', () => {
    renderHub();
    expect(screen.queryByRole('heading', { name: 'Live score' })).toBeNull();
  });

  it('exports the attendee list and explains what it contains', async () => {
    const { onExportCsv } = renderHub();
    expect(screen.getByText(/Contact details are never included/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Export attendee CSV' }));
    await waitFor(() => expect(onExportCsv).toHaveBeenCalledTimes(1));
  });

  it('shows an error when the export fails', async () => {
    renderHub(hubData(), { onExportCsv: vi.fn().mockRejectedValue(new Error('Export is down.')) });
    fireEvent.click(screen.getByRole('button', { name: 'Export attendee CSV' }));
    expect(await screen.findByText('Export is down.')).toBeDefined();
  });

  it('disables the export while there are no RSVPs', () => {
    renderHub(hubData({ rsvpCount: 0, checkInCount: null }));
    expect(
      (screen.getByRole('button', { name: 'Export attendee CSV' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.queryByRole('heading', { name: 'Ambassador attribution' })).toBeNull();
  });

  it('explains that a draft has no stats yet', () => {
    renderHub(
      hubData({ status: 'DRAFT', startsAt: null, endsAt: null, rsvpCount: 0, checkInCount: null }),
    );
    expect(screen.getByText(/still a draft/)).toBeDefined();
    expect(screen.queryByLabelText('Event stats')).toBeNull();
  });
});

describe('score updater (S5-01)', () => {
  const matchHub = () =>
    hubData({ template: 'MATCH_TOURNAMENT', category: 'SPORTS_RECREATION', fixture: matchFixture });

  it('saves a new score for a live match', async () => {
    const { onSaveScore } = renderHub(matchHub());
    fireEvent.change(screen.getByLabelText('Home score'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Period label'), { target: { value: "LIVE · 80'" } });
    fireEvent.click(screen.getByRole('button', { name: 'Save score' }));
    await waitFor(() => expect(onSaveScore).toHaveBeenCalledTimes(1));
    expect(onSaveScore.mock.calls[0]![0]).toMatchObject({
      homeScore: 3,
      awayScore: 1,
      periodLabel: "LIVE · 80'",
      isLive: true,
    });
    expect(await screen.findByText('Score saved')).toBeDefined();
  });

  it('can end the match by switching off the live flag', async () => {
    const { onSaveScore } = renderHub(matchHub());
    fireEvent.click(screen.getByLabelText('Match is live'));
    fireEvent.change(screen.getByLabelText('Period label'), { target: { value: 'FT' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save score' }));
    await waitFor(() => expect(onSaveScore).toHaveBeenCalled());
    expect(onSaveScore.mock.calls[0]![0]).toMatchObject({ isLive: false, periodLabel: 'FT' });
  });

  it('rejects bad scores before saving', async () => {
    const { onSaveScore } = renderHub(matchHub());
    fireEvent.change(screen.getByLabelText('Away score'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save score' }));
    expect(await screen.findByText(/Away score must be a whole number/)).toBeDefined();
    expect(onSaveScore).not.toHaveBeenCalled();
  });

  it('shows the server error when saving fails', async () => {
    renderHub(matchHub(), { onSaveScore: vi.fn().mockRejectedValue(new Error('Try again soon.')) });
    fireEvent.click(screen.getByRole('button', { name: 'Save score' }));
    expect(await screen.findByText('Try again soon.')).toBeDefined();
    expect(screen.queryByText('Score saved')).toBeNull();
  });

  it('hides the updater once the match is over', () => {
    renderHub(
      hubData({
        template: 'MATCH_TOURNAMENT',
        fixture: matchFixture,
        status: 'COMPLETED',
        startsAt: '2026-10-20T18:00:00.000Z',
        endsAt: '2026-10-20T22:00:00.000Z',
      }),
    );
    expect(screen.queryByRole('heading', { name: 'Live score' })).toBeNull();
  });
});

function composerData(overrides: Partial<StoryComposerData> = {}): StoryComposerData {
  return {
    organizerName: 'Sigma Club UI',
    verified: true,
    events: [{ id: 'e1', title: 'Havana Night' }],
    stories: [],
    ...overrides,
  };
}

function renderComposer(data = composerData()) {
  const onPost = vi.fn().mockResolvedValue(undefined);
  const onDelete = vi.fn().mockResolvedValue(undefined);
  render(<StoryComposerView data={data} now={NOW} onPost={onPost} onDelete={onDelete} />);
  return { onPost, onDelete };
}

function addFile(type: string, size = 1000) {
  const file = new File(['x'], 'story', { type });
  Object.defineProperty(file, 'size', { value: size });
  fireEvent.change(screen.getByLabelText('Photo or video'), { target: { files: [file] } });
}

describe('StoryComposerView (S5-01)', () => {
  it('posts a photo story linked to an event, then resets the form', async () => {
    const { onPost } = renderComposer();
    addFile('image/png');
    expect(screen.getByAltText('Story preview')).toBeDefined();
    fireEvent.change(screen.getByLabelText('Caption'), { target: { value: 'Doors at 7' } });
    fireEvent.change(screen.getByLabelText('Link to an event (optional)'), {
      target: { value: 'e1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Post story' }));
    await waitFor(() => expect(onPost).toHaveBeenCalledTimes(1));
    expect(onPost.mock.calls[0]![0]).toEqual({
      mediaType: 'IMAGE',
      caption: 'Doors at 7',
      eventId: 'e1',
      file: expect.any(File),
    });
    expect(await screen.findByText('Story posted. It will disappear in 24 hours.')).toBeDefined();
    expect((screen.getByLabelText('Caption') as HTMLTextAreaElement).value).toBe('');
    expect(screen.queryByAltText('Story preview')).toBeNull();
  });

  it('previews a video and counts caption characters', () => {
    renderComposer();
    addFile('video/mp4');
    expect(document.querySelector('video')).not.toBeNull();
    fireEvent.change(screen.getByLabelText('Caption'), { target: { value: 'hey' } });
    expect(screen.getByText('3 / 280')).toBeDefined();
  });

  it('asks for media before posting', async () => {
    const { onPost } = renderComposer();
    fireEvent.click(screen.getByRole('button', { name: 'Post story' }));
    expect(await screen.findByText('Add a photo or video for your story.')).toBeDefined();
    expect(onPost).not.toHaveBeenCalled();
  });

  it('rejects unsupported and oversized files', () => {
    renderComposer();
    addFile('application/pdf');
    expect(screen.getByRole('alert').textContent).toMatch(/Use a JPEG, PNG or WebP/);
    addFile('video/mp4', 30 * 1024 * 1024);
    expect(screen.getByRole('alert').textContent).toMatch(/under 25 MB/);
    expect(screen.queryByAltText('Story preview')).toBeNull();
  });

  it('disables posting for an unverified club', () => {
    renderComposer(composerData({ verified: false }));
    expect(screen.getByText(/unlocks once your club is verified/)).toBeDefined();
    expect((screen.getByRole('button', { name: 'Post story' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('shows the server error when posting fails', async () => {
    const onPost = vi.fn().mockRejectedValue(new Error('Upload failed.'));
    render(
      <StoryComposerView data={composerData()} now={NOW} onPost={onPost} onDelete={vi.fn()} />,
    );
    addFile('image/jpeg');
    fireEvent.click(screen.getByRole('button', { name: 'Post story' }));
    expect(await screen.findByText('Upload failed.')).toBeDefined();
  });

  it('lists active stories with time left and deletes one', async () => {
    const { onDelete } = renderComposer(
      composerData({
        stories: [
          {
            id: 's1',
            caption: 'Doors at 7',
            eventId: 'e1',
            eventTitle: 'Havana Night',
            mediaType: 'IMAGE',
            createdAt: '2026-11-02T00:00:00.000Z',
            expiresAt: '2026-11-03T00:00:00.000Z',
          },
        ],
      }),
    );
    expect(screen.getByText('Doors at 7')).toBeDefined();
    expect(screen.getByText('Links to Havana Night')).toBeDefined();
    expect(screen.getByText('Expires in 12h')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Delete story 1' }));
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete story' }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('s1'));
  });

  it('says so when there are no active stories', () => {
    renderComposer();
    expect(screen.getByText('No active stories right now.')).toBeDefined();
  });
});
