'use client';

import React from 'react';
import Link from 'next/link';
import { ResourceState } from '@/components/attendee/Shared';
import { ROLE_LABELS, canAccess } from '@/lib/admin-access';
import type { AdminOverview } from '@/lib/admin-data';
import { useAuth } from '@/lib/auth-context';
import type { UserPublic } from '@/lib/api';
import { PageHeader } from './AdminBits';
import { useOverview } from './AdminShell';
import styles from './Admin.module.css';

interface QueueLink {
  href: string;
  label: string;
  hint: string;
  count: number;
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
    });
  if (canAccess(role, 'students') && pending.studentId !== null)
    queues.push({
      href: '/admin/verifications/students',
      label: 'Student IDs',
      hint: 'ID images held until someone decides',
      count: pending.studentId,
    });
  if (canAccess(role, 'moderation') && overview.openReports !== null)
    queues.push({
      href: '/admin/moderation',
      label: 'Reports',
      hint: 'Open reports from students',
      count: overview.openReports,
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
              <span>
                <strong>{queue.label}</strong>
                <span className={styles.muted}>{queue.hint}</span>
              </span>
              <span className={styles.queueCount} aria-label={`${queue.count} waiting`}>
                {queue.count}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className={styles.muted}>
        New here? Read the{' '}
        <Link className={styles.link} href="/admin/docs">
          reviewer guide
        </Link>{' '}
        before you make your first decision.
      </p>
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
