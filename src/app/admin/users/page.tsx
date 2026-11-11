import type { Metadata } from 'next';
import { Users } from '@/components/admin/Users';

export const metadata: Metadata = { title: 'Users & roles' };

export default function AdminUsersPage() {
  return <Users />;
}
