'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { Badge, CategoryPill } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { TextField, ToggleRow } from '@/components/ui/Field';
import { ResourceState } from '@/components/attendee/Shared';
import { downloadCsv } from '@/lib/csv';
import { formatWatDateTime, type EventMatchFixture } from '@/lib/campus-data';
import { groupEvents } from '@/lib/organizer-data';
import {
  conversionRate,
  fetchEventAttendeesCsv,
  fetchOrganizerEvent,
  updateEventFixture,
  validateFixture,
  type OrganizerEventHubData,
} from '@/lib/organizer-hub-data';
import { ClubGate } from './OrganizerGate';
import styles from './Organizer.module.css';

const REFRESH_MS = 15_000;

function percent(value: number | null) {
  return value === null ? '—' : `${Math.round(value * 100)}%`;
}

function ScoreUpdater({
  fixture,
  onSave,
}: {
  fixture: EventMatchFixture;
  onSave: (fixture: EventMatchFixture) => Promise<void>;
}) {
  const [home, setHome] = useState(String(fixture.homeScore));
  const [away, setAway] = useState(String(fixture.awayScore));
  const [period, setPeriod] = useState(fixture.periodLabel);
  const [isLive, setIsLive] = useState(fixture.isLive);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save() {
    const next: EventMatchFixture = {
      ...fixture,
      homeScore: home.trim() === '' ? Number.NaN : Number(home),
      awayScore: away.trim() === '' ? Number.NaN : Number(away),
      periodLabel: period,
      isLive,
    };
    const found = validateFixture(next);
    setErrors(found);
    setSaved(false);
    if (found.length > 0) return;
    setBusy(true);
    try {
      await onSave(next);
      setSaved(true);
    } catch (error) {
      setErrors([
        error instanceof Error ? error.message : 'Could not save the score. Please retry.',
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="score-heading">
      <h2 id="score-heading" className={styles.blockHeading}>
        Live score
      </h2>
      <p className={styles.stepSubtitle}>
        {fixture.homeTeam} {fixture.homeScore} — {fixture.awayScore} {fixture.awayTeam}
        {fixture.isLive ? ' · LIVE' : ''}
      </p>
      {errors.length > 0 ? (
        <ul className={styles.errorList} role="alert">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}
      <div className={styles.twoCol}>
        <TextField
          label="Home score"
          type="number"
          inputMode="numeric"
          min={0}
          value={home}
          onChange={(e) => setHome(e.target.value)}
        />
        <TextField
          label="Away score"
          type="number"
          inputMode="numeric"
          min={0}
          value={away}
          onChange={(e) => setAway(e.target.value)}
        />
      </div>
      <TextField
        label="Period label"
        hint="Shown on the scoreboard, for example HT or LIVE · 68'."
        value={period}
        maxLength={20}
        onChange={(e) => setPeriod(e.target.value)}
      />
      <ToggleRow
        label="Match is live"
        hint="Attendees see a LIVE badge on the event page."
        checked={isLive}
        onChange={(e) => setIsLive(e.target.checked)}
      />
      <div className={styles.actions}>
        <Button isLoading={busy} onClick={save}>
          Save score
        </Button>
        {saved ? <span role="status">Score saved</span> : null}
      </div>
    </section>
  );
}

export function EventHubView({
  data,
  now = new Date(),
  onSaveScore,
  onExportCsv,
}: {
  data: OrganizerEventHubData;
  now?: Date;
  onSaveScore: (fixture: EventMatchFixture) => Promise<void>;
  onExportCsv: () => Promise<void>;
}) {
  const { event } = data;
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const group = (['live', 'upcoming', 'drafts', 'past'] as const).find(
    (key) => groupEvents([event], now)[key].length > 0,
  );
  const when = event.startsAt ? formatWatDateTime(event.startsAt) : null;
  const finished = group === 'past';
  const isDraft = event.status === 'DRAFT';

  async function exportCsv() {
    setExportError(null);
    setExporting(true);
    try {
      await onExportCsv();
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Could not export the list.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className={styles.page}>
      <Link href={`/organizer/${data.organizerSlug}`} className={styles.muted}>
        ← Back to dashboard
      </Link>
      <header className={styles.headerText}>
        <div className={styles.eyebrow}>{data.organizerName}</div>
        <h1>{event.title}</h1>
        <div className={styles.eventMeta}>
          <CategoryPill category={event.category} />
          {group === 'live' ? <LiveIndicator label="Live today" /> : null}
          {group === 'upcoming' ? <Badge variant="default">Published</Badge> : null}
          {isDraft ? <Badge variant="default">Draft</Badge> : null}
          {finished ? (
            <Badge variant="default">
              {event.status === 'CANCELLED' ? 'Cancelled' : 'Finished'}
            </Badge>
          ) : null}
          {when ? <span>{when.compactLabel} WAT</span> : null}
          {event.venueName ? <span>{event.venueName}</span> : null}
        </div>
        {!isDraft ? (
          <div className={styles.actions}>
            {' '}
            <Button
              variant="secondary"
              isLoading={exporting}
              disabled={event.rsvpCount === 0}
              onClick={exportCsv}
            >
              Export attendee CSV
            </Button>
          </div>
        ) : null}
      </header>

      {isDraft ? (
        <p className={styles.notice}>
          This event is still a draft, so it has no RSVPs yet. Editing drafts is coming soon.
        </p>
      ) : (
        <>
          <dl className={styles.kpis} aria-label="Event stats">
            <div className={styles.kpi}>
              <dt>RSVPs</dt>
              <dd>
                {event.rsvpCount}
                {event.capacity !== null ? ` / ${event.capacity}` : ''}
              </dd>
            </div>
            <div className={styles.kpi}>
              <dt>Checked in</dt>
              <dd>{event.checkInCount ?? '—'}</dd>
            </div>
            <div className={styles.kpi}>
              <dt>Show-up rate</dt>
              <dd>{percent(conversionRate(event))}</dd>
            </div>
            <div className={styles.kpi}>
              <dt>Duplicate scans</dt>
              <dd>{event.duplicateScanCount}</dd>
            </div>
            <div className={styles.kpi}>
              <dt>Manual check-ins</dt>
              <dd>{event.manualCheckInCount}</dd>
            </div>
          </dl>

          {event.template === 'MATCH_TOURNAMENT' && event.fixture && !finished ? (
            <ScoreUpdater fixture={event.fixture} onSave={onSaveScore} />
          ) : null}

          <section className={styles.panel} aria-labelledby="attendees-heading">
            <h2 id="attendees-heading" className={styles.blockHeading}>
              Attendee list
            </h2>
            <p className={styles.stepSubtitle}>
              Names and check-in status only. Contact details are never included.
            </p>
            {exportError ? (
              <p role="alert" className={styles.errorList}>
                {exportError}
              </p>
            ) : null}
            <div className={styles.actions}></div>
          </section>

          {event.ambassadors.length > 0 ? (
            <section className={styles.panel} aria-labelledby="ambassadors-heading">
              <h2 id="ambassadors-heading" className={styles.blockHeading}>
                Ambassador attribution
              </h2>
              <ul className={styles.eventList}>
                {event.ambassadors.map((ambassador) => (
                  <li key={ambassador.name} className={styles.eventMeta}>
                    <strong>{ambassador.name}</strong>
                    <span className={styles.mono}>{ambassador.attributedRsvps} RSVPs</span>
                    <span className={styles.mono}>{ambassador.attributedCheckIns} check-ins</span>
                  </li>
                ))}
              </ul>
              <p className={styles.stepSubtitle}>
                Demo figures. Real counts come from the stats service.
              </p>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

function EventHubData({ slug, eventId }: { slug: string; eventId: string }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['organizer-event', slug, eventId],
    queryFn: () => fetchOrganizerEvent(slug, eventId),
    refetchInterval: REFRESH_MS,
  });
  if (!query.data) {
    return <ResourceState pending={query.isPending} error={query.error} retry={query.refetch} />;
  }
  const { event } = query.data;
  return (
    <EventHubView
      data={query.data}
      onSaveScore={async (fixture) => {
        await updateEventFixture(slug, eventId, fixture);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['organizer-event', slug, eventId] }),
          queryClient.invalidateQueries({ queryKey: ['organizer-dashboard', slug] }),
        ]);
      }}
      onExportCsv={async () => {
        downloadCsv(
          `${event.slug ?? event.id}-attendees.csv`,
          await fetchEventAttendeesCsv(slug, eventId),
        );
      }}
    />
  );
}

export function EventHub({ slug, eventId }: { slug: string; eventId: string }) {
  return <ClubGate slug={slug}>{() => <EventHubData slug={slug} eventId={eventId} />}</ClubGate>;
}
