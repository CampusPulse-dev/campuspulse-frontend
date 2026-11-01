import { notFound } from 'next/navigation';
import { fetchCreator } from '@/lib/attendee-data';
import { Creator } from '@/components/attendee/Creator';
export default async function Page({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const creator = await fetchCreator(handle);
  if (!creator) notFound();
  return <Creator creator={creator} />;
}
