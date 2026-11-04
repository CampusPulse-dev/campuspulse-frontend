'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { loadOfflineTickets, saveOfflineTicket } from '@/lib/offline-tickets';
import { attendeeRequest } from '@/lib/attendee-data';
import { DEMO_MODE } from '@/lib/mode';
import { enrichEventPublic, fetchEventFeed } from '@/lib/api';
import { formatWatDateTime } from '@/lib/campus-data';
import { prepareWalletRoute } from '@/lib/wallet-cache';
import { Ticket, CalendarDays, MapPin, UserRound } from 'lucide-react';
import { PulseLine } from '@/components/ui/PulseLine';
import { ListRow } from '@/components/ui/ListRow';
import { Badge } from '@/components/ui/Badge';
import { TextLink } from '@/components/ui/TextLink';
import { Tabs } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { EventCard } from '@/components/events/EventCard';
import { AccountGate, PageFrame, ResourceState, styles } from './Shared';
export function Wallet({ rsvpId }: { rsvpId?: string }) {
  const { user, accessToken, interestedEventIds } = useAuth();
  const [tab, setTab] = useState('Upcoming');
  const [offlineReady, setOfflineReady] = useState(false);
  const [cacheError, setCacheError] = useState('');
  const [syncError, setSyncError] = useState('');
  const [svg, setSvg] = useState('');
  const query = useQuery({
    queryKey: ['tickets', user?.id],
    enabled: !!user,
    retry: false,
    queryFn: async () => {
      const cached = await loadOfflineTickets();
      if (DEMO_MODE || !navigator.onLine) return cached;
      try {
        const response = await attendeeRequest(
          'AttendeeTicketsResponse',
          '/attendance/me/tickets',
          accessToken,
        );
        for (const row of response.items)
          await saveOfflineTicket({
            accountId: user!.id,
            event: enrichEventPublic(row.event),
            rsvp: row.rsvp,
            attendeeName: user!.displayName,
            isVerifiedStudent: user!.isVerifiedStudent,
          });
        setSyncError('');
        return loadOfflineTickets();
      } catch (e) {
        if (!cached.length) throw e;
        setSyncError(
          'Unable to sync. Showing your previously saved tickets. Reconnect to check for event or ticket changes.',
        );
        return cached;
      }
    },
  });
  const interests = useQuery({
    queryKey: ['interested-events', user?.id, interestedEventIds],
    enabled: !!user && tab === 'Interested',
    queryFn: async () => {
      const feed = await fetchEventFeed();
      const all = [...feed.items];
      let cursor = feed.nextCursor;
      while (cursor) {
        const page = await fetchEventFeed({ cursor });
        all.push(...page.items);
        cursor = page.nextCursor;
      }
      return all.filter((e) => interestedEventIds.includes(e.id));
    },
  });
  const pass = query.data?.find((t) => t.rsvpId === rsvpId);
  useEffect(() => {
    let alive = true;
    if (!pass || pass.status !== 'CONFIRMED') return;
    void QRCode.toString(pass.qrToken, { type: 'svg', errorCorrectionLevel: 'M', margin: 4 }).then(
      (value) => {
        if (alive) setSvg(value);
      },
    );
    return () => {
      alive = false;
    };
  }, [pass]);
  async function cachePage() {
    setCacheError('');
    try {
      await prepareWalletRoute(rsvpId ? `/tickets/${encodeURIComponent(rsvpId)}` : '/tickets');
      setOfflineReady(true);
    } catch (e) {
      setCacheError(e instanceof Error ? e.message : 'Offline preparation failed.');
    }
  }
  useEffect(() => {
    if (!user || !query.data || !navigator.onLine) return;
    let alive = true;
    void prepareWalletRoute(rsvpId ? `/tickets/${encodeURIComponent(rsvpId)}` : '/tickets')
      .then(() => {
        if (alive) setOfflineReady(true);
      })
      .catch((e) => {
        if (alive) setCacheError(e instanceof Error ? e.message : 'Offline preparation failed.');
      });
    return () => {
      alive = false;
    };
  }, [user, query.data, rsvpId]);
  const [now] = useState(() => Date.now());
  const selected = (query.data ?? [])
    .filter((t) =>
      tab === 'Past'
        ? Date.parse(t.endsAt) < now || t.status === 'CANCELLED'
        : Date.parse(t.endsAt) >= now && t.status !== 'CANCELLED',
    )
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const groups = new Map<string, typeof selected>();
  for (const ticket of selected) {
    const parent = selected.find((p) => p.eventSlug === ticket.parentEventSlug);
    const key = parent?.eventSlug ?? ticket.eventSlug;
    groups.set(key, [...(groups.get(key) ?? []), ticket]);
  }
  return (
    <PageFrame
      hideHeader={!!rsvpId && !!pass}
      title={rsvpId ? 'Your event pass' : 'Your plans, all here'}
      subtitle={
        rsvpId
          ? 'Keep this pass ready for the door.'
          : 'A night worth going out for. Your tickets and saved events.'
      }
    >
      <AccountGate>
        {syncError ? <p role="alert">{syncError}</p> : null}
        <ResourceState pending={query.isPending} error={query.error} retry={query.refetch} />
        {cacheError ? (
          <div role="alert" className={styles.error}>
            {cacheError}{' '}
            <Button variant="secondary" onClick={cachePage}>
              Prepare offline access
            </Button>
          </div>
        ) : (
          <p role="status" className={styles.muted}>
            {offlineReady
              ? 'Ready for offline access on this device ✓'
              : 'Your saved tickets are stored on this device.'}
          </p>
        )}
        {rsvpId ? (
          pass ? (
            <section className={`${styles.panel} ${styles.pass}`}>
              <div className={styles.passStub}>
                <p className={styles.muted}>{pass.organizerName}</p>
                <h1>{pass.eventTitle}</h1>
              </div>
              <div className={styles.tear}>
                <PulseLine />
              </div>
              {pass.demo ? <p className={styles.banner}>DEMO PASS · Not valid for entry</p> : null}
              <Badge
                variant={
                  pass.status === 'CONFIRMED'
                    ? 'success'
                    : pass.status === 'WAITLISTED'
                      ? 'warning'
                      : 'danger'
                }
              >
                {pass.status}
              </Badge>
              {pass.status === 'CONFIRMED' && svg ? (
                <div
                  className={styles.qr}
                  role="img"
                  aria-label="Event entry QR code"
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
              ) : (
                <p>
                  {pass.status === 'WAITLISTED'
                    ? 'You are on the waitlist. A QR pass becomes available after confirmation.'
                    : pass.status === 'CANCELLED'
                      ? 'This ticket has been cancelled. It cannot be used for entry.'
                      : 'Preparing QR…'}
                </p>
              )}
              <div className={styles.passDetails}>
                <ListRow icon={UserRound} title={pass.attendeeName} />
                <ListRow
                  icon={CalendarDays}
                  title={formatWatDateTime(pass.startsAt).compactLabel}
                  meta={pass.showtimeLabel}
                />
                <ListRow icon={MapPin} title={pass.venueName} />
              </div>
              <p className={styles.ticketId}>{pass.rsvpId}</p>
              <TextLink href={'/e/' + pass.eventSlug}>Event details</TextLink>
            </section>
          ) : !query.isPending && !query.error ? (
            <p>
              This pass is not saved for your account on this device. Open your tickets online to
              sync it.
            </p>
          ) : null
        ) : (
          <>
            <Tabs
              tabs={['Upcoming', 'Interested', 'Past'].map((id) => ({ id, label: id }))}
              activeId={tab}
              onChange={setTab}
            >
              {tab === 'Interested' ? (
                <>
                  <ResourceState
                    pending={interests.isPending}
                    error={interests.error}
                    retry={interests.refetch}
                  />
                  {interests.data?.map((e) => (
                    <EventCard key={e.id} event={e} />
                  ))}
                  {interests.data?.length === 0 ? (
                    <p>No saved interests yet. Tap Interested on an event.</p>
                  ) : null}
                </>
              ) : (
                <div className={styles.list}>
                  {[...groups.entries()].map(([key, tickets]) => (
                    <section className={styles.panel} key={key}>
                      {tickets.length > 1 ? <h2>Your Night</h2> : null}
                      <div className={tickets.length > 1 ? styles.timeline : styles.list}>
                        {tickets.map((t) => (
                          <ListRow
                            key={t.rsvpId}
                            icon={Ticket}
                            title={t.eventTitle}
                            href={'/tickets/' + encodeURIComponent(t.rsvpId)}
                            meta={
                              formatWatDateTime(t.startsAt).timeLabel +
                              ' · ' +
                              t.venueName +
                              ' · ' +
                              t.status +
                              (t.demo ? ' · DEMO' : '')
                            }
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                  {selected.length === 0 && !query.isPending && !query.error ? (
                    <section className={styles.panel}>
                      <h2>
                        {tab === 'Past' ? 'No past plans yet' : 'Your next night starts here'}
                      </h2>
                      <p>Find an event and reserve your spot.</p>
                      <Link href="/explore">Explore campus events</Link>
                    </section>
                  ) : null}
                </div>
              )}
            </Tabs>
          </>
        )}
      </AccountGate>
    </PageFrame>
  );
}
