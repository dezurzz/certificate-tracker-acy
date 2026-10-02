/**
 * Supabase / auth configuration shared by the browser client, proxy.ts and route handlers.
 * NEXT_PUBLIC_* values are inlined at build time.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/** True when the server knows which Supabase project to trust. */
export const isSupabaseEnvConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** Dev-only marker cookie for the local demo login (never honored in production builds). */
export const MOCK_SESSION_COOKIE = 'bki_mock_session';

export const LOGIN_PATH = '/';
export const DEFAULT_AFTER_LOGIN = '/dashboard';

/**
 * Only same-site relative paths are allowed as a post-login destination.
 * Blocks open redirects such as `//evil.com`, `/\evil.com` or absolute URLs.
 */
export function safeNextPath(next: string | null | undefined, fallback = DEFAULT_AFTER_LOGIN): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return fallback;
  if (next === LOGIN_PATH || next.startsWith('/auth/')) return fallback;
  return next;
}
