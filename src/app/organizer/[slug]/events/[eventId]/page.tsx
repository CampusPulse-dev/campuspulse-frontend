import type { Metadata } from 'next';
import { EventHub } from '@/components/organizer/EventHub';

export const metadata: Metadata = {
  title: 'Event · CampusPulse Organizer',
  robots: { index: false, follow: false },
};

export default async function OrganizerEventPage({
  params,
}: {
  params: Promise<{ slug: string; eventId: string }>;
}) {
  const { slug, eventId } = await params;
  return <EventHub slug={slug} eventId={eventId} />;
}
