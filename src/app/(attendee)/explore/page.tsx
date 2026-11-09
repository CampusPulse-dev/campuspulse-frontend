import { EventFeed } from '@/components/events/EventFeed';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Explore campus events' };
export default function ExplorePage() {
  return <EventFeed />;
}
