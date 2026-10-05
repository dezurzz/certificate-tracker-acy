import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseEnvConfigured } from '@/lib/supabase/config';
import { parseRole, type Role } from '@/lib/permissions';

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
 * The role of a verified session. It comes from `app_metadata.role` in the JWT (writable only
 * with the service key); `user_metadata` is user-editable and must never be trusted. A missing or
 * unknown role is the least-privileged `viewer`. Note: a role change reaches the token only after
 * it is refreshed (or the user signs in again).
 */
export function getRole(claims: SessionClaims): Role {
  const meta = claims.app_metadata as { role?: unknown } | undefined;
  return parseRole(meta?.role);
}

/** Who may manage accounts and system settings. */
export function isAdmin(claims: SessionClaims): boolean {
  return getRole(claims) === 'admin';
}

/** True when the session's role is one of `roles`. */
export function hasRole(claims: SessionClaims, ...roles: Role[]): boolean {
  return roles.includes(getRole(claims));
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
