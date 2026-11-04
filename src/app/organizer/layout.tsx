'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { usePathname } from 'next/navigation';
import { OrganizerShell } from '@/components/organizer/OrganizerShell';
import { useAuth } from '@/lib/auth-context';

export default function OrganizerPortalLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const params = useParams<{ slug?: string }>();
  const pathname = usePathname();
  if (pathname?.startsWith('/organizer/door/')) return <main>{children}</main>;
  return (
    <OrganizerShell slug={params?.slug ?? null} userDisplayName={user?.displayName ?? null}>
      {children}
    </OrganizerShell>
  );
}
