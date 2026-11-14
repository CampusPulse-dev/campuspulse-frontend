'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { TriangleAlert } from 'lucide-react';
import { ResourceState } from '@/components/attendee/Shared';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Tabs } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import type { UserPublic } from '@/lib/api';
import {
  SUBJECT_LABELS,
  claimVerification,
  decideVerification,
  fetchVerificationDocument,
  fetchVerifications,
  formatCountdown,
  formatWaiting,
  hoursSince,
  lockMsLeft,
  lockState,
  type DecideBody,
  type VerificationItem,
  type VerificationPage,
  type VerificationSubject,
} from '@/lib/admin-data';
import { useAuth } from '@/lib/auth-context';
import { formatWatDateTime } from '@/lib/campus-data';
import {
  ConfirmDialog,
  PageHeader,
  errorMessage,
  isTypingTarget,
  useNow,
  type ConfirmRequest,
} from './AdminBits';
import { OVERVIEW_KEY, useOverview } from './AdminShell';
import { EphemeralIdViewer } from './EphemeralIdViewer';
import styles from './Admin.module.css';

function itemTitle(item: VerificationItem): string {
  if (item.subject === 'ORGANIZER_CLUB' && item.organizer) return item.organizer.name;
  if (item.subject === 'CREATOR_PROFILE' && item.creatorHandle) return `@${item.creatorHandle}`;
  return item.submittedBy.displayName;
}

const DECISION_COPY: Record<
  DecideBody['decision'],
  { verb: string; confirm: string; done: string; noteLabel: string }
> = {
  APPROVED: {
    verb: 'Approve',
    confirm: 'Approve',
    done: 'Approved.',
    noteLabel: 'Note to the applicant (optional)',
  },
  INFO_REQUESTED: {
    verb: 'Request more information from',
    confirm: 'Request info',
    done: 'Sent back for more information.',
    noteLabel: 'What do you need from them?',
  },
  REJECTED: {
    verb: 'Reject',
    confirm: 'Reject',
    done: 'Rejected.',
    noteLabel: 'Why is this rejected?',
  },
};

export interface VerificationQueueViewProps {
  eyebrow: string;
  title: string;
  lede: string;
  items: VerificationItem[];
  me: UserPublic;
  slaHours: number;
  tabs?: { subject: VerificationSubject; label: string; count?: number }[];
  activeSubject: VerificationSubject;
  onSubjectChange?: (subject: VerificationSubject) => void;
  onClaim: (id: string) => Promise<void>;
  onDecide: (id: string, body: DecideBody) => Promise<void>;
  /** Present only for a Super Admin on the student ID queue. */
  loadDocument?: (id: string) => Promise<Blob>;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

export function VerificationQueueView({
  eyebrow,
  title,
  lede,
  items,
  me,
  slaHours,
  tabs,
  activeSubject,
  onSubjectChange,
  onClaim,
  onDecide,
  loadDocument,
  hasMore,
  onLoadMore,
}: VerificationQueueViewProps) {
  const now = useNow();
  const { pushToast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  const selected = items.find((item) => item.id === selectedId) ?? items[0] ?? null;
  const state = selected ? lockState(selected, me.id, now) : 'free';

  function select(id: string, reveal = false) {
    setSelectedId(id);
    setProblem(null);
    // Stacked layout: bring the detail pane to the reviewer instead of making them hunt for it.
    if (reveal && window.matchMedia?.('(max-width: 1023px)').matches)
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ block: 'start' }));
  }

  function move(step: number) {
    if (!selected) return;
    const index = items.findIndex((item) => item.id === selected.id);
    const next = items[Math.min(items.length - 1, Math.max(0, index + step))];
    if (next) select(next.id);
  }

  async function claim() {
    if (!selected || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      await onClaim(selected.id);
    } catch (error) {
      setProblem(errorMessage(error, 'Could not claim this request. Please retry.'));
    } finally {
      setBusy(false);
    }
  }

  function openDecision(decision: DecideBody['decision']) {
    if (!selected || state !== 'mine') return;
    const item = selected;
    const copy = DECISION_COPY[decision];
    const index = items.findIndex((entry) => entry.id === item.id);
    const nextId = items[index + 1]?.id ?? items[index - 1]?.id ?? null;
    setConfirm({
      title: `${copy.verb} ${itemTitle(item)}?`,
      subtitle: item.hasDocument
        ? 'The ID image is deleted the moment you confirm. This cannot be undone.'
        : 'The applicant is notified straight away. This cannot be undone.',
      confirmLabel: copy.confirm,
      danger: decision === 'REJECTED',
      note: decision === 'APPROVED' ? 'optional' : 'required',
      noteLabel: copy.noteLabel,
      run: async (note) => {
        await onDecide(item.id, { decision, note });
        setSelectedId(nextId);
        pushToast(copy.done, decision === 'APPROVED' ? 'success' : 'info');
      },
    });
  }

  // Keyboard-first review. Rebound every render so the handler always sees current state.
  const onKey = useRef<(event: KeyboardEvent) => void>(() => undefined);
  useEffect(() => {
    onKey.current = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey || confirm) return;
      if (isTypingTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === 'j') move(1);
      else if (key === 'k') move(-1);
      else if (key === 'c' && state !== 'other') void claim();
      else if (key === 'a') openDecision('APPROVED');
      else if (key === 'i') openDecision('INFO_REQUESTED');
      else if (key === 'r') openDecision('REJECTED');
      else return;
      event.preventDefault();
    };
  });
  useEffect(() => {
    const handler = (event: KeyboardEvent) => onKey.current(event);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const list =
    items.length === 0 ? (
      <p className={styles.empty}>Nothing waiting here. The queue is clear.</p>
    ) : (
      <div className={styles.split}>
        <div>
          <ul className={styles.list} aria-label={`${title} queue`}>
            {items.map((item) => {
              const overdue = hoursSince(item.submittedAt, now) >= slaHours;
              const rowState = lockState(item, me.id, now);
              const current = item.id === selected?.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`${styles.row} ${current ? styles.rowActive : ''}`}
                    aria-current={current ? 'true' : undefined}
                    onClick={() => select(item.id, true)}
                  >
                    <span className={styles.rowTitle}>{itemTitle(item)}</span>
                    <span className={styles.rowMeta}>
                      <span>{SUBJECT_LABELS[item.subject]}</span>
                      {overdue ? (
                        <span className={styles.overdue}>
                          <Icon icon={TriangleAlert} size={14} />
                          Overdue · {formatWaiting(item.submittedAt, now)}
                        </span>
                      ) : (
                        <span>Waiting {formatWaiting(item.submittedAt, now)}</span>
                      )}
                      {rowState === 'mine' ? <span>Claimed by you</span> : null}
                      {rowState === 'other' ? (
                        <span>In review · {item.claimedBy?.displayName}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {hasMore && onLoadMore ? (
            <div className={styles.actions} style={{ paddingTop: 'var(--space-3)' }}>
              <Button variant="secondary" onClick={onLoadMore}>
                Load more
              </Button>
            </div>
          ) : null}
        </div>

        {selected ? (
          <div className={styles.detailTray} ref={detailRef}>
            {/* Keyed so the pane cross-fades, and so an ID image never carries over to the next request. */}
            <section key={selected.id} className={styles.detailCore} aria-label="Request details">
              <header className={styles.detailHeader}>
                <div className={styles.eyebrow}>{SUBJECT_LABELS[selected.subject]}</div>
                <h2>{itemTitle(selected)}</h2>
              </header>

              <dl className={styles.facts}>
                <dt>Submitted by</dt>
                <dd>{selected.submittedBy.displayName}</dd>
                <dt>Submitted</dt>
                <dd className={styles.mono}>
                  {formatWatDateTime(selected.submittedAt).compactLabel} WAT ·{' '}
                  {formatWaiting(selected.submittedAt, now)} ago
                </dd>
                {selected.organizer ? (
                  <>
                    <dt>Club page</dt>
                    <dd>
                      <Link className={styles.link} href={`/o/${selected.organizer.slug}`}>
                        /o/{selected.organizer.slug}
                      </Link>
                    </dd>
                    {selected.organizer.bio ? (
                      <>
                        <dt>About</dt>
                        <dd>{selected.organizer.bio}</dd>
                      </>
                    ) : null}
                  </>
                ) : null}
                {selected.creatorHandle ? (
                  <>
                    <dt>Creator page</dt>
                    <dd>
                      <Link className={styles.link} href={`/c/${selected.creatorHandle}`}>
                        /c/{selected.creatorHandle}
                      </Link>
                    </dd>
                  </>
                ) : null}
                {selected.evidenceUrl ? (
                  <>
                    <dt>Evidence</dt>
                    <dd>
                      <a
                        className={styles.link}
                        href={selected.evidenceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open evidence link (new tab)
                      </a>
                    </dd>
                  </>
                ) : null}
              </dl>

              <div
                className={`${styles.lockBar} ${
                  state === 'mine' ? styles.lockMine : state === 'other' ? styles.lockOther : ''
                }`}
                role="status"
              >
                {state === 'free' ? (
                  <>
                    <span>Claim this to review it. The claim holds it for you for 15 minutes.</span>
                    <Button isLoading={busy} onClick={() => void claim()}>
                      Claim to review
                    </Button>
                  </>
                ) : null}
                {state === 'mine' ? (
                  <>
                    <span>
                      You hold this request ·{' '}
                      <strong>{formatCountdown(lockMsLeft(selected, now))}</strong> left
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      isLoading={busy}
                      onClick={() => void claim()}
                    >
                      Extend
                    </Button>
                  </>
                ) : null}
                {state === 'other' ? (
                  <span>
                    {selected.claimedBy?.displayName} is reviewing this ·{' '}
                    <strong>{formatCountdown(lockMsLeft(selected, now))}</strong> left on their
                    claim
                  </span>
                ) : null}
              </div>

              {problem ? (
                <p role="alert" className={styles.error}>
                  {problem}
                </p>
              ) : null}

              {selected.subject === 'STUDENT_ID' ? (
                !selected.hasDocument ? (
                  <p className={styles.notice}>No ID image is held for this request.</p>
                ) : state === 'mine' && loadDocument ? (
                  <EphemeralIdViewer
                    load={() => loadDocument(selected.id)}
                    watermark={`${me.displayName} · ${me.id.slice(0, 8)} · ${
                      formatWatDateTime(new Date(now).toISOString()).compactLabel
                    } WAT`}
                  />
                ) : (
                  <p className={styles.notice}>Claim this request to view the ID image.</p>
                )
              ) : null}

              <div className={styles.actions}>
                <Button disabled={state !== 'mine'} onClick={() => openDecision('APPROVED')}>
                  Approve
                </Button>
                <Button
                  variant="secondary"
                  disabled={state !== 'mine'}
                  onClick={() => openDecision('INFO_REQUESTED')}
                >
                  Request info
                </Button>
                <Button
                  variant="danger"
                  disabled={state !== 'mine'}
                  onClick={() => openDecision('REJECTED')}
                >
                  Reject
                </Button>
              </div>

              <p className={styles.shortcuts}>
                <span>
                  <kbd className={styles.kbd}>J</kbd> <kbd className={styles.kbd}>K</kbd> next /
                  previous
                </span>
                <span>
                  <kbd className={styles.kbd}>C</kbd> claim
                </span>
                <span>
                  <kbd className={styles.kbd}>A</kbd> approve
                </span>
                <span>
                  <kbd className={styles.kbd}>I</kbd> request info
                </span>
                <span>
                  <kbd className={styles.kbd}>R</kbd> reject
                </span>
              </p>
            </section>
          </div>
        ) : null}
      </div>
    );

  return (
    <div className={styles.page}>
      <PageHeader eyebrow={eyebrow} title={title}>
        {lede}
      </PageHeader>
      {tabs && onSubjectChange ? (
        <Tabs
          label="Queue"
          tabs={tabs.map((tab) => ({ id: tab.subject, label: tab.label, count: tab.count }))}
          activeId={activeSubject}
          onChange={(id) => {
            setSelectedId(null);
            setProblem(null);
            onSubjectChange(id as VerificationSubject);
          }}
        >
          {list}
        </Tabs>
      ) : (
        list
      )}
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}

type Pages = InfiniteData<VerificationPage, string | undefined>;

export function VerificationQueue({ mode }: { mode: 'organizers' | 'students' }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const overview = useOverview().data;
  const [subject, setSubject] = useState<VerificationSubject>(
    mode === 'students' ? 'STUDENT_ID' : 'ORGANIZER_CLUB',
  );
  // The shell already blocks the route; this keeps the query from ever being issued.
  const permitted = Boolean(user) && (mode === 'organizers' || user?.role === 'SUPER_ADMIN');
  const key = ['admin', 'verifications', subject] as const;
  const queue = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => fetchVerifications(subject, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: permitted,
    refetchInterval: 30_000,
  });

  if (!user || !permitted) return null;
  if (!queue.data)
    return <ResourceState pending={queue.isPending} error={queue.error} retry={queue.refetch} />;

  const patch = (change: (items: VerificationItem[]) => VerificationItem[]) =>
    queryClient.setQueryData<Pages>(key, (data) =>
      data
        ? { ...data, pages: data.pages.map((page) => ({ ...page, items: change(page.items) })) }
        : data,
    );
  const pending = overview?.pendingVerifications;

  return (
    <VerificationQueueView
      eyebrow="Verification"
      title={mode === 'students' ? 'Student IDs' : 'Clubs & creators'}
      lede={
        mode === 'students'
          ? 'Compare the ID with the account, then decide. The image is deleted as soon as you do.'
          : 'Check the evidence that the applicant runs this club or page, then decide.'
      }
      items={queue.data.pages.flatMap((page) => page.items)}
      me={user}
      slaHours={overview?.slaHours ?? 48}
      tabs={
        mode === 'organizers'
          ? [
              { subject: 'ORGANIZER_CLUB', label: 'Clubs', count: pending?.organizerClub },
              { subject: 'CREATOR_PROFILE', label: 'Creators', count: pending?.creatorProfile },
            ]
          : undefined
      }
      activeSubject={subject}
      onSubjectChange={setSubject}
      hasMore={queue.hasNextPage}
      onLoadMore={() => void queue.fetchNextPage()}
      loadDocument={
        mode === 'students' && user.role === 'SUPER_ADMIN' ? fetchVerificationDocument : undefined
      }
      onClaim={async (id) => {
        try {
          const claimed = await claimVerification(id);
          patch((items) => items.map((item) => (item.id === id ? claimed : item)));
        } catch (error) {
          // Most likely someone else took it: show who.
          void queue.refetch();
          throw error;
        }
      }}
      onDecide={async (id, body) => {
        await decideVerification(id, body);
        patch((items) => items.filter((item) => item.id !== id));
        void queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY });
        void queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
      }}
    />
  );
}
