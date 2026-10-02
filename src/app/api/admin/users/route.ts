import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { SUPABASE_URL, isSupabaseEnvConfigured } from '@/lib/supabase/config';
import { getSessionClaims, isAdmin, isSameOrigin } from '@/lib/auth/guard';

/**
 * Creates a staff account (admin only). Uses the Supabase service role key, which exists
 * ONLY on the server (SUPABASE_SERVICE_ROLE_KEY, never NEXT_PUBLIC_). This is what lets public
 * sign-up stay switched off in Supabase: accounts can only be created through this route.
 *
 * Responses: { id, email } on success; { error: <code>, message } otherwise.
 *   401 unauthenticated · 403 not allowed · 400 invalid input · 409 email exists
 *   501 service role key missing · 503 Supabase not configured
 */

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(72),
});

const fail = (status: number, error: string, message: string) =>
  NextResponse.json({ error, message }, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return fail(403, 'forbidden_origin', 'Cross-origin request blocked.');

  const claims = await getSessionClaims(request);
  if (!claims) return fail(401, 'unauthenticated', 'Sign in required.');
  if (!isAdmin(claims)) return fail(403, 'forbidden', 'Only admins can create accounts.');

  let parsed;
  try {
    parsed = bodySchema.safeParse(await request.json());
  } catch {
    return fail(400, 'invalid_input', 'Request body must be JSON.');
  }
  if (!parsed.success) return fail(400, 'invalid_input', 'A valid email and a password of at least 8 characters are required.');

  if (!isSupabaseEnvConfigured) return fail(503, 'supabase_not_configured', 'Supabase is not configured on the server.');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return fail(501, 'service_role_missing', 'SUPABASE_SERVICE_ROLE_KEY is not set on the server.');
  }

  const admin = createClient(SUPABASE_URL, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
  });

  if (error) {
    const exists = /already|registered|exists/i.test(error.message);
    return fail(exists ? 409 : 400, exists ? 'email_exists' : 'create_failed', exists ? 'This email is already registered.' : error.message);
  }
  return NextResponse.json({ id: data.user?.id, email: data.user?.email }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
