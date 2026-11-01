'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Badge, CategoryPill } from '@/components/ui/Badge';
import { Avatar, FriendAvatarStack } from '@/components/ui/Avatar';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth-context';
import { formatWatDateTime, type EnrichedEvent } from '@/lib/campus-data';
import { getOfflineTicketForEvent, saveOfflineTicket } from '@/lib/offline-tickets';
import { apiFetch, type CreateRsvpResponse } from '@/lib/api';
import { DEMO_MODE } from '@/lib/mode';
import { fadeInUp } from '@/lib/motion';
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
      pushToast(e instanceof Error ? e.message : 'Unable to save interest.', 'warning');
    }
  }

  return (
    <motion.article
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className={`${styles.eventCard} ${compact ? styles.compactCard : ''}`}
    >
      {/* Top Banner: Category Pill + Timestamp */}
      <div className={styles.cardTopBar}>
        <CategoryPill category={event.category} />
        <span className={styles.cardTimeMono}>{wat.compactLabel} WAT</span>
      </div>

      {/* Template-Specific Header Treatments */}
      {event.template === 'MATCH_TOURNAMENT' && event.fixture ? (
        <div className={styles.matchBanner}>
          <div className={styles.matchTopRow}>
            <Badge variant="live">{event.fixture.periodLabel}</Badge>
            <span className={styles.matchVenueSub}>{event.venueName}</span>
          </div>
          <div className={styles.matchScoreRow}>
            <span className={styles.matchTeam}>{event.fixture.homeTeam}</span>
            <span className={styles.matchScore}>
              {event.fixture.homeScore} — {event.fixture.awayScore}
            </span>
            <span className={styles.matchTeam}>{event.fixture.awayTeam}</span>
          </div>
        </div>
      ) : null}

      {/* Organizer Row */}
      <div className={styles.organizerRow}>
        <Link href={`/o/${event.organizer.slug}`} className={styles.organizerLink}>
          <Avatar
            name={event.organizer.name}
            src={event.organizer.logoUrl}
            size="sm"
            isVerified={event.organizer.isVerified}
          />
          <span>{event.organizer.name}</span>
        </Link>
        {event.studentsOnly ? <Badge variant="warning">UI Students Only</Badge> : null}
      </div>

      {/* Title & Venue */}
      <Link href={`/e/${event.slug}`} className={styles.titleLink}>
        <h3 className={styles.cardTitle}>{event.title}</h3>
      </Link>
      <p className={styles.cardVenue}>
        📍 {event.venueName}
        {spotsLeft !== null ? (
          <span className={styles.spotsMono}> · {spotsLeft} spots left</span>
        ) : null}
      </p>

      {/* Template Chips: Lineup or Showtimes */}
      {!compact && event.template === 'CONCERT_PARTY' && event.lineup ? (
        <div className={styles.chipRow}>
          {event.lineup.map((item) => (
            <span key={item.id} className={styles.metaChip}>
              🎵 {item.performerName} ({item.setTime})
            </span>
          ))}
        </div>
      ) : null}

      {!compact && event.template === 'PLAY_CULTURAL' && event.showtimes ? (
        <div className={styles.chipRow}>
          {event.showtimes.map((st) => (
            <span key={st.id} className={styles.metaChip}>
              🎭 {st.label} · {st.spotsLeft} left
            </span>
          ))}
        </div>
      ) : null}

      {/* Mutual Friends Going + Action Row */}
      <div className={styles.cardFooter}>
        <FriendAvatarStack friends={event.friendsGoing} totalCount={event.friendsGoingCount} />

        <div className={styles.cardActions}>
          <button
            type="button"
            aria-pressed={isInterested}
            className={`${styles.starBtn} ${isInterested ? styles.starBtnActive : ''}`}
            onClick={interest}
            aria-label="Interested"
          >
            {isInterested ? '★' : '☆'}
          </button>

          {isGoing ? (
            <Link
              href={existingTicket ? `/tickets/${existingTicket.rsvpId}` : '/tickets'}
              className={styles.goingPillLink}
            >
              {existingTicket?.status === 'WAITLISTED' ? 'Waitlisted' : 'Going ✓'} · View Pass
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
              {!user ? 'Sign in to RSVP' : 'Choose showtime →'}
            </Link>
          ) : (
            <Button size="sm" isLoading={busy} onClick={handleQuickRsvp}>
              RSVP — Free
            </Button>
          )}
        </div>
      </div>
    </motion.article>
  );
}
