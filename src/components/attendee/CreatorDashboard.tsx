'use client';
import { SelectField, TextField } from '@/components/ui/Field';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { readLocal, writeLocal } from '@/lib/attendee-data';
import { SEED_EVENTS } from '@/lib/campus-data';
import { DEMO_MODE } from '@/lib/mode';
import { Button } from '@/components/ui/Button';
import { AccountGate, PageFrame, styles } from './Shared';
import { LiveCreatorDashboard } from './LiveCreatorDashboard';

type DemoLink = { eventId: string; code: string; rsvps: number; checkIns: number };

function CreatorForm({ userId }: { userId: string }) {
  const key = `creator:links:${userId}`;
  const [links, setLinks] = useState<DemoLink[]>(() => readLocal(key, []));
  const [eventId, setEventId] = useState(SEED_EVENTS[0]?.id ?? '');
  const [message, setMessage] = useState('');
  const selected = SEED_EVENTS.find((event) => event.id === eventId);
  const link = links.find((item) => item.eventId === eventId);
  const url =
    link && selected && typeof window !== 'undefined'
      ? `${window.location.origin}/e/${selected.slug}?ref=${encodeURIComponent(link.code)}`
      : '';
  function generate() {
    if (!selected || link) return;
    const next = [...links, { eventId, code: crypto.randomUUID(), rsvps: 0, checkIns: 0 }];
    try {
      writeLocal(key, next);
      setLinks(next);
      setMessage('Demo link created.');
    } catch {
      setMessage('Could not save on this device. Check browser storage and try again.');
    }
  }
  return (
    <section className={styles.panel}>
      <h2>Ambassador links</h2>
      <p>
        Demo only: links and counts are saved in this browser. Links do not track real RSVPs or
        check-ins.
      </p>
      <SelectField
        label={<>Event</>}
        value={eventId}
        onChange={(e) => {
          setEventId(e.target.value);
          setMessage('');
        }}
      >
        {SEED_EVENTS.map((event) => (
          <option key={event.id} value={event.id}>
            {event.title}
          </option>
        ))}
      </SelectField>
      {!link ? (
        <Button onClick={generate}>Generate demo link</Button>
      ) : (
        <>
          <TextField label={<>Your demo link</>} readOnly value={url} />
          <Button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setMessage('Link copied.');
              } catch {
                setMessage('Copy failed. Select the link and copy it manually.');
              }
            }}
          >
            Copy link
          </Button>
          <p>
            Demo attributed RSVPs: {link.rsvps} · Demo check-ins: {link.checkIns}
          </p>
        </>
      )}
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}

function CreatorContent() {
  const { user } = useAuth();
  if (!DEMO_MODE) return <LiveCreatorDashboard />;
  return user ? <CreatorForm key={user.id} userId={user.id} /> : null;
}

export function CreatorDashboard() {
  return (
    <PageFrame title="Creator dashboard" subtitle="Share events with your audience.">
      <AccountGate>
        <CreatorContent />
      </AccountGate>
      <Link href="/settings">← Back to settings</Link>
    </PageFrame>
  );
}
