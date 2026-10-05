/**
 * Roles and permissions: the single source of truth.
 *
 * Dependency-free on purpose (no React, no i18n) so it can be used by the
 * browser, route handlers and proxy.ts alike.
 *
 * IMPORTANT: this decides what the APP shows and which routes it serves. What the
 * DATABASE enforces is decided by RLS (stage 5 of the roles work), and the two must
 * stay in sync. The role itself lives in `app_metadata.role` (writable only by the
 * server with the service key), NEVER in `user_metadata`, which users can edit.
 */

export type Role = 'admin' | 'staff' | 'executive' | 'viewer';

export const ROLES: readonly Role[] = ['admin', 'staff', 'executive', 'viewer'];

/** Anything unknown or missing is the least-privileged *browsing* role. */
export const DEFAULT_ROLE: Role = 'viewer';

export function parseRole(value: unknown): Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value) ? (value as Role) : DEFAULT_ROLE;
}

/** Entities a staff member may delete only when they created them. */
export type OwnedEntity = 'lead' | 'training' | 'certificate';

export type Action =
  /** Create/update leads, batches, certificates, participants, directories; change status; bulk actions; sync; CSV import. */
  | 'data.write'
  /** Delete a lead / batch / certificate (staff: only their own, see `OwnedEntity`). */
  | `delete.${OwnedEntity}`
  /** Delete a company, contact or training program. */
  | 'delete.directory'
  /** System settings (SLA threshold). */
  | 'settings.system'
  /** Manage accounts and roles. */
  | 'users.manage';

export interface PermissionContext {
  /** `created_by` of the row being acted on (null/undefined = legacy row without an owner). */
  ownerId?: string | null;
  /** Id of the signed-in user. */
  userId?: string | null;
}

export function can(role: Role, action: Action, ctx: PermissionContext = {}): boolean {
  if (role === 'admin') return true;

  if (role === 'staff') {
    if (action === 'data.write') return true;
    if (action.startsWith('delete.') && action !== 'delete.directory') {
      // Own rows only. A legacy row (no owner) can be deleted by admins only.
      return Boolean(ctx.userId && ctx.ownerId && ctx.userId === ctx.ownerId);
    }
    return false;
  }

  // executive and viewer: read-only
  return false;
}

// ---------------------------------------------------------------------------
// Page access
// ---------------------------------------------------------------------------

/** Pages only admins may open. */
const ADMIN_ONLY_PREFIXES = ['/settings/system', '/settings/users'];

/** The only pages an executive may open (everything else is operational). Prefix match on path segments. */
const EXECUTIVE_PREFIXES = [
  '/executive',
  '/reports', // Laporan SLA
  '/crm/reports', // Rekap Minat
  '/settings/profile',
  '/settings/security',
  '/settings/notifications',
  '/settings', // settings index redirects to /settings/profile
];

const matches = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(prefix + '/');

export function canAccessPath(role: Role, pathname: string): boolean {
  if (ADMIN_ONLY_PREFIXES.some(p => matches(pathname, p))) return role === 'admin';
  if (role === 'executive') {
    // '/settings' alone must not open /settings/system: the admin-only check above runs first
    return EXECUTIVE_PREFIXES.some(p => matches(pathname, p));
  }
  return true;
}

/** Where a role lands after signing in. */
export function homePath(role: Role): string {
  return role === 'executive' ? '/executive' : '/dashboard';
}
