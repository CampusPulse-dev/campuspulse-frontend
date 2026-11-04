'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Bookmark, Check } from 'lucide-react';
import { Icon } from '@/components/ui/Icon';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { EventPoster } from './EventPoster';
import { Button } from '@/components/ui/Button';
import { Badge, CategoryPill } from '@/components/ui/Badge';
import { FriendAvatarStack } from '@/components/ui/Avatar';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth-context';
import { formatWatDateTime, type EnrichedEvent } from '@/lib/campus-data';
import { getOfflineTicketForEvent, saveOfflineTicket } from '@/lib/offline-tickets';
import { apiFetch, type CreateRsvpResponse } from '@/lib/api';
import { DEMO_MODE } from '@/lib/mode';
import styles from './HomeFeed.module.css';

export interface EventCardProps {
  event: EnrichedEvent;
  compact?: boolean;
}

export function EventCard({ event, compact = false }: EventCardProps) {
  const { user, accessToken, privacy, interestedEventIds, toggleInterested } = useAuth();
  const { pushToast } = useToast();
  const [justLockedIn, setJustLockedIn] = useState(false);
  const [busy, setBusy] = useState(false);

  const isInterested = interestedEventIds.includes(event.id);
  const existingTicket = getOfflineTicketForEvent(event.id);
  const isGoing = justLockedIn || Boolean(existingTicket);

  const wat = formatWatDateTime(event.startsAt);
  const spotsLeft = event.capacity !== null ? Math.max(0, event.capacity - event.rsvpCount) : null;

  async function handleQuickRsvp() {
    if (!user) return;
    setBusy(true);
    try {
      if (event.studentsOnly && !user.isVerifiedStudent)
        throw new Error('Verify your student status before reserving this event.');
      if (!DEMO_MODE && !accessToken) throw new Error('Reconnect and sign in to reserve.');
      const rsvp = DEMO_MODE
        ? undefined
        : await apiFetch<CreateRsvpResponse>('/attendance/rsvps', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + accessToken },
            body: JSON.stringify({
              eventId: event.id,
              hideFromFriends: privacy.hideFromFriends || privacy.stealthRsvp,
            }),
          });
      const ticket = await saveOfflineTicket({
        accountId: user.id,
        event,
        attendeeName: user.displayName,
        isVerifiedStudent: user.isVerifiedStudent,
        rsvp,
      });
      setJustLockedIn(true);
      pushToast(
        ticket.status === 'CONFIRMED'
          ? 'RSVP saved. Open your ticket to prepare offline access.'
          : 'You are on the waitlist.',
        'success',
      );
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Unable to reserve. Please retry.', 'warning');
    } finally {
      setBusy(false);
    }
  }
  async function interest() {
    try {
      await toggleInterested(event.id);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Unable to save event.', 'warning');
    }
  }

  const status = event.fixture?.isLive
    ? 'live'
    : spotsLeft !== null && event.capacity && spotsLeft / event.capacity <= 0.15
      ? 'capacity'
      : event.studentsOnly
        ? 'students'
        : null;
  const templateMeta = event.fixture
    ? event.fixture.homeTeam +
      ' ' +
      event.fixture.homeScore +
      ' — ' +
      event.fixture.awayScore +
      ' ' +
      event.fixture.awayTeam
    : (event.lineup?.map((item) => item.performerName).join(' · ') ??
      (event.showtimes?.length ? event.showtimes.length + ' showtimes' : null));
  return (
    <article className={[styles.eventCard, compact ? styles.compactCard : ''].join(' ')}>
      <div className={styles.poster}>
        <Link
          href={'/e/' + event.slug}
          className={styles.posterLink}
          aria-label={'View ' + event.title}
        >
          <EventPoster event={event} />
        </Link>
        <div className={styles.posterCategory}>
          <CategoryPill category={event.category} />
        </div>
        <button
          type="button"
          className={styles.starBtn}
          aria-pressed={isInterested}
          aria-label="Save event"
          onClick={interest}
        >
          <Icon icon={Bookmark} fill={isInterested ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className={styles.cardBody}>
        <div className={styles.cardHeading}>
          <Link href={'/e/' + event.slug} className={styles.titleLink}>
            <h3 className={styles.cardTitle}>{event.title}</h3>
          </Link>
          {status === 'live' ? (
            <LiveIndicator />
          ) : status === 'capacity' ? (
            <Badge variant="warning">Filling fast</Badge>
          ) : status === 'students' ? (
            <Badge>Students only</Badge>
          ) : null}
        </div>
        <p className={styles.cardVenue}>
          <time dateTime={event.startsAt}>{wat.compactLabel}</time>
          <span> · {event.venueName}</span>
        </p>
        {!compact && templateMeta ? <p className={styles.templateMeta}>{templateMeta}</p> : null}
        <div className={styles.cardFooter}>
          <FriendAvatarStack friends={event.friendsGoing} totalCount={event.friendsGoingCount} />
          <div className={styles.cardActions}>
            {isGoing ? (
              <Link
                href={existingTicket ? '/tickets/' + existingTicket.rsvpId : '/tickets'}
                className={styles.goingPillLink}
              >
                {existingTicket?.status === 'WAITLISTED' ? (
                  'Waitlisted'
                ) : (
                  <>
                    <Icon icon={Check} size={16} />
                    Going
                  </>
                )}
              </Link>
            ) : !user || event.showtimes?.length ? (
              <Link
                href={
                  !user
                    ? '/sign-in?next=' + encodeURIComponent('/e/' + event.slug)
                    : '/e/' + event.slug
                }
                className={styles.goingPillLink}
              >
                {event.showtimes?.length ? 'Choose showtime' : 'RSVP — Free'}
              </Link>
            ) : (
              <Button size="sm" isLoading={busy} onClick={handleQuickRsvp}>
                RSVP — Free
              </Button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
