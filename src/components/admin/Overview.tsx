'use client';

import React from 'react';
import Link from 'next/link';
import { ResourceState } from '@/components/attendee/Shared';
import { ROLE_LABELS, canAccess } from '@/lib/admin-access';
import type { AdminOverview } from '@/lib/admin-data';
import { useAuth } from '@/lib/auth-context';
import type { UserPublic } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';
import { Building2, IdCard, Flag, CheckCircle2, type LucideIcon } from 'lucide-react';
import { PageHeader } from './AdminBits';
import { useOverview } from './AdminShell';
import styles from './Admin.module.css';

interface QueueLink {
  href: string;
  label: string;
  hint: string;
  count: number;
  icon: LucideIcon;
}

/** Only the queues this role can work. A queue it cannot open is not mentioned at all. */
export function queuesFor(role: UserPublic['role'], overview: AdminOverview): QueueLink[] {
  const pending = overview.pendingVerifications;
  const queues: QueueLink[] = [];
  if (canAccess(role, 'organizers'))
    queues.push({
      href: '/admin/verifications/organizers',
      label: 'Clubs & creators',
      hint: 'Applications waiting for a decision',
      count: pending.organizerClub + pending.creatorProfile,
      icon: Building2,
    });
  if (canAccess(role, 'students') && pending.studentId !== null)
    queues.push({
      href: '/admin/verifications/students',
      label: 'Student IDs',
      hint: 'ID images held until someone decides',
      count: pending.studentId,
      icon: IdCard,
    });
  if (canAccess(role, 'moderation') && overview.openReports !== null)
    queues.push({
      href: '/admin/moderation',
      label: 'Reports',
      hint: 'Open reports from students',
      count: overview.openReports,
      icon: Flag,
    });
  return queues;
}

export function OverviewView({
  role,
  overview,
}: {
  role: UserPublic['role'];
  overview: AdminOverview;
}) {
  const queues = queuesFor(role, overview);
  const total = queues.reduce((sum, q) => sum + q.count, 0);
  return (
    <div className={styles.page}>
      <PageHeader eyebrow={ROLE_LABELS[role]} title="Overview">
        Work the oldest items first. Verification requests should be decided within{' '}
        {overview.slaHours} hours.
      </PageHeader>
      <ul className={styles.queueList}>
        {queues.map((queue) => (
          <li key={queue.href}>
            <Link href={queue.href} className={styles.queueRow}>
              <span className={styles.queueIcon}>
                <Icon icon={queue.icon} size={20} />
              </span>
              <span className={styles.queueCount} aria-label={`${queue.count} waiting`}>
                {queue.count}
              </span>
              <span>
                <strong>{queue.label}</strong>
                <span className={styles.muted}>{queue.hint}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {total === 0 ? (
        <p className={styles.allClear}>
          <Icon icon={CheckCircle2} size={20} /> Every queue is clear. Nice work.
        </p>
      ) : null}
      <section className={styles.checklist} aria-labelledby="checklist-heading">
        <h2 id="checklist-heading">Before you decide</h2>
        <ol>
          <li>
            Queues are oldest first. Start at the top; aim to decide within {overview.slaHours}{' '}
            hours.
          </li>
          <li>Claim a request before you review it, so two reviewers never work the same item.</li>
          <li>Decisions cannot be undone. If you are unsure, request more information.</li>
          <li>Student ID images are deleted the moment you decide, whatever the decision.</li>
        </ol>
        <p className={styles.muted}>
          New here? Read the{' '}
          <Link className={styles.link} href="/admin/docs">
            reviewer guide
          </Link>{' '}
          before you make your first decision.
        </p>
      </section>
    </div>
  );
}

export function Overview() {
  const { user } = useAuth();
  const overview = useOverview();
  if (!user) return null;
  if (!overview.data)
    return (
      <ResourceState pending={overview.isPending} error={overview.error} retry={overview.refetch} />
    );
  return <OverviewView role={user.role} overview={overview.data} />;
}
