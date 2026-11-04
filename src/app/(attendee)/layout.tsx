import { cookies } from 'next/headers';
import { AttendeePortal } from '@/components/layout/AttendeePortal';
export default async function AttendeePortalLayout({ children }: { children: React.ReactNode }) {
  const signedIn = (await cookies()).get('cp_signed_in')?.value === '1';
  return <AttendeePortal serverSignedIn={signedIn}>{children}</AttendeePortal>;
}
