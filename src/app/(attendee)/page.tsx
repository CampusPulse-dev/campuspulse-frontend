import { cookies } from 'next/headers';
import { EventFeed } from '@/components/events/EventFeed';
import { Landing } from '@/components/landing/Landing';
import { fetchEventFeed } from '@/lib/api';
export const dynamic = 'force-dynamic';
async function featuredEvents() {
  try {
    const first = await fetchEventFeed();
    const more =
      first.items.length < 4 && first.nextCursor
        ? await fetchEventFeed({ cursor: first.nextCursor }).catch(() => null)
        : null;
    return { events: [...first.items, ...(more?.items ?? [])].slice(0, 4), error: false };
  } catch {
    return { events: [], error: true };
  }
}
export default async function AttendeeHomePage() {
  if ((await cookies()).get('cp_signed_in')?.value === '1') return <EventFeed />;
  const featured = await featuredEvents();
  return <Landing {...featured} />;
}
