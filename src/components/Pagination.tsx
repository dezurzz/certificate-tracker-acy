'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useT } from '@/i18n/LanguageContext';

export const PAGE_SIZES = [10, 25, 50, 100];

/**
 * Client-side pagination state. Pass the already-filtered list; the page resets
 * to 1 whenever `resetKey` changes (e.g. a string of the active filters) and is
 * clamped if the list shrinks.
 */
export function usePagination<T>(items: T[], resetKey: string, initialPageSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  useEffect(() => {
    setPage(1);
  }, [resetKey, pageSize]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const pageItems = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize]
  );

  return { page: safePage, setPage, pageSize, setPageSize, pageItems, total: items.length, totalPages };
}

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  className?: string;
}

/** Compact page list with ellipses, e.g. 1 ... 4 5 6 ... 12 */
function pageList(page: number, totalPages: number): (number | 'gap')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages].filter(p => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('gap');
    out.push(p);
  });
  return out;
}

const btn =
  'flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40';

export default function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  className = '',
}: PaginationProps) {
  const t = useT();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <nav
      aria-label={t('Paginasi')}
      className={`flex flex-col gap-3 border-t border-slate-200 bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span className="tabular-nums">
          {from}-{to} {t('dari')} {total}
        </span>
        <label className="flex items-center gap-1.5">
          {t('Baris')}<select
            value={pageSize}
            onChange={e => onPageSizeChange(Number(e.target.value))}
            className="cms-select-filter !h-8 !text-xs"
            aria-label={t('Baris per halaman')}
          >
            {PAGE_SIZES.map(s => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          className={`${btn} border-slate-200 text-slate-600 hover:bg-slate-50`}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label={t('Halaman sebelumnya')}
        >
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">chevron_left</span>
        </button>
        {pageList(page, totalPages).map((p, i) =>
          p === 'gap' ? (
            <span key={`gap-${i}`} className="px-1 text-xs text-slate-400" aria-hidden="true">...</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              aria-current={p === page ? 'page' : undefined}
              className={`${btn} tabular-nums ${
                p === page
                  ? 'border-blue-600 bg-blue-50 font-medium text-blue-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          className={`${btn} border-slate-200 text-slate-600 hover:bg-slate-50`}
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label={t('Halaman berikutnya')}
        >
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">chevron_right</span>
        </button>
      </div>
    </nav>
  );
}
