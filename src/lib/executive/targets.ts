/**
 * Targets the executive dashboard measures against. Pure (no I/O) so it can be shared with the
 * settings screen and the insight engine. Stored by admins in app_settings under `executive_targets`.
 */
export interface ExecutiveTargets {
  /** Share of leads that should reach "Terdaftar" (%). */
  conversionPct: number;
  /** Highest acceptable share of cancelled leads (%). */
  cancelMaxPct: number;
  /** Share of certificates that should be within the SLA threshold (%). */
  slaCompliancePct: number;
  /** An open lead with no activity for longer than this many days counts as "idle". */
  staleDays: number;
  /** Fewer observations than this are never turned into a conclusion ("data belum cukup"). */
  minSample: number;
}

export const DEFAULT_TARGETS: ExecutiveTargets = {
  conversionPct: 40,
  cancelMaxPct: 25,
  slaCompliancePct: 90,
  staleDays: 7,
  minSample: 5,
};

export const TARGET_LIMITS: Record<keyof ExecutiveTargets, { min: number; max: number }> = {
  conversionPct: { min: 1, max: 100 },
  cancelMaxPct: { min: 1, max: 100 },
  slaCompliancePct: { min: 1, max: 100 },
  staleDays: { min: 1, max: 90 },
  minSample: { min: 1, max: 50 },
};

const KEYS = Object.keys(DEFAULT_TARGETS) as (keyof ExecutiveTargets)[];

/** Turns whatever was stored into a valid object: missing or out-of-range values fall back to the defaults. */
export function normalizeTargets(raw: unknown): ExecutiveTargets {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out = { ...DEFAULT_TARGETS };
  for (const k of KEYS) {
    const n = Number(src[k]);
    const { min, max } = TARGET_LIMITS[k];
    if (Number.isInteger(n) && n >= min && n <= max) out[k] = n;
  }
  return out;
}

/** First problem found (field name), or null when every value is a whole number within its range. */
export function invalidTargetField(t: ExecutiveTargets): keyof ExecutiveTargets | null {
  for (const k of KEYS) {
    const { min, max } = TARGET_LIMITS[k];
    if (!Number.isInteger(t[k]) || t[k] < min || t[k] > max) return k;
  }
  return null;
}
