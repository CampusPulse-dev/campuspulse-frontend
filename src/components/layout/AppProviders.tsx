'use client';

import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/lib/auth-context';
import { ToastProvider } from '@/components/ui/Toast';
import { FriendIntentProvider } from '@/components/attendee/FriendIntentProvider';
import { ServerViewSync } from './ServerViewSync';

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            retry: 1,
          },
        },
      }),
  );

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Same options as the offline savers, so their register() calls never change the registration.
      navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {
        // Ignore service worker registration errors in dev/test
      });
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ServerViewSync />
        <ToastProvider>
          <FriendIntentProvider>{children}</FriendIntentProvider>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
