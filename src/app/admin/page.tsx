import type { Metadata } from 'next';
import { Overview } from '@/components/admin/Overview';

// A page in the same segment as the layout does not get the layout's title template.
export const metadata: Metadata = { title: { absolute: 'Overview · CampusPulse Admin' } };

export default function AdminOverviewPage() {
  return <Overview />;
}
