import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'CampusPulse',
    template: '%s · CampusPulse',
  },
  description: 'Every event on campus, in one feed.',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#0b0b0f',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
