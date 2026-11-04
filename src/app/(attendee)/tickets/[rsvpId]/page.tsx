import { Wallet } from '@/components/attendee/Wallet';
export default async function Page({ params }: { params: Promise<{ rsvpId: string }> }) {
  const { rsvpId } = await params;
  return <Wallet rsvpId={rsvpId} />;
}
