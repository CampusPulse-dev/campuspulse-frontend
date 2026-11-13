import localFont from 'next/font/local';
import type { Metadata, Viewport } from 'next';
import { AppProviders } from '@/components/layout/AppProviders';
import './globals.css';

// Checked-in fonts keep builds independent of Google Fonts availability.
const inter = localFont({
  // Latin + Yoruba diacritics subset of Inter (352 KB -> 89 KB); see fonts/PROVENANCE.md.
  src: './fonts/InterLatin.woff2',
  weight: '100 900',
  display: 'swap',
  variable: '--font-inter',
});

// JetBrains Mono carries timestamps, live RSVP/check-in counters, and QR pass IDs.
const jetbrainsMono = localFont({
  src: './fonts/JetBrainsMonoLatin.woff2',
  weight: '100 800',
  display: 'swap',
  // Never in the first paint of a public page; don't let it compete with the hero.
  preload: false,
  variable: '--font-jetbrains-mono',
});

const goodly = localFont({
  src: './fonts/GoodlyLatin.woff2',
  weight: '400',
  display: 'swap',
  variable: '--font-goodly',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://campuspulse.ng'),
  title: {
    default: 'CampusPulse',
    template: '%s · CampusPulse',
  },
  description: 'Every event on campus, in one feed. And a real headcount at the door.',
  manifest: '/manifest.webmanifest',
  icons: { apple: '/icons/icon-180.png', icon: '/icons/icon-192.png' },
};

export const viewport: Viewport = {
  // Matches --cp-ink, so the browser chrome does not flash white.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#10002b' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} ${goodly.variable}`}>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
