import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { ROLES, parseRole } from '@/lib/permissions';
import { fail, getServiceClient, isUuid, ok, requireAdminRequest, toManagedUser } from '@/lib/auth/adminApi';

/**
 * Change an account's role and/or set a new password (admin only).
 *
 *   PATCH { role?, password? } -> { user: ManagedUser }
 *
 * Safeguards: an admin cannot demote themselves, and the last admin can never be demoted
 * (nobody could manage accounts afterwards). A role change reaches that user's token on its next
 * refresh (or when they sign in again); it is not instant.
 *
 * Errors: 401 · 403 · 400 invalid input · 404 no such user · 409 self_demote / last_admin
 */

const patchSchema = z
  .object({
    role: z.enum(ROLES as [string, ...string[]]).optional(),
    password: z.string().min(8).max(72).optional(),
  })
  .refine(v => v.role !== undefined || v.password !== undefined, { message: 'Nothing to update' });

export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/admin/users/[id]'>) {
  const guard = await requireAdminRequest(request);
  if (guard instanceof NextResponse) return guard;
  const claims = guard;

  const { id } = await ctx.params;
  if (!isUuid(id)) return fail(400, 'invalid_input', 'Invalid user id.');

  let parsed;
  try {
    parsed = patchSchema.safeParse(await request.json());
  } catch {
    return fail(400, 'invalid_input', 'Request body must be JSON.');
  }
  if (!parsed.success) return fail(400, 'invalid_input', 'Provide a valid role and/or a password of at least 8 characters.');

  const client = getServiceClient();
  if (client instanceof NextResponse) return client;

  const target = await client.auth.admin.getUserById(id);
  if (target.error || !target.data.user) return fail(404, 'not_found', 'User not found.');

  const newRole = parsed.data.role;
  if (newRole !== undefined) {
    const currentRole = parseRole((target.data.user.app_metadata as { role?: unknown } | undefined)?.role);
    if (currentRole === 'admin' && newRole !== 'admin') {
      if (id === claims.sub) return fail(409, 'self_demote', 'You cannot remove your own admin role.');
      const all = await client.auth.admin.listUsers({ page: 1, perPage: 200 });
      if (all.error) return fail(500, 'list_failed', all.error.message);
      const otherAdmins = all.data.users.filter(
        u => u.id !== id && parseRole((u.app_metadata as { role?: unknown } | undefined)?.role) === 'admin'
      );
      if (otherAdmins.length === 0) return fail(409, 'last_admin', 'There must be at least one admin.');
    }
  }

  const { data, error } = await client.auth.admin.updateUserById(id, {
    ...(parsed.data.password !== undefined ? { password: parsed.data.password } : {}),
    ...(newRole !== undefined ? { app_metadata: { role: newRole } } : {}),
  });
  if (error || !data.user) return fail(400, 'update_failed', error?.message ?? 'Update failed.');

  return ok({ user: toManagedUser(data.user) });
}
