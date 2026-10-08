import { NextResponse, type NextRequest } from 'next/server';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { SUPABASE_URL, isSupabaseEnvConfigured } from '@/lib/supabase/config';
import { getSessionClaims, isAdmin, isSameOrigin, type SessionClaims } from '@/lib/auth/guard';
import { parseRole } from '@/lib/permissions';
import type { ManagedUser } from '@/lib/auth/managedUser';

/** Shared plumbing for the /api/admin/* route handlers (account and role management). */

export const fail = (status: number, error: string, message: string) =>
  NextResponse.json({ error, message }, { status, headers: { 'Cache-Control': 'no-store' } });

export const ok = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/**
 * Same-origin + signed-in + admin. Returns the verified claims, or the error response to send.
 * proxy.ts already blocks signed-out requests; this re-verifies inside the handler.
 */
export async function requireAdminRequest(request: NextRequest): Promise<SessionClaims | NextResponse> {
  if (!isSameOrigin(request)) return fail(403, 'forbidden_origin', 'Cross-origin request blocked.');
  const claims = await getSessionClaims(request);
  if (!claims) return fail(401, 'unauthenticated', 'Sign in required.');
  if (!isAdmin(claims)) return fail(403, 'forbidden', 'Only admins can manage accounts.');
  return claims;
}

/** Supabase client with the service role key (server only), or the error response to send. */
export function getServiceClient(): SupabaseClient | NextResponse {
  if (!isSupabaseEnvConfigured) return fail(503, 'supabase_not_configured', 'Supabase is not configured on the server.');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return fail(501, 'service_role_missing', 'SUPABASE_SERVICE_ROLE_KEY is not set on the server.');
  return createClient(SUPABASE_URL, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function toManagedUser(u: User): ManagedUser {
  const meta = (u.user_metadata ?? {}) as { full_name?: string };
  return {
    id: u.id,
    email: u.email ?? '',
    name: meta.full_name || (u.email ?? '').split('@')[0],
    // role comes from app_metadata only (user_metadata is user-editable)
    role: parseRole((u.app_metadata as { role?: unknown } | undefined)?.role),
    createdAt: u.created_at,
    lastSignInAt: u.last_sign_in_at ?? null,
  };
}

export const isUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
