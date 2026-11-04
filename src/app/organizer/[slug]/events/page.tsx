import { OrganizerDashboard } from '@/components/organizer/OrganizerDashboard';
export default async function EventsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <OrganizerDashboard slug={slug} eventsOnly />;
}
