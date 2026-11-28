'use client';

import React from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { Building2, CalendarPlus, Users, ScanLine, Sparkles } from 'lucide-react';
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
        <EmptyState
          icon={Building2}
          title="No clubs yet"
          body="Clubs you own or manage will show up here. Apply once, and our reviewers verify you within 48 hours."
          action={{ href: '/organizer/apply', label: 'Apply for a club' }}
          secondary={{ href: '/explore', label: 'See what clubs post' }}
        />
      ) : (
        <>
          <ul className={styles.clubGrid}>
            {clubs.map(({ organizer, role, verification }) => {
              const verified = verification.status === 'VERIFIED';
              const base = `/organizer/${organizer.slug}`;
              return (
                <li key={organizer.id} className={styles.clubCard}>
                  <div className={styles.clubHead}>
                    <Avatar
                      name={organizer.name}
                      src={organizer.logoUrl}
                      size="lg"
                      isVerified={verified}
                    />
                    <div className={styles.eventMain}>
                      <h2 className={styles.eventTitle}>{organizer.name}</h2>
                      <div className={styles.eventMeta}>
                        <span>{role === 'OWNER' ? 'Owner' : 'Manager'}</span>
                        <Badge variant={verified ? 'success' : 'warning'}>
                          {verified ? 'Verified' : 'Awaiting verification'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  {organizer.bio ? <p className={styles.clubBio}>{organizer.bio}</p> : null}
                  <p className={styles.muted}>
                    <strong>{organizer.followerCount.toLocaleString('en-NG')}</strong> followers
                  </p>
                  <div className={styles.clubActions}>
                    <Link href={base} className={styles.linkButton}>
                      Open dashboard
                    </Link>
                    {verified ? (
                      <Link href={`${base}/events/new`} className={styles.quietLink}>
                        <Icon icon={CalendarPlus} size={16} /> New event
                      </Link>
                    ) : null}
                    <Link href={`${base}/team`} className={styles.quietLink}>
                      <Icon icon={Users} size={16} /> Team
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
          <section className={styles.toolkit} aria-labelledby="toolkit-heading">
            <h2 id="toolkit-heading" className={styles.eyebrow}>
              Organizer toolkit
            </h2>
            <ul className={styles.toolkitGrid}>
              <li>
                <Icon icon={CalendarPlus} size={20} />
                <strong>Publish an event</strong>
                <span className={styles.muted}>
                  Templates for parties, matches, talks and plays.
                </span>
              </li>
              <li>
                <Icon icon={ScanLine} size={20} />
                <strong>Run the door</strong>
                <span className={styles.muted}>QR scanning and manual check-in work offline.</span>
              </li>
              <li>
                <Icon icon={Sparkles} size={20} />
                <strong>Post a story</strong>
                <span className={styles.muted}>Tease the lineup to everyone who follows you.</span>
              </li>
            </ul>
          </section>
        </>
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
