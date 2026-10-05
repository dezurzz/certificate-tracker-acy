import type { ManagedUser } from '@/lib/auth/managedUser';
import type { Role } from '@/lib/permissions';

/** Browser-side client for the admin account API (`/api/admin/users`). Errors carry the API's `code`. */

type ApiError = Error & { code?: string };

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(body.message || `Request failed (${res.status})`), { code: body.error as string | undefined }) as ApiError;
  }
  return body as T;
}

export async function listUsers(): Promise<ManagedUser[]> {
  return (await call<{ users: ManagedUser[] }>('/api/admin/users')).users;
}

export function createUser(input: { email: string; password: string; role: Role }) {
  return call<{ id: string; email: string; role: Role }>('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateUser(id: string, patch: { role?: Role; password?: string }): Promise<ManagedUser> {
  return (await call<{ user: ManagedUser }>(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })).user;
}

export const adminErrorCode = (e: unknown) => (e as ApiError | undefined)?.code;
