import { msg } from '@/i18n/msg';
import type { Role } from '@/lib/permissions';

/** Display names (translation keys: render with `t(ROLE_LABELS[role])`). */
export const ROLE_LABELS: Record<Role, string> = {
  admin: msg('Admin'),
  staff: msg('Staf'),
  executive: msg('Executive'),
  viewer: msg('Hanya-lihat'),
};
