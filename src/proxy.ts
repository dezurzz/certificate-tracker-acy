import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  isSupabaseEnvConfigured,
  MOCK_SESSION_COOKIE,
  LOGIN_PATH,
  DEFAULT_AFTER_LOGIN,
  safeNextPath,
} from '@/lib/supabase/config';

/**
 * Server-side route protection (Next.js "proxy", formerly middleware).
 *
 * - Every page except the login page and /auth/* requires a valid Supabase session.
 *   The session is read from cookies (written by the browser client in lib/db.ts),
 *   verified with `getClaims()`, and refreshed here when it is about to expire.
 * - Signed-out visitors are redirected to the login page with `?next=<original path>`;
 *   signed-in users who open the login page go straight to the app.
 * - Fails closed: with no Supabase configuration on the server nobody gets in
 *   (except the dev-only demo cookie, which is stripped from production builds).
 *
 * This is the real gate. The client-side ProtectedRoute only improves UX.
 * Data access is still enforced separately by Supabase RLS.
 */

function isPublicPath(pathname: string) {
  return pathname === LOGIN_PATH || pathname.startsWith('/auth/');
}

type CookieWriter = (res: NextResponse) => void;

/** Resolves whether the request carries a valid session, plus a writer for any refreshed cookies. */
async function checkSession(request: NextRequest): Promise<{ authed: boolean; writeCookies: CookieWriter }> {
  let writeCookies: CookieWriter = () => {};

  // Dev-only demo login (localStorage mock session mirrored into a cookie)
  if (process.env.NODE_ENV !== 'production' && request.cookies.get(MOCK_SESSION_COOKIE)?.value === '1') {
    return { authed: true, writeCookies };
  }

  if (!isSupabaseEnvConfigured) return { authed: false, writeCookies };

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        // Token refresh: forward the new cookies to the request (for rendering) and the response
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        writeCookies = res => {
          cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
          Object.entries(headers).forEach(([key, value]) => res.headers.set(key, value));
        };
      },
    },
  });

  try {
    const { data, error } = await supabase.auth.getClaims();
    return { authed: !error && Boolean(data?.claims?.sub), writeCookies };
  } catch {
    return { authed: false, writeCookies };
  }
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const { authed, writeCookies } = await checkSession(request);

  const finish = (res: NextResponse) => {
    writeCookies(res);
    return res;
  };

  if (pathname === LOGIN_PATH && authed) {
    const next = safeNextPath(request.nextUrl.searchParams.get('next'), DEFAULT_AFTER_LOGIN);
    return finish(NextResponse.redirect(new URL(next, request.url)));
  }

  if (!isPublicPath(pathname) && !authed) {
    // API callers expect a status code, not an HTML redirect
    if (pathname.startsWith('/api/')) {
      return finish(NextResponse.json({ error: 'unauthenticated', message: 'Sign in required.' }, { status: 401 }));
    }
    const url = new URL(LOGIN_PATH, request.url);
    const original = pathname + search;
    if (safeNextPath(original, '') !== '') url.searchParams.set('next', original);
    return finish(NextResponse.redirect(url));
  }

  return finish(NextResponse.next({ request }));
}

export const config = {
  matcher: [
    // Everything except Next internals and static files (images, fonts, icons)
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|map|txt)$).*)',
  ],
};
