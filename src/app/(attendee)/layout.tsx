'use client';

import React from 'react';
import { AttendeeShell } from '@/components/layout/AttendeeShell';
import { useAuth } from '@/lib/auth-context';

export default function AttendeePortalLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return (
    <AttendeeShell
      userDisplayName={user?.displayName ?? null}
      isVerifiedStudent={user?.isVerifiedStudent ?? false}
    >
      {children}
    </AttendeeShell>
  );
}
