'use client';

import React from 'react';
import Button from './Button';
import { useT } from '@/i18n/LanguageContext';

/**
 * Shown when a page could not load its data from Supabase. Never show demo or
 * empty data in its place: an empty list would read as "no records".
 */
export default function LoadError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const t = useT();
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-card p-4 shadow-[0_1px_2px_rgb(15_23_42/0.04)]"
    >
      <span className="material-symbols-outlined text-[22px] text-red-600" aria-hidden="true">cloud_off</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">{t('Gagal memuat data')}</p>
        <p className="mt-0.5 break-words text-xs text-slate-500">{message}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" icon="refresh" onClick={onRetry}>
          {t('Coba lagi')}
        </Button>
      )}
    </div>
  );
}
