import { DoorConsole } from '@/components/organizer/DoorConsole';

export const metadata = {
  title: 'Door console · CampusPulse',
  robots: { index: false, follow: false },
};
export default async function Page({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return <DoorConsole eventId={eventId} />;
}
