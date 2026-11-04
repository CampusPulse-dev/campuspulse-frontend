import type { NextConfig } from 'next';
import { mediaHosts } from './src/lib/media';

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // The contract ships TypeScript sources alongside its build.
  transpilePackages: ['@campuspulse/contract'],

  images: {
    formats: ['image/avif', 'image/webp'],
    // Only allowlisted media hosts are optimized; see src/lib/media.ts.
    remotePatterns: mediaHosts().map((hostname) => ({ protocol: 'https' as const, hostname })),
  },

  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" },
        ],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // The QR scanner needs the camera; nothing else does.
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default config;
