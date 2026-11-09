import type { Metadata } from 'next';
import { TeamManager } from '@/components/organizer/TeamManager';

export const metadata: Metadata = {
  title: 'Team · CampusPulse Organizer',
  robots: { index: false, follow: false },
};

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <TeamManager slug={slug} />;
}
