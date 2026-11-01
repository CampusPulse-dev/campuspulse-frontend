'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Badge, CategoryPill } from '@/components/ui/Badge';
import { Avatar, FriendAvatarStack } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth-context';
import { formatWatDateTime, SEED_EVENTS, type EnrichedEvent } from '@/lib/campus-data';
import {
  buildIcsCalendarContent,
  getOfflineTicketForEvent,
  saveOfflineTicket,
  type OfflineTicketPass,
} from '@/lib/offline-tickets';
import { fadeInUp } from '@/lib/motion';
import styles from './EventDetail.module.css';

export interface EventDetailViewProps {
  event: EnrichedEvent;
  isSignedOutPreview?: boolean;
}

export function EventDetailView({ event, isSignedOutPreview = false }: EventDetailViewProps) {
  const { user, interestedEventIds, toggleInterested } = useAuth();
  const { pushToast } = useToast();

  const [savedTicket, setSavedTicket] = useState<OfflineTicketPass | null>(() =>
    isSignedOutPreview ? null : null,
  );
  const [selectedShowtimeId, setSelectedShowtimeId] = useState<string | null>(
    event.showtimes?.[0]?.id ?? null,
  );
  const [showDirections, setShowDirections] = useState(false);
  const [showConfirmSheet, setShowConfirmSheet] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [afterPartyAdded, setAfterPartyAdded] = useState(false);

  const isInterested = interestedEventIds.includes(event.id);
  const wat = formatWatDateTime(event.startsAt);
  const spotsLeft = event.capacity !== null ? Math.max(0, event.capacity - event.rsvpCount) : null;
  const isLowCapacity =
    event.capacity !== null && spotsLeft !== null && spotsLeft / event.capacity <= 0.15;

  const activeTicket =
    savedTicket ?? (!isSignedOutPreview ? getOfflineTicketForEvent(event.id) : null);

  function handleRsvpClick() {
    const selectedShowtime = event.showtimes?.find((st) => st.id === selectedShowtimeId);
    const ticket = saveOfflineTicket({
      event,
      attendeeName: user?.displayName ?? 'Tobi Adeyemi',
      isVerifiedStudent: user?.isVerifiedStudent ?? true,
      showtimeLabel: selectedShowtime?.label ?? null,
    });
    setSavedTicket(ticket);
    setShowConfirmSheet(true);
    pushToast('Free RSVP confirmed! QR pass saved offline.', 'success');
  }

  function handleAddAfterParty() {
    if (!event.linkedAfterParty) return;
    const afterPartyEvent = SEED_EVENTS.find((item) => item.slug === event.linkedAfterParty?.slug);
    if (afterPartyEvent) {
      saveOfflineTicket({
        event: afterPartyEvent,
        attendeeName: user?.displayName ?? 'Tobi Adeyemi',
        isVerifiedStudent: user?.isVerifiedStudent ?? true,
      });
      setAfterPartyAdded(true);
      pushToast('Official After-Party added to Your Night timeline!', 'success');
    }
  }

  function handleDownloadCalendar() {
    const ics = buildIcsCalendarContent(event);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${event.slug}.ics`;
    link.click();
    URL.revokeObjectURL(url);
    pushToast('Calendar invite (.ics) downloaded.', 'info');
  }

  function handleToggleInterested() {
    const added = toggleInterested(event.id);
    pushToast(
      added
        ? 'Saved to Interested — we will nudge you 3h before doors open.'
        : 'Removed from Interested',
      'info',
    );
  }

  function handleReportSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reportReason.trim()) return;
    setShowReportModal(false);
    setReportReason('');
    pushToast('Report submitted to CampusPulse Moderation.', 'warning');
  }

  const whatsappShareHref = `https://wa.me/?text=${encodeURIComponent(
    `${event.title} · ${wat.compactLabel} at ${event.venueName} — RSVP free on CampusPulse: https://campuspulse.ng/e/${event.slug}`,
  )}`;

  return (
    <article className={styles.pageGrid}>
      <div className={styles.mainCol}>
        {/* 1. Hero Poster & Category/Organizer Strip */}
        <motion.div
          className={`${styles.heroPoster} ${
            event.template === 'CONCERT_PARTY' ? styles.posterVertical : ''
          }`}
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
        >
          <div className={styles.heroOverlayTop}>
            <CategoryPill category={event.category} />
            {event.studentsOnly ? (
              <Badge variant="warning">🎓 UI Students Only (@stu.ui.edu.ng)</Badge>
            ) : (
              <Badge variant="success">Open Campus Event</Badge>
            )}
          </div>

          <div className={styles.heroGraphic} aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo.svg" alt="" className={styles.heroWatermark} />
          </div>

          <div className={styles.heroScrim}>
            <Link href={`/o/${event.organizer.slug}`} className={styles.organizerChip}>
              <Avatar
                name={event.organizer.name}
                src={event.organizer.logoUrl}
                size="sm"
                isVerified={event.organizer.isVerified}
              />
              <span className={styles.organizerName}>{event.organizer.name}</span>
              {event.organizer.isVerified ? <Badge variant="verified">Verified Club</Badge> : null}
            </Link>
            <h1 className={styles.eventTitle}>{event.title}</h1>
          </div>
        </motion.div>

        {/* 2. Core Vitals Strip */}
        <section className={styles.vitalsCard} aria-label="Event Vitals">
          <div className={styles.vitalItem}>
            <span className={styles.vitalIcon} aria-hidden="true">
              🗓️
            </span>
            <div>
              <div className={styles.vitalPrimary}>{wat.dateLabel}</div>
              <div className={styles.vitalMono}>{wat.timeLabel} · Africa/Lagos</div>
            </div>
          </div>

          <div className={styles.vitalItem}>
            <span className={styles.vitalIcon} aria-hidden="true">
              📍
            </span>
            <div className={styles.vitalFlex}>
              <div className={styles.vitalPrimary}>{event.venueName}</div>
              {event.venueDetail ? (
                <button
                  type="button"
                  className={styles.directionsToggle}
                  onClick={() => setShowDirections((prev) => !prev)}
                >
                  {showDirections ? 'Hide venue directions ▲' : 'Show gate & directions ▼'}
                </button>
              ) : null}
              {showDirections && event.venueDetail ? (
                <p className={styles.venueDirections}>{event.venueDetail}</p>
              ) : null}
            </div>
          </div>

          <div className={styles.vitalItem}>
            <span className={styles.vitalIcon} aria-hidden="true">
              🎟️
            </span>
            <div className={styles.vitalBadges}>
              <span className={styles.vitalMono}>
                {event.rsvpCount + (savedTicket ? 1 : 0)} going
                {spotsLeft !== null ? ` · ${spotsLeft} spots left` : ''}
              </span>
              {isLowCapacity ? <Badge variant="warning">Filling Fast</Badge> : null}
              {event.dressCode ? <Badge variant="default">👕 {event.dressCode}</Badge> : null}
            </div>
          </div>
        </section>

        {/* 3. Mutual Social Proof Strip */}
        <section className={styles.socialStrip} aria-label="Friends Going">
          <FriendAvatarStack friends={event.friendsGoing} totalCount={event.friendsGoingCount} />
          <a
            href={whatsappShareHref}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.whatsappShareBtn}
          >
            📲 Invite via WhatsApp
          </a>
        </section>

        {/* 4. Template-Specific Blocks */}
        {event.template === 'MATCH_TOURNAMENT' && event.fixture ? (
          <section className={styles.scoreboardCard} aria-label="Live Match Scoreboard">
            <div className={styles.scoreboardTop}>
              <Badge variant="live">{event.fixture.periodLabel}</Badge>
              <span className={styles.scoreboardVenue}>{event.venueName}</span>
            </div>
            <div className={styles.scoreboardTeams}>
              <div className={styles.teamCol}>
                <span className={styles.teamName}>{event.fixture.homeTeam}</span>
              </div>
              <div className={styles.scoreDigits}>
                <span>{event.fixture.homeScore}</span>
                <span className={styles.scoreDivider}>:</span>
                <span>{event.fixture.awayScore}</span>
              </div>
              <div className={styles.teamCol}>
                <span className={styles.teamName}>{event.fixture.awayTeam}</span>
              </div>
            </div>
          </section>
        ) : null}

        {event.template === 'CONCERT_PARTY' && event.lineup && event.lineup.length > 0 ? (
          <section className={styles.templateSection}>
            <h2 className={styles.sectionHeading}>Stage Lineup & Set Times</h2>
            <div className={styles.lineupGrid}>
              {event.lineup.map((slot) => (
                <div key={slot.id} className={styles.lineupCard}>
                  <div>
                    <div className={styles.performerName}>{slot.performerName}</div>
                    <div className={styles.performerRole}>{slot.role}</div>
                  </div>
                  <span className={styles.setTimePill}>{slot.setTime}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {event.template === 'PLAY_CULTURAL' && event.showtimes && event.showtimes.length > 0 ? (
          <section className={styles.templateSection}>
            <h2 className={styles.sectionHeading}>Select Showtime</h2>
            <div className={styles.showtimeRow}>
              {event.showtimes.map((st) => {
                const active = st.id === selectedShowtimeId;
                return (
                  <button
                    key={st.id}
                    type="button"
                    aria-pressed={active}
                    className={`${styles.showtimeChip} ${active ? styles.showtimeActive : ''}`}
                    onClick={() => setSelectedShowtimeId(st.id)}
                  >
                    <span>{st.label}</span>
                    <span className={styles.spotsTag}>{st.spotsLeft} left</span>
                  </button>
                );
              })}
            </div>
            {event.castAndCrew && event.castAndCrew.length > 0 ? (
              <div className={styles.castBlock}>
                <h3 className={styles.castHeading}>Cast & Production Credits</h3>
                <ul className={styles.castList}>
                  {event.castAndCrew.map((credit) => (
                    <li key={credit}>{credit}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}

        {event.doorPolicy ? (
          <section className={styles.doorPolicyBox}>
            <strong>🚪 Door & Entry Policy:</strong> {event.doorPolicy}
          </section>
        ) : null}

        {/* 5. About / Description */}
        <section className={styles.templateSection}>
          <h2 className={styles.sectionHeading}>About This Event</h2>
          <p className={styles.descriptionText}>{event.description}</p>
        </section>

        {/* 6. Linked After-Party Card */}
        {event.linkedAfterParty ? (
          <section className={styles.afterPartyCard} aria-label="Official Linked After-Party">
            <div className={styles.afterPartyBadgeRow}>
              <Badge variant="verified">🌙 Linked Official After-Party</Badge>
              <span className={styles.vitalMono}>
                {formatWatDateTime(event.linkedAfterParty.startsAt).timeLabel}
              </span>
            </div>
            <h3 className={styles.afterPartyTitle}>{event.linkedAfterParty.title}</h3>
            <p className={styles.afterPartyVenue}>
              📍 {event.linkedAfterParty.venueName} ·{' '}
              {event.linkedAfterParty.accessRule === 'CHECKED_IN_PRIORITY'
                ? 'Checked-in guests get priority entry'
                : 'Checked-in guests only'}
            </p>
            <div className={styles.afterPartyActions}>
              <Link href={`/e/${event.linkedAfterParty.slug}`} className={styles.afterPartyLink}>
                View After-Party Details →
              </Link>
              {!afterPartyAdded ? (
                <Button size="sm" variant="secondary" onClick={handleAddAfterParty}>
                  + Add to &ldquo;Your Night&rdquo;
                </Button>
              ) : (
                <Badge variant="success">✓ Added to Your Night</Badge>
              )}
            </div>
          </section>
        ) : null}

        {/* 8. Footer Report Link */}
        <footer className={styles.eventFooter}>
          <button
            type="button"
            className={styles.reportLink}
            onClick={() => setShowReportModal(true)}
          >
            🚩 Report this event to CampusPulse Moderation
          </button>
        </footer>
      </div>

      {/* 7. Sticky Commitment Bar (Right Rail on Desktop, Bottom Bar on Mobile) */}
      <aside className={styles.commitmentRail} aria-label="RSVP Commitment Controls">
        <div className={styles.commitmentCard}>
          <div className={styles.commitmentMeta}>
            <span className={styles.priceLabel}>Free Entry · Offline QR</span>
            <span className={styles.capacitySub}>
              {spotsLeft !== null ? `${spotsLeft} spots left` : `${event.rsvpCount} going`}
            </span>
          </div>

          <div className={styles.commitmentButtons}>
            <button
              type="button"
              aria-pressed={isInterested}
              className={`${styles.interestedBtn} ${isInterested ? styles.interestedActive : ''}`}
              onClick={handleToggleInterested}
              title="Mark as Interested"
            >
              {isInterested ? '★ Interested' : '☆ Interested'}
            </button>

            {savedTicket ? (
              <div className={styles.confirmedStack}>
                <Badge variant="success">Going ✓ · Offline QR Saved</Badge>
                <Link href={`/tickets/${savedTicket.rsvpId}`} className={styles.viewQrLink}>
                  View Offline QR Pass →
                </Link>
              </div>
            ) : (
              <Button size="lg" fullWidth onClick={handleRsvpClick}>
                RSVP — Free
              </Button>
            )}
          </div>

          {activeTicket && !savedTicket ? (
            <div className={styles.existingTicketHint}>
              <Link href={`/tickets/${activeTicket.rsvpId}`} className={styles.viewQrLinkSubtle}>
                🎟️ You already have a saved QR pass for this event →
              </Link>
            </div>
          ) : null}
        </div>
      </aside>

      {/* Post-RSVP Confirmation Modal */}
      <Modal
        isOpen={showConfirmSheet}
        title="You're Locked In! 🎟️"
        subtitle="Your QR pass is cached on this device and works offline at the door."
        onClose={() => setShowConfirmSheet(false)}
      >
        <div className={styles.confirmSheetBody}>
          <div className={styles.confirmPassSummary}>
            <strong>{event.title}</strong>
            <span>
              {wat.compactLabel} · {event.venueName}
            </span>
            <Badge variant="success">Available Offline ✓</Badge>
          </div>

          <div className={styles.confirmSheetActions}>
            {savedTicket ? (
              <Link href={`/tickets/${savedTicket.rsvpId}`} className={styles.primaryModalLink}>
                Open Offline QR Pass →
              </Link>
            ) : null}
            <Button variant="secondary" fullWidth onClick={handleDownloadCalendar}>
              📅 Add to Calendar (.ics)
            </Button>
            {event.linkedAfterParty && !afterPartyAdded ? (
              <Button variant="accent" fullWidth onClick={handleAddAfterParty}>
                🌙 Also Lock In Official After-Party (10:30 PM)
              </Button>
            ) : null}
          </div>
        </div>
      </Modal>

      {/* Report Event Modal */}
      <Modal
        isOpen={showReportModal}
        title="Report This Event"
        subtitle="Reviewed by CampusPulse Moderators within our <48h SLA."
        onClose={() => setShowReportModal(false)}
      >
        <form onSubmit={handleReportSubmit} className={styles.reportForm}>
          <label className={styles.reportLabel}>
            <span>Reason for report</span>
            <textarea
              required
              rows={3}
              className={styles.reportTextarea}
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Describe the issue (e.g., wrong venue, impersonating a UI club, spam)..."
            />
          </label>
          <Button type="submit" variant="danger" fullWidth>
            Submit Report
          </Button>
        </form>
      </Modal>
    </article>
  );
}
