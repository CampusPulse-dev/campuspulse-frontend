'use client';

import React from 'react';
import { AttendeeShell } from '@/components/layout/AttendeeShell';
import { useNotifications } from '@/lib/notifications';
import { useAuth } from '@/lib/auth-context';

export function AttendeePortal({
  children,
  serverSignedIn,
}: {
  children: React.ReactNode;
  serverSignedIn: boolean;
}) {
  const { user } = useAuth();
  const notifications = useNotifications();
  return (
    <AttendeeShell
      serverSignedIn={serverSignedIn}
      unreadNotificationsCount={notifications.data?.filter((n) => !n.readAt).length ?? 0}
      userDisplayName={user?.displayName ?? null}
      isVerifiedStudent={user?.isVerifiedStudent ?? false}
    >
      {children}
    </AttendeeShell>
  );
}
