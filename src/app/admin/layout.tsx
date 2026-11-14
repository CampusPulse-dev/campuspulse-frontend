import type { Metadata } from 'next';
import { AdminShell } from '@/components/admin/AdminShell';

// Staff tooling: never indexed, never cached by a shared proxy.
export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s · CampusPulse Admin' },
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
