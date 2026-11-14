import type { Metadata } from 'next';
import { VerificationQueue } from '@/components/admin/VerificationQueue';

export const metadata: Metadata = { title: 'Student IDs' };

export default function StudentVerificationsPage() {
  return <VerificationQueue mode="students" />;
}
