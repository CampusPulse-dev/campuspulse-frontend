'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ResourceState } from '@/components/attendee/Shared';
import {
  fetchOrganizerDashboard,
  publishEvent,
  readEventDraft,
  saveEventDraft,
  type EventDraft,
} from '@/lib/organizer-data';
import { ClubGate } from './OrganizerGate';
import { EventWizard } from './EventWizard';
import styles from './Organizer.module.css';
import { DEMO_MODE } from '@/lib/mode';
import { liveReadDraft, livePublishSaved } from '@/lib/organizer-live';
import { useAuth } from '@/lib/auth-context';

function NewEventData({ slug, draftId }: { slug: string; draftId?: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [workingId, setWorkingId] = useState(draftId);
  const lastSave = useRef<{ fingerprint: string; id: string } | null>(null);
  const [saved, setSaved] = useState<{ kind: 'draft' | 'published'; title: string } | null>(null);
  const [round, setRound] = useState(0);
  const query = useQuery({
    queryKey: ['organizer-dashboard', slug, user?.id],
    queryFn: () => fetchOrganizerDashboard(slug),
  });
  const draftQuery = useQuery({
    queryKey: ['organizer-draft', slug, draftId, user?.id],
    queryFn: () => liveReadDraft(slug, draftId!),
    enabled: !DEMO_MODE && !!draftId,
  });

  if (!query.data) {
    return <ResourceState pending={query.isPending} error={query.error} retry={query.refetch} />;
  }
  const data = query.data;
  if (!DEMO_MODE && draftId && !draftQuery.data)
    return (
      <ResourceState
        pending={draftQuery.isPending}
        error={draftQuery.error}
        retry={draftQuery.refetch}
      />
    );
  const initialDraft = draftId
    ? DEMO_MODE
      ? readEventDraft(slug, draftId)
      : draftQuery.data
    : undefined;
  if (draftId && !initialDraft && !saved)
    return (
      <div className={styles.page}>
        <h1>Draft unavailable</h1>
        <p>This draft could not be found or has already been published.</p>
        <Link href={`/organizer/${slug}`}>Back to dashboard</Link>
      </div>
    );

  async function finish(kind: 'draft' | 'published', draft: EventDraft) {
    setSaved({ kind, title: draft.title.trim() });
    await queryClient.invalidateQueries({ queryKey: ['organizer-dashboard', slug] });
  }
  async function persistDraft(draft: EventDraft) {
    const fingerprint = JSON.stringify(draft);
    if (lastSave.current?.fingerprint === fingerprint) return lastSave.current.id;
    const event = await saveEventDraft(slug, draft, workingId);
    setWorkingId(event.id);
    lastSave.current = { fingerprint, id: event.id };
    return event.id;
  }

  if (saved) {
    return (
      <div className={styles.page}>
        <section className={styles.success} role="status">
          <h1>{saved.kind === 'published' ? 'Event published' : 'Draft saved'}</h1>
          <p className={styles.muted}>
            {saved.kind === 'published'
              ? DEMO_MODE
                ? `“${saved.title}” is published in this device's demo data. It is not live for students.`
                : `“${saved.title}” is now published for students.`
              : `“${saved.title}” is saved in your drafts. Publish it from here once it is ready.`}
          </p>
          <div className={styles.actions}>
            <Link href={`/organizer/${slug}`} className={styles.linkButton}>
              Back to dashboard
            </Link>
            {!draftId ? (
              <button
                type="button"
                className={`${styles.linkButton} ${styles.secondaryLink}`}
                onClick={() => {
                  setSaved(null);
                  setWorkingId(undefined);
                  lastSave.current = null;
                  setRound((n) => n + 1);
                }}
              >
                Create another
              </button>
            ) : null}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.headerText}>
        <div className={styles.eyebrow}>{data.organizer.name}</div>
        <h1 className={styles.stepTitle}>{draftId ? 'Edit draft' : 'Create an event'}</h1>
      </header>
      <EventWizard
        key={round}
        initialDraft={initialDraft ?? undefined}
        canPublish={data.verification.status === 'VERIFIED'}
        parentOptions={data.events
          .filter((event) => event.status === 'PUBLISHED')
          .map((event) => ({ id: event.id, title: event.title }))}
        onSaveDraft={async (draft) => {
          await persistDraft(draft);
          await finish('draft', draft);
        }}
        onPublish={async (draft) => {
          const id = await persistDraft(draft);
          if (DEMO_MODE) await publishEvent(slug, draft, id);
          else await livePublishSaved(id);
          await finish('published', draft);
        }}
      />
    </div>
  );
}

export function NewEvent({ slug, draftId }: { slug: string; draftId?: string }) {
  return <ClubGate slug={slug}>{() => <NewEventData slug={slug} draftId={draftId} />}</ClubGate>;
}
