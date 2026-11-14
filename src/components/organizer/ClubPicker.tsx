'use client';

import React from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { useMyClubs } from '@/lib/organizer-data';
import { OrganizerRoleGate } from './OrganizerGate';
import styles from './Organizer.module.css';

function Clubs() {
  const mine = useMyClubs();
  if (mine.status === 'loading') return <p role="status">Loading your clubs…</p>;
  if (mine.status === 'unavailable')
    return (
      <p role="alert" className={styles.muted}>
        We could not load your clubs. Check your connection and reload.
      </p>
    );
  const clubs = mine.status === 'ready' ? mine.clubs : [];
  return (
    <div className={styles.page}>
      <header className={styles.headerText}>
        <div className={styles.eyebrow}>Organizer portal</div>
        <h1>My clubs</h1>
        <Link href="/organizer/apply">Apply for a club →</Link>
      </header>
      {clubs.length === 0 ? (
        <div className={styles.emptyState}>
          <h2>No clubs yet</h2>
          <p className={styles.muted}>Clubs you own or manage will show up here.</p>
        </div>
      ) : (
        <ul className={styles.clubList}>
          {clubs.map(({ organizer, role, verification }) => (
            <li key={organizer.id} className={styles.eventRow}>
              <div className={styles.eventMain}>
                <h2 className={styles.eventTitle}>{organizer.name}</h2>
                <div className={styles.eventMeta}>
                  <span>{role === 'OWNER' ? 'Owner' : 'Manager'}</span>
                  <Badge variant={verification.status === 'VERIFIED' ? 'success' : 'warning'}>
                    {verification.status === 'VERIFIED' ? 'Verified' : 'Awaiting verification'}
                  </Badge>
                </div>
              </div>
              <Link href={`/organizer/${organizer.slug}`} className={styles.linkButton}>
                Open dashboard
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ClubPicker() {
  return (
    <OrganizerRoleGate>
      <Clubs />
    </OrganizerRoleGate>
  );
}
