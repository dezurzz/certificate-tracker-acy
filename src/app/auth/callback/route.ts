import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseEnvConfigured, LOGIN_PATH, safeNextPath } from '@/lib/supabase/config';

/**
 * Completes email-link flows (password reset, email confirmation): exchanges the one-time
 * `code` for a session cookie, then sends the user to `next` (same-site paths only).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNextPath(searchParams.get('next'));

  if (!code || !isSupabaseEnvConfigured) {
    return NextResponse.redirect(`${origin}${LOGIN_PATH}?error=auth_callback`);
  }

  const cookieStore = await cookies();
  const response = NextResponse.redirect(`${origin}${next}`);
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet, headers) => {
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}${LOGIN_PATH}?error=auth_callback`);
  return response;
}
