'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { useNotifications } from '@/lib/notifications';
import { DEMO_MODE, safeNext } from '@/lib/mode';
import { attendeeRequest, writeLocal } from '@/lib/attendee-data';
import { Button } from '@/components/ui/Button';
import { AccountGate, PageFrame, ResourceState, styles } from './Shared';
export function Notifications() {
  const { user, accessToken } = useAuth();
  const query = useNotifications();
  const client = useQueryClient();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function read(id: string) {
    try {
      if (DEMO_MODE)
        writeLocal(
          `notifications:${user!.id}`,
          query.data?.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
        );
      else
        await attendeeRequest(
          'AttendeeNotification',
          `/notifications/${id}/read`,
          accessToken,
          'POST',
        );
      await client.invalidateQueries({ queryKey: ['notifications', user?.id] });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to mark as read.');
    }
  }
  async function enablePush() {
    setBusy(true);
    try {
      if (
        !('Notification' in window) ||
        !('serviceWorker' in navigator) ||
        !('PushManager' in window)
      ) {
        setMessage(
          'Push is unavailable here. On iOS, add CampusPulse to your Home Screen first. Your in-app alerts still work.',
        );
        return;
      }
      if (Notification.permission === 'denied') {
        setMessage('Notifications are blocked. Enable them in your browser settings.');
        return;
      }
      if (DEMO_MODE) {
        setMessage('Demo mode: push delivery requires the live notification service.');
        return;
      }
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) {
        setMessage('Push delivery is not configured yet. In-app alerts are still available.');
        return;
      }
      if ((await Notification.requestPermission()) !== 'granted') {
        setMessage('Notifications were not enabled. You can try again later.');
        return;
      }
      await navigator.serviceWorker.register('/sw.js');
      const reg = await navigator.serviceWorker.ready;
      const decoded = atob(key.replace(/-/g, '+').replace(/_/g, '/'));
      const bytes = Uint8Array.from(decoded, (c) => c.charCodeAt(0));
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes }));
      await attendeeRequest(
        'PushSubscriptionBody',
        '/notifications/push-subscribe',
        accessToken,
        'POST',
        sub.toJSON(),
      );
      setMessage('Push notifications enabled.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not enable notifications. Please retry.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <PageFrame
      title="Stay in the loop"
      subtitle="Your event updates, reminders, and campus connections."
    >
      <AccountGate>
        <section className={styles.panel}>
          <div className={styles.spread}>
            <div>
              <h2>Catch the important moments</h2>
              <p className={styles.muted}>
                Choose whether this device receives push notifications.
              </p>
            </div>
            <Button onClick={enablePush} isLoading={busy}>
              Enable push
            </Button>
          </div>
          {message ? <p role="status">{message}</p> : null}
        </section>
        <ResourceState pending={query.isPending} error={query.error} retry={query.refetch} />
        <div className={styles.list}>
          {query.data?.map((n) => (
            <article key={n.id} className={`${styles.panel} ${n.readAt ? '' : styles.unread}`}>
              <div className={styles.spread}>
                <h2>{n.title}</h2>
                <time className={styles.mono}>
                  {new Date(n.createdAt).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })} WAT
                </time>
              </div>
              <p>{n.body}</p>
              <div className={styles.actions}>
                <Link href={safeNext(n.href)}>View update →</Link>
                {!n.readAt ? (
                  <Button variant="ghost" onClick={() => read(n.id)}>
                    Mark as read
                  </Button>
                ) : (
                  <span className={styles.muted}>Read</span>
                )}
              </div>
            </article>
          ))}
        </div>
        {query.data?.length === 0 ? <p>You are all caught up.</p> : null}
      </AccountGate>
    </PageFrame>
  );
}
