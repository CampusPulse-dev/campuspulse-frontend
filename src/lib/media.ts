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
  // Our own static files (/demo/…, /brand/…) are safe to optimize: not a proxy.
  if (url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\')) return true;
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === 'https:' && hosts.includes(hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Seeds and the API store our own static covers as absolute URLs on the site
 * (`https://campuspulse.ng/demo/…`). As paths they go through the optimizer
 * instead of shipping the full-size original.
 */
export function sameSiteImage(
  url: string,
  site = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://campuspulse.ng',
): string {
  try {
    const parsed = new URL(url);
    if (parsed.origin === new URL(site).origin) return parsed.pathname + parsed.search;
  } catch {
    // Relative paths and junk fall through unchanged.
  }
  return url;
}

/** `src` and `unoptimized` for next/image: own-site paths and allowlisted hosts are optimized. */
export function imageSource(url: string, hosts = mediaHosts()) {
  const src = sameSiteImage(url);
  return { src, unoptimized: !isOptimizableImage(src, hosts) };
}
