import type { Metadata } from 'next';
import { OrganizerDashboard } from '@/components/organizer/OrganizerDashboard';

export const metadata: Metadata = {
  title: 'Dashboard · CampusPulse Organizer',
  robots: { index: false, follow: false },
};

export default async function OrganizerDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <OrganizerDashboard slug={slug} />;
}
