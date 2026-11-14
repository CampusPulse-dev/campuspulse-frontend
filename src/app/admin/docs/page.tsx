import type { Metadata } from 'next';
import { Docs } from '@/components/admin/Docs';

export const metadata: Metadata = { title: 'Reviewer guide' };

export default function AdminDocsPage() {
  return <Docs />;
}
