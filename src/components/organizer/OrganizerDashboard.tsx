'use client';
import { useAuth } from '@/lib/auth-context';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { VerifiedMark } from '@/components/ui/VerifiedMark';
import { Badge } from '@/components/ui/Badge';
import { ResourceState } from '@/components/attendee/Shared';
import { formatWatDateTime } from '@/lib/campus-data';
import {
  fetchOrganizerDashboard,
  groupEvents,
  type OrganizerDashboardData,
  type OrganizerEventSummary,
} from '@/lib/organizer-data';
import { ClubGate } from './OrganizerGate';
import styles from './Organizer.module.css';

function percent(value: number | null) {
  return value === null ? '—' : `${Math.round(value * 100)}%`;
}

function EventRow({
  event,
  group,
  organizerSlug,
}: {
  event: OrganizerEventSummary;
  group: 'live' | 'upcoming' | 'drafts' | 'past';
  organizerSlug: string;
}) {
  const when = event.startsAt ? formatWatDateTime(event.startsAt) : null;
  const showUp =
    event.checkInCount !== null && event.rsvpCount > 0 && group === 'past'
      ? event.checkInCount / event.rsvpCount
      : null;
  return (
    <li className={styles.eventRow}>
      <div className={styles.eventMain}>
        <h3 className={styles.eventTitle}>
          {group === 'drafts' ? (
            <Link href={`/organizer/${organizerSlug}/events/${event.id}/edit`}>{event.title}</Link>
          ) : (
            <Link href={`/organizer/${organizerSlug}/events/${event.id}`}>{event.title}</Link>
          )}
        </h3>
        <div className={styles.eventMeta}>
          {when ? <span>{when.compactLabel} WAT</span> : <span>Not scheduled yet</span>}
          {event.venueName ? <span>{event.venueName}</span> : null}
          {group !== 'drafts' ? (
            <span className={styles.mono}>
              {event.rsvpCount}
              {event.capacity !== null ? ` / ${event.capacity}` : ''} RSVPs
            </span>
          ) : null}
          {showUp !== null ? <span className={styles.mono}>Show-up {percent(showUp)}</span> : null}
        </div>
      </div>
      {group === 'live' ? (
        <Link href={`/organizer/door/${event.id}`} className={styles.linkButton}>
          Open Door Scanner
        </Link>
      ) : group === 'drafts' ? (
        <Badge variant="default">Draft</Badge>
      ) : group === 'past' ? (
        <Badge variant="default">{event.status === 'CANCELLED' ? 'Cancelled' : 'Finished'}</Badge>
      ) : (
        <Badge variant="default">Published</Badge>
      )}
    </li>
  );
}

const GROUP_TITLES = {
  live: 'Live / Today',
  upcoming: 'Upcoming',
  drafts: 'Drafts',
  past: 'Past',
} as const;

export function OrganizerDashboardView({
  data,
  now = new Date(),
  eventsOnly = false,
}: {
  eventsOnly?: boolean;
  data: OrganizerDashboardData;
  now?: Date;
}) {
  const { organizer, verification, kpis } = data;
  const groups = groupEvents(data.events, now);
  const verified = verification.status === 'VERIFIED';

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <div className={styles.titleRow}>
            <h1>{eventsOnly ? 'Events' : organizer.name}</h1>
            {verified ? <VerifiedMark /> : null}
          </div>
        </div>
        <Link href={`/organizer/${organizer.slug}/events/new`} className={styles.linkButton}>
          New event
        </Link>
      </header>

      {!verified ? (
        <section className={styles.banner} role="status" aria-label="Club verification status">
          <h2>{verification.status === 'MORE_INFO' ? 'More info requested' : 'Pending review'}</h2>
          {verification.reviewerNote ? <p>{verification.reviewerNote}</p> : null}
          <p>You can save drafts now. Publishing unlocks once your club is verified.</p>
        </section>
      ) : null}

      {!eventsOnly ? (
        <dl className={styles.kpis} aria-label="Club performance">
          <div className={styles.kpi}>
            <dt>Followers</dt>
            <dd>{kpis.followers.toLocaleString('en-NG')}</dd>
          </div>
          <div className={styles.kpi}>
            <dt>Upcoming RSVPs</dt>
            <dd>{kpis.upcomingRsvps.toLocaleString('en-NG')}</dd>
          </div>
          <div className={styles.kpi}>
            <dt>Avg show-up rate</dt>
            <dd>{percent(kpis.showUpRate)}</dd>
          </div>
          <div className={styles.kpi}>
            <dt>Active stories</dt>
            <dd>{kpis.activeStories}</dd>
          </div>
        </dl>
      ) : null}

      {data.events.length === 0 ? (
        <div className={styles.emptyState}>
          <h2>No events yet</h2>
          <p className={styles.muted}>Create your first event to start collecting RSVPs.</p>
          <Link href={`/organizer/${organizer.slug}/events/new`} className={styles.linkButton}>
            Create an event
          </Link>
        </div>
      ) : (
        (['live', 'upcoming', 'drafts', 'past'] as const).map((key) =>
          groups[key].length > 0 ? (
            <section key={key} className={styles.group} aria-labelledby={`group-${key}`}>
              <h2 id={`group-${key}`}>{GROUP_TITLES[key]}</h2>
              <ul className={styles.eventList}>
                {groups[key].map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    group={key}
                    organizerSlug={organizer.slug}
                  />
                ))}
              </ul>
            </section>
          ) : null,
        )
      )}
    </div>
  );
}

function DashboardData({ slug, eventsOnly }: { slug: string; eventsOnly?: boolean }) {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['organizer-dashboard', slug, user?.id],
    queryFn: () => fetchOrganizerDashboard(slug),
  });
  if (!query.data) {
    return <ResourceState pending={query.isPending} error={query.error} retry={query.refetch} />;
  }
  return <OrganizerDashboardView data={query.data} eventsOnly={eventsOnly} />;
}

export function OrganizerDashboard({ slug, eventsOnly }: { slug: string; eventsOnly?: boolean }) {
  return (
    <ClubGate slug={slug}>{() => <DashboardData slug={slug} eventsOnly={eventsOnly} />}</ClubGate>
  );
}
