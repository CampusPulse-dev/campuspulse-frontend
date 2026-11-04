import localFont from 'next/font/local';
import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { AppProviders } from '@/components/layout/AppProviders';
import './globals.css';

// Inter is the UI/UX face on the brand board. Self-hosted by next/font,
// so there is no render-blocking request to Google on a Nigerian mobile
// connection — which matters against the 2.5s cold-load budget.
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

// JetBrains Mono carries timestamps, live RSVP/check-in counters, and QR pass IDs.
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
});

const goodly = localFont({
  src: './fonts/GoodlyRegular.woff2',
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
