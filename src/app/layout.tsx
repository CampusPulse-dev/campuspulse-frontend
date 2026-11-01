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

/*
 * Goodly is the brand display face. It is commercial, so the file is not
 * in the repo. To enable it:
 *
 *   1. drop Goodly.woff2 into src/app/fonts/
 *   2. uncomment the block below and add `goodly.variable` to the
 *      className on <html>
 *
 * Until then --font-goodly stays undefined and --font-display falls back
 * to Inter, which is why tokens.css uses a nested var() fallback.
 *
 * import localFont from 'next/font/local';
 * const goodly = localFont({
 *   src: './fonts/Goodly.woff2',
 *   display: 'swap',
 *   variable: '--font-goodly',
 * });
 */

export const metadata: Metadata = {
  title: {
    default: 'CampusPulse',
    template: '%s · CampusPulse',
  },
  description: 'Every event on campus, in one feed. And a real headcount at the door.',
  manifest: '/manifest.webmanifest',
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
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
