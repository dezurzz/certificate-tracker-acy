import { useEffect, useSyncExternalStore } from 'react';
import { getSupabaseClient } from '@/lib/db';

/**
 * Central app settings. Source of truth is the Supabase table `app_settings`
 * (see supabase_schema_settings.sql). localStorage keeps a cache so screens can
 * read the value synchronously and keep working offline / before the table exists.
 */

export const SLA_DEFAULT_DAYS = 4;
export const SLA_MIN_DAYS = 1;
export const SLA_MAX_DAYS = 365;

const SLA_KEY = 'sla_days';
const CACHE_KEY = 'sys_sla'; // same key the app has always used
const UPDATE_EVENT = 'bki-settings-update';
const REFRESH_TTL_MS = 30_000;

export interface SlaSetting {
  days: number;
  /** 'server' = read from Supabase; 'local' = browser cache / default. */
  source: 'server' | 'local';
  updatedAt?: string | null;
  updatedBy?: string | null;
  /** Why the server value is unavailable (Supabase off, table missing, ...). */
  unavailableReason?: 'not-configured' | 'table-missing' | 'error';
  errorMessage?: string;
}

export function isValidSlaDays(n: number) {
  return Number.isInteger(n) && n >= SLA_MIN_DAYS && n <= SLA_MAX_DAYS;
}

export function getCachedSlaDays(): number {
  if (typeof window === 'undefined') return SLA_DEFAULT_DAYS;
  try {
    const n = parseInt(localStorage.getItem(CACHE_KEY) || '', 10);
    return isValidSlaDays(n) ? n : SLA_DEFAULT_DAYS;
  } catch {
    return SLA_DEFAULT_DAYS;
  }
}

function writeCache(days: number) {
  try {
    const changed = localStorage.getItem(CACHE_KEY) !== String(days);
    localStorage.setItem(CACHE_KEY, String(days));
    if (changed) window.dispatchEvent(new Event(UPDATE_EVENT));
  } catch {
    /* storage blocked: ignore */
  }
}

function isTableMissing(err: { code?: string; message?: string } | null) {
  if (!err) return false;
  return err.code === '42P01' || err.code === 'PGRST205' || /app_settings/i.test(err.message || '') && /(does not exist|schema cache|not find)/i.test(err.message || '');
}

/** Reads the SLA setting, preferring Supabase. Never throws: reports why it fell back instead. */
export async function fetchSlaSetting(): Promise<SlaSetting> {
  const supabase = getSupabaseClient();
  if (!supabase) return { days: getCachedSlaDays(), source: 'local', unavailableReason: 'not-configured' };

  const { data, error } = await supabase
    .from('app_settings')
    .select('value, updated_at, updated_by')
    .eq('key', SLA_KEY)
    .maybeSingle();

  if (error) {
    return {
      days: getCachedSlaDays(),
      source: 'local',
      unavailableReason: isTableMissing(error) ? 'table-missing' : 'error',
      errorMessage: error.message,
    };
  }
  const days = Number(data?.value);
  if (!data || !isValidSlaDays(days)) {
    // Table exists but no row yet: use default
    return { days: SLA_DEFAULT_DAYS, source: 'server' };
  }
  return { days, source: 'server', updatedAt: data.updated_at, updatedBy: data.updated_by };
}

/**
 * Saves the SLA for every admin. With Supabase configured the server write must
 * succeed (otherwise this throws, so we never pretend it was shared). Without
 * Supabase (local mock mode) it only updates the browser cache.
 */
export async function saveSlaDays(days: number, by?: string): Promise<{ shared: boolean }> {
  if (!isValidSlaDays(days)) throw new Error(`SLA must be a whole number between ${SLA_MIN_DAYS} and ${SLA_MAX_DAYS} days.`);
  const supabase = getSupabaseClient();
  if (supabase) {
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: SLA_KEY, value: days, updated_by: by ?? null, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) {
      const err = new Error(error.message) as Error & { tableMissing?: boolean };
      err.tableMissing = isTableMissing(error);
      throw err;
    }
    writeCache(days);
    return { shared: true };
  }
  writeCache(days);
  return { shared: false };
}

const MISSING_KEY = 'bki_settings_table_missing';
const MISSING_TTL_MS = 10 * 60_000;

function tableKnownMissing() {
  try {
    return Date.now() - Number(sessionStorage.getItem(MISSING_KEY) || 0) < MISSING_TTL_MS;
  } catch {
    return false;
  }
}

let lastRefresh = 0;
let inFlight: Promise<void> | null = null;

/** Pulls the server value into the local cache (throttled). */
export function refreshSlaCache(force = false): Promise<void> {
  if (inFlight) return inFlight;
  if (!force && (Date.now() - lastRefresh < REFRESH_TTL_MS || tableKnownMissing())) return Promise.resolve();
  inFlight = fetchSlaSetting()
    .then(s => {
      if (s.source === 'server') writeCache(s.days);
      else if (s.unavailableReason === 'table-missing') {
        try {
          sessionStorage.setItem(MISSING_KEY, String(Date.now()));
        } catch {
          /* ignore */
        }
      }
    })
    .catch(() => undefined)
    .finally(() => {
      lastRefresh = Date.now();
      inFlight = null;
    });
  return inFlight;
}

function subscribe(cb: () => void) {
  window.addEventListener(UPDATE_EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(UPDATE_EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

/** Current SLA threshold in days. Updates when the server value or another tab changes it. */
export function useSlaDays(): number {
  const days = useSyncExternalStore(subscribe, getCachedSlaDays, () => SLA_DEFAULT_DAYS);
  useEffect(() => {
    refreshSlaCache();
  }, []);
  return days;
}
