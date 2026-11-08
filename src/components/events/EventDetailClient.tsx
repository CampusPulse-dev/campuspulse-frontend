'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, MapPin, Ticket, Shirt, Bookmark, Share2 } from 'lucide-react';
import { Icon } from '@/components/ui/Icon';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { VerifiedMark } from '@/components/ui/VerifiedMark';
import { ListRow } from '@/components/ui/ListRow';
import { Section } from '@/components/ui/Section';
import { TextArea } from '@/components/ui/Field';
import { EventPoster } from './EventPoster';
import { SiteFooter } from '@/components/landing/SiteFooter';
import { Button } from '@/components/ui/Button';
import { Badge, CategoryPill } from '@/components/ui/Badge';
import { FriendAvatarStack } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth-context';
import { formatWatDateTime, type EnrichedEvent } from '@/lib/campus-data';
import {
  buildIcsCalendarContent,
  getOfflineTicketForEvent,
  saveOfflineTicket,
  type OfflineTicketPass,
} from '@/lib/offline-tickets';
import { apiFetch, fetchEventBySlug, type CreateRsvpResponse } from '@/lib/api';
import { DEMO_MODE } from '@/lib/mode';
import { loadOfflineTickets } from '@/lib/offline-tickets';
import styles from './EventDetail.module.css';

export interface EventDetailViewProps {
  event: EnrichedEvent;
  isSignedOutPreview?: boolean;
  returnTo?: string;
}

export function EventDetailView({
  event,
  isSignedOutPreview = false,
  returnTo,
}: EventDetailViewProps) {
  const { user, accessToken, privacy, interestedEventIds, toggleInterested } = useAuth();
  const { pushToast } = useToast();

  const [savedTicket, setSavedTicket] = useState<OfflineTicketPass | null>(null);
  const [selectedShowtimeId, setSelectedShowtimeId] = useState<string | null>(
    event.showtimes?.[0]?.id ?? null,
  );
  const [showDirections, setShowDirections] = useState(false);
  const [showConfirmSheet, setShowConfirmSheet] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [afterPartyAdded, setAfterPartyAdded] = useState(false);

  useEffect(() => {
    if (user)
      void loadOfflineTickets()
        .then(() => setSavedTicket(getOfflineTicketForEvent(event.id)))
        .catch(() => {});
  }, [user, event.id]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const isInterested = interestedEventIds.includes(event.id);
  const wat = formatWatDateTime(event.startsAt);
  const spotsLeft = event.capacity !== null ? Math.max(0, event.capacity - event.rsvpCount) : null;
  const activeTicket =
    savedTicket ?? (!isSignedOutPreview ? getOfflineTicketForEvent(event.id) : null);

  async function reserve(target: EnrichedEvent) {
    if (!user) throw new Error('Sign in to RSVP.');
    // The showtime picker belongs to this page's event; a linked after-party has its own schedule.
    const showtimeId = target.id === event.id ? selectedShowtimeId : null;
    const selected = target.showtimes?.find((s) => s.id === showtimeId);
    if (selected && selected.spotsLeft <= 0)
      throw new Error('This showtime is full. Choose another time.');
    if (target.studentsOnly && !user.isVerifiedStudent)
      throw new Error('Verify your student status before RSVPing.');
    if (!DEMO_MODE && !accessToken) throw new Error('Reconnect and sign in to RSVP.');
    const rsvp = DEMO_MODE
      ? undefined
      : await apiFetch<CreateRsvpResponse>('/attendance/rsvps', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + accessToken },
          body: JSON.stringify({
            eventId: target.id,
            hideFromFriends: privacy.hideFromFriends || privacy.stealthRsvp,
            showtimeId: showtimeId ?? undefined,
            ambassadorCode: new URLSearchParams(window.location.search).get('ref') ?? undefined,
            inviteCode: new URLSearchParams(window.location.search).get('invite') ?? undefined,
          }),
        });
    return saveOfflineTicket({
      accountId: user.id,
      event: target,
      attendeeName: user.displayName,
      isVerifiedStudent: user.isVerifiedStudent,
      showtimeLabel: selected?.label,
      rsvp,
    });
  }
  async function handleRsvpClick() {
    setActionError(null);
    setBusy(true);
    try {
      const ticket = await reserve(event);
      setSavedTicket(ticket);
      setShowConfirmSheet(true);
      pushToast(
        ticket.status === 'WAITLISTED' ? 'You are on the waitlist.' : 'RSVP saved on this device.',
        'success',
      );
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to RSVP. Please retry.');
    } finally {
      setBusy(false);
    }
  }
  // "Sign in & continue" comes back with ?autoRsvp=1; finish the RSVP once, then drop the flag
  // so a refresh or back-navigation can't fire it again.
  const autoRsvpHandled = useRef(false);
  useEffect(() => {
    if (!user || isSignedOutPreview || autoRsvpHandled.current) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('autoRsvp') !== '1') return;
    autoRsvpHandled.current = true;
    url.searchParams.delete('autoRsvp');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    if (!activeTicket) queueMicrotask(() => void handleRsvpClick());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, when the signed-in user is known
  }, [user, isSignedOutPreview]);

  async function handleAddAfterParty() {
    if (!event.linkedAfterParty) return;
    try {
      const target = await fetchEventBySlug(event.linkedAfterParty.slug);
      if (!target) throw new Error('After-party unavailable.');
      await reserve(target);
      setAfterPartyAdded(true);
      pushToast('After-party added to Your Night.', 'success');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Please retry.');
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

  async function handleToggleInterested() {
    try {
      const added = await toggleInterested(event.id);
      pushToast(added ? 'Saved. Find it under Tickets → Saved.' : 'Removed from Saved.', 'info');
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Unable to save event.');
    }
  }

  async function handleReportSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reportReason.trim()) return;
    if (!user) {
      setActionError('Sign in to submit a report.');
      return;
    }
    try {
      if (!DEMO_MODE)
        await apiFetch('/reports', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + accessToken },
          body: JSON.stringify({ eventId: event.id, reason: reportReason }),
        });
    } catch {
      setActionError('Report could not be submitted. Please retry.');
      return;
    }
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
        <div className={styles.heroPoster}>
          <EventPoster event={event} detail />
          <div className={styles.heroOverlayTop}>
            <CategoryPill category={event.category} />
            {event.studentsOnly ? <Badge>Students only</Badge> : null}
          </div>
          <div className={styles.heroScrim}>
            <Link href={'/o/' + event.organizer.slug} className={styles.organizerChip}>
              <span>{event.organizer.name}</span>
              {event.organizer.isVerified ? <VerifiedMark /> : null}
            </Link>
            <h1 className={styles.eventTitle}>{event.title}</h1>
          </div>
        </div>
        <Section title="Details">
          <ListRow icon={CalendarDays} title={wat.dateLabel} meta={wat.timeLabel} />
          <ListRow icon={MapPin} title={event.venueName}>
            {event.venueDetail ? (
              <>
                <button
                  type="button"
                  className={styles.directionsToggle}
                  aria-expanded={showDirections}
                  onClick={() => setShowDirections((value) => !value)}
                >
                  Gate &amp; directions
                </button>
                {showDirections ? (
                  <p className={styles.venueDirections}>{event.venueDetail}</p>
                ) : null}
              </>
            ) : null}
          </ListRow>
          <ListRow
            icon={Ticket}
            title="Free entry"
            meta={event.studentsOnly ? 'Verified UI students only' : 'Open campus event'}
          />
          {event.dressCode ? (
            <ListRow icon={Shirt} title="Dress code" meta={event.dressCode} />
          ) : null}
        </Section>
        <div className={styles.socialStrip}>
          <FriendAvatarStack friends={event.friendsGoing} totalCount={event.friendsGoingCount} />
          <a
            href={whatsappShareHref}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.whatsappShareBtn}
          >
            <Icon icon={Share2} size={18} />
            Invite via WhatsApp
          </a>
        </div>
        {/* 4. Template-Specific Blocks */}
        {event.template === 'MATCH_TOURNAMENT' && event.fixture ? (
          <section className={styles.scoreboardCard} aria-label="Live Match Scoreboard">
            <div className={styles.scoreboardTop}>
              <LiveIndicator label={event.fixture.periodLabel} />
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
            <h2 className={styles.sectionHeading}>Lineup & set times</h2>
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
            <strong>Door &amp; entry policy: </strong>
            {event.doorPolicy}
          </section>
        ) : null}

        {/* 5. About / Description */}
        <section className={styles.templateSection}>
          <h2 className={styles.sectionHeading}>About this event</h2>
          <p className={styles.descriptionText}>{event.description}</p>
        </section>

        {event.linkedAfterParty ? (
          <Section title="Keep the night going">
            <ListRow
              title={event.linkedAfterParty.title}
              href={'/e/' + event.linkedAfterParty.slug}
              meta={
                formatWatDateTime(event.linkedAfterParty.startsAt).timeLabel +
                ' · ' +
                event.linkedAfterParty.venueName
              }
            />
            <p className={styles.afterPartyVenue}>
              {event.linkedAfterParty.accessRule === 'OPEN'
                ? 'Open entry'
                : event.linkedAfterParty.accessRule === 'PRIORITY_CHECKED_IN'
                  ? 'Checked-in guests get priority entry'
                  : 'Checked-in guests only'}
            </p>
            {!afterPartyAdded ? (
              <Button variant="secondary" size="sm" onClick={handleAddAfterParty}>
                Add to Your Night
              </Button>
            ) : (
              <Badge variant="success">Added to Your Night</Badge>
            )}
          </Section>
        ) : null}
        {/* 8. Footer Report Link */}
        <footer className={styles.eventFooter}>
          <button
            type="button"
            className={styles.reportLink}
            onClick={() => setShowReportModal(true)}
          >
            Report this event
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
            {actionError ? <p role="alert">{actionError}</p> : null}
            <button
              type="button"
              aria-label="Save event"
              aria-pressed={isInterested}
              className={styles.interestedBtn}
              onClick={handleToggleInterested}
            >
              <Icon icon={Bookmark} fill={isInterested ? 'currentColor' : 'none'} />
            </button>
            {!user ? (
              <Link
                className={styles.primaryModalLink}
                href={
                  '/sign-in?autoRsvp=1&next=' + encodeURIComponent(returnTo ?? '/e/' + event.slug)
                }
              >
                Sign in to RSVP
              </Link>
            ) : event.studentsOnly && !user.isVerifiedStudent ? (
              <Link href="/verify" className={styles.primaryModalLink}>
                Verify to RSVP
              </Link>
            ) : activeTicket ? (
              <Link href={'/tickets/' + activeTicket.rsvpId} className={styles.primaryModalLink}>
                {activeTicket.status === 'WAITLISTED' ? 'View waitlist' : 'View QR pass'}
              </Link>
            ) : (
              <Button size="lg" onClick={handleRsvpClick} isLoading={busy}>
                RSVP — Free
              </Button>
            )}
          </div>
        </div>
      </aside>
      <div className={styles.publicFooter}>
        <SiteFooter />
      </div>

      {/* Post-RSVP Confirmation Modal */}
      <Modal
        isOpen={showConfirmSheet}
        title={
          savedTicket?.status === 'WAITLISTED' ? 'You are on the waitlist' : 'Your RSVP is saved'
        }
        subtitle="Open your pass online once to prepare it for offline access."
        onClose={() => setShowConfirmSheet(false)}
      >
        <div className={styles.confirmSheetBody}>
          <div className={styles.confirmPassSummary}>
            <strong>{event.title}</strong>
            <span>
              {wat.compactLabel} · {event.venueName}
            </span>
            <Badge variant="success">Saved on this device</Badge>
          </div>

          <div className={styles.confirmSheetActions}>
            {savedTicket ? (
              <Link href={`/tickets/${savedTicket.rsvpId}`} className={styles.primaryModalLink}>
                Open Offline QR Pass →
              </Link>
            ) : null}
            <Button variant="secondary" fullWidth onClick={handleDownloadCalendar}>
              Add to calendar
            </Button>
            {event.linkedAfterParty && !afterPartyAdded ? (
              <Button variant="secondary" fullWidth onClick={handleAddAfterParty}>
                Add the after-party
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
          <TextArea
            label="Reason for report"
            required
            rows={3}
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder="Tell us what needs attention."
          />
          <Button type="submit" variant="danger" fullWidth>
            Submit Report
          </Button>
        </form>
      </Modal>
    </article>
  );
}
