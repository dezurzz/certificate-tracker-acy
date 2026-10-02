'use client';

import { toast } from 'sonner';

/**
 * App-wide feedback API. Use this instead of `alert()` or calling `toast` directly,
 * so wording and behavior stay consistent.
 *
 *   notify.success('Lead berhasil ditambahkan');
 *   notify.error('Gagal menyimpan', err);          // err message becomes the description
 *   notify.warning('Nama kontak wajib diisi');     // validation problems
 *   notify.info('Fitur belum tersedia');
 *   notify.promise(DB.save(x), { loading: 'Menyimpan...', success: 'Tersimpan', error: 'Gagal menyimpan' });
 */

function errorMessage(err: unknown): string | undefined {
  if (!err) return undefined;
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message);
  return undefined;
}

export const notify = {
  success: (title: string, description?: string) => toast.success(title, { description }),
  info: (title: string, description?: string) => toast.info(title, { description }),
  warning: (title: string, description?: string) => toast.warning(title, { description }),
  /** `err` may be an Error, a string, or `{ message }`; it is shown as the description. */
  error: (title: string, err?: unknown) =>
    toast.error(title, { description: errorMessage(err), duration: 6000 }),
  promise: toast.promise,
  dismiss: toast.dismiss,
};
