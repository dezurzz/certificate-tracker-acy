import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseEnvConfigured } from '@/lib/supabase/config';

/**
 * Server-side checks for route handlers (/api/*). proxy.ts already blocks signed-out
 * requests; these helpers re-verify inside the handler (defense in depth) and are the
 * single place where permissions are decided.
 */

export interface SessionClaims {
  sub: string;
  email?: string;
  [key: string]: unknown;
}

/** Verified claims of the signed-in user, or null. Read-only: never writes cookies. */
export async function getSessionClaims(request: NextRequest): Promise<SessionClaims | null> {
  if (!isSupabaseEnvConfigured) return null;
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: () => {},
    },
  });
  try {
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims?.sub) return null;
    return data.claims as SessionClaims;
  } catch {
    return null;
  }
}

/**
 * Who may manage accounts and system settings.
 * TODO(roles): today every signed-in user is an admin. When roles exist, check the
 * role stored in app_metadata (never user_metadata, which users can edit themselves).
 */
export function isAdmin(claims: SessionClaims): boolean {
  void claims;
  return true;
}

/** Same-origin guard for state-changing requests (cookies are SameSite=Lax; this is a second layer). */
export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true; // non-browser callers (curl, server) carry no Origin
  try {
    return new URL(origin).host === request.nextUrl.host;
  } catch {
    return false;
  }
}
