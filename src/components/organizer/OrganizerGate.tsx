'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useOrganizerAccess, type OrganizerAccess } from '@/lib/organizer-data';
import { styles } from '@/components/attendee/Shared';

function signInHref(slug: string | null) {
  return '/sign-in?next=' + encodeURIComponent(slug ? `/organizer/${slug}` : '/organizer');
}

export function OrganizerAccessMessage({
  access,
  slug,
}: {
  access: OrganizerAccess;
  slug: string | null;
}) {
  if (access.status === 'loading') return <p role="status">Checking your club access…</p>;
  if (access.status === 'signed-out')
    return (
      <section className={styles.panel}>
        <h2>Sign in to manage your club</h2>
        <p>Organizer tools are only available to club owners and managers.</p>
        <Link href={signInHref(slug)}>Sign in →</Link>
      </section>
    );
  if (access.status === 'unavailable')
    return (
      <section className={styles.panel} role="alert">
        <h2>Organizer tools are not live yet</h2>
        <p>The organizer service is still being built. Check back soon.</p>
      </section>
    );
  if (access.status === 'denied')
    return (
      <section className={styles.panel} role="alert">
        <h2>You do not have access to this club</h2>
        <p>Ask the club owner to add you as a manager.</p>
        <Link href="/organizer">Back to my clubs</Link>
      </section>
    );
  return null;
}

/** Client-side guard for a single club. Keep the server as the source of truth once it exists. */
export function ClubGate({
  slug,
  children,
}: {
  slug: string;
  children: (access: Extract<OrganizerAccess, { status: 'granted' }>) => React.ReactNode;
}) {
  const access = useOrganizerAccess(slug);
  if (access.status !== 'granted') return <OrganizerAccessMessage access={access} slug={slug} />;
  return <>{children(access)}</>;
}

/** Guard for pages that are not scoped to one club. */
export function OrganizerRoleGate({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const isOrganizer = user?.role === 'ORGANIZER' || user?.role === 'SUPER_ADMIN';
  if (!ready) return <p role="status">Checking your club access…</p>;
  if (!user) return <OrganizerAccessMessage access={{ status: 'signed-out' }} slug={null} />;
  if (!isOrganizer) return <OrganizerAccessMessage access={{ status: 'denied' }} slug={null} />;
  return <>{children}</>;
}
