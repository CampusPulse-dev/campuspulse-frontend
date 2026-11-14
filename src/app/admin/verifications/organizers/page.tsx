import type { Metadata } from 'next';
import { VerificationQueue } from '@/components/admin/VerificationQueue';

export const metadata: Metadata = { title: 'Clubs & creators' };

export default function OrganizerVerificationsPage() {
  return <VerificationQueue mode="organizers" />;
}
