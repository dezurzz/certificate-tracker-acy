/** Readable message from anything thrown (Error, Supabase error object, string, unknown). */
export function getErrorMessage(e: unknown, fallback = 'Terjadi kesalahan yang tidak diketahui'): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
    return (e as { message: string }).message;
  }
  return fallback;
}
