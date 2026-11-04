'use client';

import React from 'react';
import { AttendeeShell } from '@/components/layout/AttendeeShell';
import { useNotifications } from '@/lib/notifications';
import { useAuth } from '@/lib/auth-context';

export default function AttendeePortalLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const notifications = useNotifications();
  return (
    <AttendeeShell
      unreadNotificationsCount={notifications.data?.filter((n) => !n.readAt).length ?? 0}
      userDisplayName={user?.displayName ?? null}
      isVerifiedStudent={user?.isVerifiedStudent ?? false}
    >
      {children}
    </AttendeeShell>
  );
}
