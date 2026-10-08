import type { Role } from '@/lib/permissions';

/** An account as shown in the user-management page (safe to send to the browser). */
export interface ManagedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
  lastSignInAt: string | null;
}
