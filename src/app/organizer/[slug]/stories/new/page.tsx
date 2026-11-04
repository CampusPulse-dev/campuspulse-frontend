import type { Metadata } from 'next';
import { StoryComposer } from '@/components/organizer/StoryComposer';

export const metadata: Metadata = {
  title: 'New story · CampusPulse Organizer',
  robots: { index: false, follow: false },
};

export default async function NewStoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <StoryComposer slug={slug} />;
}
