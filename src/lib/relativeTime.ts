import type { TFunction } from '@/i18n/LanguageContext';

/**
 * "5 minutes ago" style label in the current language. `short` is for tight table cells.
 * Beyond a week it falls back to a localized date.
 */
export function formatRelativeTime(
  date: Date,
  t: TFunction,
  locale: string,
  opts: { short?: boolean; withYear?: boolean } = {}
): string {
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (diffMs < 0 || mins < 1) return t('Baru saja');
  if (mins < 60) return opts.short ? t('{n} mnt lalu', { n: mins }) : t('{n} menit lalu', { n: mins });
  if (hours < 24) return t('{n} jam lalu', { n: hours });
  if (days === 1) return t('Kemarin');
  if (days < 7) return t('{n} hari lalu', { n: days });
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short', ...(opts.withYear ? { year: 'numeric' } : {}) });
}
