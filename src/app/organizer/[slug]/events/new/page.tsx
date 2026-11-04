import type { Metadata } from 'next';
import { NewEvent } from '@/components/organizer/NewEvent';

export const metadata: Metadata = {
  title: 'New event · CampusPulse Organizer',
  robots: { index: false, follow: false },
};

export default async function NewEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <NewEvent slug={slug} />;
}
