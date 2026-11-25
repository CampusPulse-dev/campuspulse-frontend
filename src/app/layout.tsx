import localFont from 'next/font/local';
import type { Metadata, Viewport } from 'next';
import { AppProviders } from '@/components/layout/AppProviders';
import './globals.css';

// Checked-in, subset fonts (see fonts/PROVENANCE.md and scripts/subset-fonts.py). Every page
// downloads only the small *core* files; the rest of Inter loads on demand.
const inter = localFont({
  src: './fonts/InterCore.woff2',
  weight: '400 700',
  display: 'swap',
  variable: '--font-inter',
});

const interExt = localFont({
  src: './fonts/InterExt.woff2',
  weight: '400 700',
  display: 'swap',
  preload: false,
  // No metric-matched Arial here: it has no unicode-range and would swallow every character.
  adjustFontFallback: false,
  // Exactly the code points in InterExt.woff2 (generated from the file; keep in sync with
  // scripts/subset-fonts.py). The browser fetches the file only when a page uses one of them,
  // e.g. Yoruba names (ẹ ọ ṣ and tone marks). It sits first in the --font-body stack.
  // next/font needs a literal here.
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0100-0130, U+0132-0148, U+014A-0151, U+0154-017F, U+0300-0304, U+0306-030A, U+030C, U+030F, U+0313, U+0315, U+031B, U+0323, U+0326-0328, U+032C, U+0337-0338, U+0342-0343, U+0346-036F, U+1E00-1E9B, U+1E9D-1EFF, U+2000-200B, U+202F, U+203B-2055, U+2057, U+205F, U+20A0-20A5, U+20A7-20AB, U+20AD-20AF, U+20B1-20B5, U+20B8-20BA, U+20BC-20C0, U+2191, U+2193-2199, U+21A9-21AA, U+21B0-21B1, U+21B3-21B5, U+21BA-21BB, U+21D0, U+21D2, U+21D4, U+21DE-21DF, U+21E4-21E5, U+21E7, U+21EA',
    },
  ],
  variable: '--font-inter-ext',
});

// JetBrains Mono carries timestamps, live RSVP/check-in counters, and QR pass IDs.
const jetbrainsMono = localFont({
  src: './fonts/JetBrainsMonoCore.woff2',
  weight: '400 700',
  display: 'swap',
  // Never in the first paint of a public page; don't let it compete with the hero.
  preload: false,
  variable: '--font-jetbrains-mono',
});

const goodly = localFont({
  src: './fonts/GoodlyCore.woff2',
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
    <html
      lang="en"
      className={`${inter.variable} ${interExt.variable} ${jetbrainsMono.variable} ${goodly.variable}`}
    >
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
