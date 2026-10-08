/**
 * Age of a certificate in whole days, computed from its dates.
 *
 * The `sla_age_days` column in the database is only ever written as 0 when a certificate is created
 * and nothing updates it, so it cannot be trusted. The age is therefore derived here, from the moment
 * the certificate was created:
 *   - still in progress: until now
 *   - Completed: until it was last updated (the completion), so it stops growing once done
 * Pure and dependency-free (`npm run analytics:check` tests it).
 */
const DAY_MS = 86_400_000;

export interface AgeInput {
  status: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export function certificateAgeDays(c: AgeInput, now: Date = new Date()): number {
  const start = c.created_at ? Date.parse(c.created_at) : NaN;
  if (Number.isNaN(start)) return 0;
  const doneAt = c.status === 'Completed' && c.updated_at ? Date.parse(c.updated_at) : NaN;
  const end = Number.isNaN(doneAt) ? now.getTime() : doneAt;
  return Math.max(0, Math.floor((end - start) / DAY_MS));
}

/** Replaces the stored (stale) `sla_age_days` of each certificate with the computed age. */
export function withComputedAge<T extends AgeInput & { sla_age_days: number }>(certs: T[], now: Date = new Date()): T[] {
  return certs.map(c => ({ ...c, sla_age_days: certificateAgeDays(c, now) }));
}
