import type { Metadata } from 'next';
import { ClubPicker } from '@/components/organizer/ClubPicker';

export const metadata: Metadata = {
  title: 'My clubs · CampusPulse Organizer',
  robots: { index: false, follow: false },
};

export default function OrganizerHomePage() {
  return <ClubPicker />;
}
