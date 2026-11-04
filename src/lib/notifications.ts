'use client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './auth-context';
import { DEMO_MODE } from './mode';
import { attendeeRequest, demoNotices, readLocal, type Notice } from './attendee-data';
export function useNotifications() {
  const { user, accessToken, ready } = useAuth();
  return useQuery({
    queryKey: ['notifications', user?.id],
    enabled: ready && !!user,
    retry: false,
    queryFn: async () =>
      DEMO_MODE
        ? readLocal<Notice[]>(`notifications:${user!.id}`, demoNotices)
        : (await attendeeRequest('NotificationsResponse', '/notifications', accessToken)).items,
  });
}
