import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Refreshes the auth session cookie on every request and gates the (app)
 * route group behind authentication. Tracking + public API routes pass
 * through untouched.
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

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

  if (isAppRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for static files, images, the tracking
     * script, public api endpoints, and webhooks.
     */
    '/((?!_next/static|_next/image|favicon.ico|track.js|api/track|api/public|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
