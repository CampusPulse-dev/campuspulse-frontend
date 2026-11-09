/**
 * Hosts whose images go through the Next image optimizer (AVIF/WebP, resized).
 * `coverImageUrl` may point anywhere, and optimizing arbitrary hosts would turn
 * /_next/image into an open proxy, so only an explicit allowlist is optimized.
 * Shared with next.config.ts, which builds `images.remotePatterns` from it.
 */
export function mediaHosts(raw = process.env.NEXT_PUBLIC_MEDIA_HOSTS ?? ''): string[] {
  return raw
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

export function isOptimizableImage(url: string, hosts = mediaHosts()): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === 'https:' && hosts.includes(hostname.toLowerCase());
  } catch {
    return false;
  }
}
