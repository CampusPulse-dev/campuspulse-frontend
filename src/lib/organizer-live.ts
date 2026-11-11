import { apiFetch, apiFetchBlob, uploadPublicMedia, type Schemas } from './api';
import {
  lagosLocalToIso,
  validateStep,
  type EventDraft,
  type OrganizerDashboardData,
  type OrganizerEventSummary,
} from './organizer-data';
import type { OrganizerEventHubData, StoryComposerData } from './organizer-hub-data';
import type { TeamData, TeamMember, DoorStaffGrant } from './organizer-team-data';
import { validateStory, type StoryDraft, type OrganizerStory } from './organizer-stories';

export async function liveClub(slug: string): Promise<Schemas['OrganizerMembership']> {
  const mine = await apiFetch<Schemas['MyOrganizersResponse']>('/organizers/mine', {
    cache: 'no-store',
  });
  const club = mine.items.find((m) => m.organizer.slug === slug);
  if (!club) throw new Error('You do not have access to this club.');
  return club;
}

export function liveSummary(event: Schemas['ManagedEventSummary']): OrganizerEventSummary {
  return {
    id: event.id,
    title: event.title,
    slug: event.slug,
    category: event.category,
    template: event.template ?? 'GENERIC',
    status: event.status,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    venueName: event.venueName,
    rsvpCount: event.rsvpCount,
    capacity: event.capacity,
    checkInCount: event.checkInCount,
    fixture: event.fixture,
  };
}

export async function liveEvents(organizerId: string): Promise<Schemas['ManagedEventSummary'][]> {
  const events: Schemas['ManagedEventSummary'][] = [];
  let cursor: string | null = null;
  do {
    const page: Schemas['ManagedEventsResponse'] = await apiFetch(
      `/organizers/${organizerId}/managed-events?limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
      { cache: 'no-store' },
    );
    events.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return events;
}

export async function liveDashboard(slug: string): Promise<OrganizerDashboardData> {
  const club = await liveClub(slug);
  const [dashboard, events] = await Promise.all([
    apiFetch<Schemas['OrganizerDashboardResponse']>(`/organizers/${club.organizer.id}/dashboard`, {
      cache: 'no-store',
    }),
    liveEvents(club.organizer.id),
  ]);
  const m = dashboard.membership;
  return {
    organizer: m.organizer,
    role: m.role,
    verification: {
      status:
        m.verificationStatus === 'APPROVED'
          ? 'VERIFIED'
          : m.verificationStatus === 'INFO_REQUESTED'
            ? 'MORE_INFO'
            : 'PENDING',
      reviewerNote: m.reviewerNote,
    },
    kpis: dashboard.kpis,
    events: events.map(liveSummary),
  };
}

function localTime(value: string) {
  return new Date(Date.parse(value) + 3600000).toISOString().slice(0, 16);
}
export async function liveReadDraft(slug: string, eventId: string): Promise<EventDraft> {
  const club = await liveClub(slug);
  const detail = await apiFetch<Schemas['ManagedEvent']>(`/events/${eventId}/manage`, {
    cache: 'no-store',
  });
  if (detail.organizer.id !== club.organizer.id)
    throw new Error('This event belongs to another club.');
  const d = detail.draft;
  return {
    template: d.template ?? 'GENERIC',
    category: d.category,
    title: d.title,
    description: d.description,
    coverDataUrl: d.coverImageUrl,
    startsAt: localTime(d.startsAt),
    endsAt: localTime(d.endsAt),
    venueName: d.venueName,
    venueDetail: d.venueDetail ?? '',
    capacity: d.capacity,
    studentsOnly: d.studentsOnly ?? false,
    waitlistEnabled: d.waitlistEnabled ?? true,
    dressCode: d.dressCode ?? '',
    doorPolicy: d.doorPolicy ?? '',
    lineup: (d.lineup ?? []).map((s, i) => ({ ...s, id: detail.lineup?.[i]?.id ?? `lineup-${i}` })),
    showtimes: (d.showtimes ?? []).map((s, i) => ({
      id: detail.showtimes?.[i]?.id ?? `showtime-${i}`,
      label: s.label,
      startsAt: s.startsAt,
      capacity: s.capacity ?? null,
    })),
    homeTeam: d.fixture?.homeTeam ?? '',
    awayTeam: d.fixture?.awayTeam ?? '',
    linkAfterParty: !!d.parentEventId,
    parentEventId: d.parentEventId ?? null,
    afterPartyAccessRule: d.afterPartyAccess ?? 'OPEN',
  };
}

async function eventBody(slug: string, draft: EventDraft): Promise<Schemas['CreateEventBody']> {
  const errors = validateStep(1, draft).concat(validateStep(2, draft));
  if (errors.length) throw new Error(errors[0]);
  if (!draft.coverDataUrl) throw new Error('Add a cover image before saving the event.');
  let cover = draft.coverDataUrl;
  if (cover.startsWith('data:')) {
    const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(cover);
    if (!match) throw new Error('Use a JPEG, PNG or WebP cover.');
    const bytes = Uint8Array.from(atob(match[2]!), (c) => c.charCodeAt(0));
    const uploaded = await uploadPublicMedia(
      new File([bytes], 'cover', { type: match[1]! }),
      'EVENT_COVER',
    );
    cover = uploaded.publicUrl;
  }
  const club = await liveClub(slug);
  return {
    organizerId: club.organizer.id,
    title: draft.title.trim(),
    description: draft.description.trim(),
    category: draft.category!,
    template: draft.template,
    startsAt: lagosLocalToIso(draft.startsAt),
    endsAt: lagosLocalToIso(draft.endsAt),
    venueName: draft.venueName.trim(),
    venueDetail: draft.venueDetail || null,
    coverImageUrl: cover,
    capacity: draft.capacity,
    studentsOnly: draft.studentsOnly,
    waitlistEnabled: draft.waitlistEnabled,
    dressCode: draft.dressCode || null,
    doorPolicy: draft.doorPolicy || null,
    lineup: draft.lineup,
    showtimes: draft.showtimes.map((s) => ({
      label: s.label,
      startsAt: s.startsAt,
      capacity: s.capacity ?? null,
    })),
    ...(draft.template === 'MATCH_TOURNAMENT'
      ? {
          fixture: {
            homeTeam: draft.homeTeam,
            awayTeam: draft.awayTeam,
            homeScore: 0,
            awayScore: 0,
            isLive: false,
            periodLabel: 'Scheduled',
          },
        }
      : {}),
    parentEventId: draft.linkAfterParty ? draft.parentEventId : null,
    linkType: draft.linkAfterParty ? 'AFTER_PARTY' : null,
    afterPartyAccess: draft.afterPartyAccessRule,
  };
}

export async function liveSaveDraft(
  slug: string,
  draft: EventDraft,
  id?: string,
): Promise<OrganizerEventSummary> {
  const body = await eventBody(slug, draft);
  if (id) {
    const previous = await apiFetch<Schemas['ManagedEvent']>(`/events/${id}/manage`, {
      cache: 'no-store',
    });
    if (previous.organizer.id !== body.organizerId)
      throw new Error('This event belongs to another club.');
    // Saving textual edits must not reset a running match's scoreboard.
    if (body.fixture && previous.draft.fixture)
      body.fixture = {
        ...previous.draft.fixture,
        homeTeam: draft.homeTeam,
        awayTeam: draft.awayTeam,
      };
  }
  const event = await apiFetch<Schemas['EventPublic']>(id ? `/events/${id}` : '/events', {
    method: id ? 'PATCH' : 'POST',
    body: JSON.stringify(body),
  });
  return liveSummary({ ...event, checkInCount: 0 });
}

export async function livePublish(
  slug: string,
  draft: EventDraft,
  id?: string,
): Promise<OrganizerEventSummary> {
  const saved = await liveSaveDraft(slug, draft, id);
  const event = await apiFetch<Schemas['EventPublic']>(`/events/${saved.id}/publish`, {
    method: 'POST',
  });
  return liveSummary({ ...event, checkInCount: saved.checkInCount ?? 0 });
}

export async function liveHub(slug: string, eventId: string): Promise<OrganizerEventHubData> {
  const club = await liveClub(slug);
  const [event, stats] = await Promise.all([
    apiFetch<Schemas['ManagedEvent']>(`/events/${eventId}/manage`, { cache: 'no-store' }),
    apiFetch<Schemas['EventStatsResponse']>(`/attendance/events/${eventId}/stats`, {
      cache: 'no-store',
    }),
  ]);
  if (event.organizer.id !== club.organizer.id)
    throw new Error('This event belongs to another club.');
  return {
    organizerSlug: slug,
    organizerName: club.organizer.name,
    role: club.role,
    event: {
      ...liveSummary(event),
      duplicateScanCount: stats.duplicateScanCount,
      manualCheckInCount: stats.manualCheckInCount,
      ambassadors: stats.ambassadors.map((a) => ({
        name: a.creatorName,
        attributedRsvps: a.rsvps,
        attributedCheckIns: a.checkIns,
      })),
    },
  };
}
export async function liveCsv(slug: string, eventId: string): Promise<string> {
  await liveHub(slug, eventId);
  return (await apiFetchBlob(`/attendance/events/${eventId}/roster?format=csv`)).text();
}
export async function liveTeam(slug: string): Promise<TeamData> {
  const club = await liveClub(slug);
  const [team, events] = await Promise.all([
    apiFetch<Schemas['TeamResponse']>(`/organizers/${club.organizer.id}/team`, {
      cache: 'no-store',
    }),
    liveEvents(club.organizer.id),
  ]);
  return {
    organizerName: club.organizer.name,
    role: team.role,
    members: team.members.map((m) => ({ ...m, status: 'ACTIVE' })),
    doorStaff: team.doorStaff,
    grantableEvents: events
      .filter((e) => e.status === 'PUBLISHED' && Date.parse(e.endsAt) > Date.now())
      .map((e) => ({ id: e.id, title: e.title, endsAt: e.endsAt })),
  };
}
export async function liveInvite(slug: string, email: string): Promise<TeamMember> {
  const club = await liveClub(slug);
  const previous = new Set((await liveTeam(slug)).members.map((m) => m.userId));
  const team = await apiFetch<Schemas['TeamResponse']>(`/organizers/${club.organizer.id}/team`, {
    method: 'POST',
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
  const member = team.members.find((m) => !previous.has(m.userId));
  if (!member) throw new Error('No team member was returned. Refresh the team.');
  return { ...member, status: 'ACTIVE' };
}
export async function liveRemove(slug: string, userId: string): Promise<void> {
  const club = await liveClub(slug);
  await apiFetch(`/organizers/${club.organizer.id}/team/${userId}`, { method: 'DELETE' });
}
export async function liveGrant(
  slug: string,
  eventId: string,
  email: string,
): Promise<DoorStaffGrant> {
  const data = await liveTeam(slug);
  if (!data.grantableEvents.some((e) => e.id === eventId))
    throw new Error('Choose a published event that has not finished.');
  return apiFetch<Schemas['DoorStaffGrantResponse']>(`/events/${eventId}/door-staff`, {
    method: 'POST',
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
}
export async function liveStories(slug: string): Promise<StoryComposerData> {
  const club = await liveClub(slug);
  const events = await liveEvents(club.organizer.id);
  const stories: Schemas['Story'][] = [];
  let cursor: string | null = null;
  do {
    const page: Schemas['StoriesResponse'] = await apiFetch(
      `/stories?limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
      { cache: 'no-store' },
    );
    stories.push(...page.items.filter((s) => s.organizer.id === club.organizer.id));
    cursor = page.nextCursor;
  } while (cursor);
  return {
    organizerName: club.organizer.name,
    verified: club.organizer.isVerified,
    events: events
      .filter((e) => e.status === 'PUBLISHED' && Date.parse(e.endsAt) > Date.now())
      .map((e) => ({ id: e.id, title: e.title })),
    stories: stories.map((s) => ({
      ...s,
      eventTitle: events.find((e) => e.id === s.eventId)?.title ?? null,
    })),
  };
}
export async function livePostStory(slug: string, draft: StoryDraft): Promise<OrganizerStory> {
  const errors = validateStory(draft);
  if (errors.length) throw new Error(errors[0]);
  if (!draft.file) throw new Error('Choose a photo or video before posting.');
  const club = await liveClub(slug);
  const uploaded = await uploadPublicMedia(draft.file, 'STORY_MEDIA');
  const story = await apiFetch<Schemas['Story']>('/stories', {
    method: 'POST',
    body: JSON.stringify({
      organizerId: club.organizer.id,
      mediaUrl: uploaded.publicUrl,
      mediaType: draft.mediaType,
      caption: draft.caption || null,
      eventId: draft.eventId,
    }),
  });
  return { ...story, eventTitle: null };
}
