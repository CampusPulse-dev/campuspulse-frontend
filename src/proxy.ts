import { NextResponse, type NextRequest } from 'next/server';

/**
 * Keeps signed-out visitors out of the admin portal before any of it renders.
 *
 * `cp_signed_in` is only a presentation hint (the session itself is an
 * httpOnly cookie scoped to the API), so this is a convenience, not a security
 * boundary: the role check happens in AdminShell, and every `/admin/*` API
 * route enforces the role on the server.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.get('cp_signed_in')?.value === '1') return NextResponse.next();
  const signIn = new URL('/sign-in', request.url);
  signIn.searchParams.set('next', request.nextUrl.pathname);
  return NextResponse.redirect(signIn);
}

export const config = { matcher: ['/admin', '/admin/:path*'] };
