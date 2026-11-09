import { NewEvent } from '@/components/organizer/NewEvent';

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ slug: string; eventId: string }>;
}) {
  const { slug, eventId } = await params;
  return <NewEvent slug={slug} draftId={eventId} />;
}
