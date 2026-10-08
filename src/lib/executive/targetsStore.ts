import { getSupabaseClient } from '@/lib/db';
import { DEFAULT_TARGETS, invalidTargetField, normalizeTargets, type ExecutiveTargets } from '@/lib/executive/targets';

/** Reads/writes the executive targets in `app_settings` (key `executive_targets`). Admins write; everyone reads. */
const KEY = 'executive_targets';

export interface TargetsResult {
  targets: ExecutiveTargets;
  /** 'server' = saved by an admin; 'default' = nothing saved yet (or the read failed). */
  source: 'server' | 'default';
  updatedAt?: string | null;
  updatedBy?: string | null;
}

/** Never throws: the dashboard must render even if the setting cannot be read. */
export async function fetchExecutiveTargets(): Promise<TargetsResult> {
  const supabase = getSupabaseClient();
  if (!supabase) return { targets: DEFAULT_TARGETS, source: 'default' };
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value, updated_at, updated_by')
      .eq('key', KEY)
      .maybeSingle();
    if (error || !data) return { targets: DEFAULT_TARGETS, source: 'default' };
    return { targets: normalizeTargets(data.value), source: 'server', updatedAt: data.updated_at, updatedBy: data.updated_by };
  } catch {
    return { targets: DEFAULT_TARGETS, source: 'default' };
  }
}

/** Throws when invalid or when the database refuses (only admins may write). */
export async function saveExecutiveTargets(targets: ExecutiveTargets, by?: string): Promise<void> {
  const bad = invalidTargetField(targets);
  if (bad) throw new Error(`Invalid value for ${bad}`);
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase belum dikonfigurasi.');
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: KEY, value: targets, updated_by: by ?? null, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw new Error(error.message);
}
