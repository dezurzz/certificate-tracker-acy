import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { ROLES } from '@/lib/permissions';
import { fail, getServiceClient, ok, requireAdminRequest, toManagedUser } from '@/lib/auth/adminApi';

/**
 * Account management (admin only). Uses the Supabase service role key, which exists ONLY on the
 * server (SUPABASE_SERVICE_ROLE_KEY, never NEXT_PUBLIC_). Because accounts can only be created here,
 * public sign-up stays switched off in Supabase.
 *
 *   GET  -> { users: ManagedUser[] }
 *   POST { email, password, role? } -> { id, email, role }   (role defaults to "viewer")
 *
 * Errors: { error: <code>, message } with
 *   401 unauthenticated · 403 not allowed · 400 invalid input · 409 email exists
 *   501 service role key missing · 503 Supabase not configured
 */

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(72),
  role: z.enum(ROLES as [string, ...string[]]).default('viewer'),
});

export async function GET(request: NextRequest) {
  const guard = await requireAdminRequest(request);
  if (guard instanceof NextResponse) return guard;

  const client = getServiceClient();
  if (client instanceof NextResponse) return client;

  const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) return fail(500, 'list_failed', error.message);

  const users = data.users
    .map(toManagedUser)
    .sort((a, b) => a.email.localeCompare(b.email));
  return ok({ users });
}

export async function POST(request: NextRequest) {
  const guard = await requireAdminRequest(request);
  if (guard instanceof NextResponse) return guard;

  let parsed;
  try {
    parsed = createSchema.safeParse(await request.json());
  } catch {
    return fail(400, 'invalid_input', 'Request body must be JSON.');
  }
  if (!parsed.success) return fail(400, 'invalid_input', 'A valid email, a password of at least 8 characters and a valid role are required.');

  const client = getServiceClient();
  if (client instanceof NextResponse) return client;

  const { data, error } = await client.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    app_metadata: { role: parsed.data.role },
  });

  if (error) {
    const exists = /already|registered|exists/i.test(error.message);
    return fail(exists ? 409 : 400, exists ? 'email_exists' : 'create_failed', exists ? 'This email is already registered.' : error.message);
  }
  return ok({ id: data.user?.id, email: data.user?.email, role: parsed.data.role }, 201);
}
