import { NextResponse, type NextRequest } from 'next/server';

/**
 * Lightweight auth gate for the (app) route group. Cloud Run middleware runs
 * on the Edge runtime, where Firebase Admin can't initialize, so we don't
 * verify the session cookie cryptographically here — we just check that one
 * is present and let the page-level loader do the real verification.
 *
 * The real auth check happens in app/(app)/layout.tsx via getCurrentUser().
 */
const SESSION_COOKIE = '__Secure-nr-session';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAppRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/notices') ||
    pathname.startsWith('/contacts') ||
    pathname.startsWith('/companies') ||
    pathname.startsWith('/pipelines') ||
    pathname.startsWith('/campaigns') ||
    pathname.startsWith('/workflows') ||
    pathname.startsWith('/forms') ||
    pathname.startsWith('/analytics') ||
    pathname.startsWith('/segments') ||
    pathname.startsWith('/tags') ||
    pathname.startsWith('/settings');

  if (!isAppRoute) return NextResponse.next();

  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (!cookie) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|track.js|api/track|api/public|api/webhooks|api/auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
