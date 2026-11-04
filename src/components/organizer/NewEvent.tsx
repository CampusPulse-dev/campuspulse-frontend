'use client';

import React, { useState } from 'react';
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

function NewEventData({ slug, draftId }: { slug: string; draftId?: string }) {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState<{ kind: 'draft' | 'published'; title: string } | null>(null);
  const [round, setRound] = useState(0);
  const query = useQuery({
    queryKey: ['organizer-dashboard', slug],
    queryFn: () => fetchOrganizerDashboard(slug),
  });

  if (!query.data) {
    return <ResourceState pending={query.isPending} error={query.error} retry={query.refetch} />;
  }
  const data = query.data;
  const initialDraft = draftId ? readEventDraft(slug, draftId) : undefined;
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

  if (saved) {
    return (
      <div className={styles.page}>
        <section className={styles.success} role="status">
          <h1>{saved.kind === 'published' ? 'Event published' : 'Draft saved'}</h1>
          <p className={styles.muted}>
            {saved.kind === 'published'
              ? `“${saved.title}” is published in this device's demo data. It is not live for students.`
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
          await saveEventDraft(slug, draft, draftId);
          await finish('draft', draft);
        }}
        onPublish={async (draft) => {
          await publishEvent(slug, draft, draftId);
          await finish('published', draft);
        }}
      />
    </div>
  );
}

export function NewEvent({ slug, draftId }: { slug: string; draftId?: string }) {
  return <ClubGate slug={slug}>{() => <NewEventData slug={slug} draftId={draftId} />}</ClubGate>;
}
