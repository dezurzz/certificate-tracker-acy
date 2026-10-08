'use client';

import React from 'react';
import { useT } from '@/i18n/LanguageContext';

/**
 * The one filter/search/sort toolbar for every list page.
 * A card with two zones: a uniform grid of controls (search, selects, date
 * range) and a footer with the result count, "reset" and the sort dropdown.
 * Never lay filters out by hand with flex-wrap: rows end up ragged.
 */
interface FilterBarProps {
  /** FilterSearch / FilterSelect / FilterDateRange / FilterToggle cells. */
  children: React.ReactNode;
  /** e.g. "Menampilkan 12 dari 40 lead". */
  summary?: React.ReactNode;
  /** Right side of the footer: a SortSelect (and optionally a group-by select). */
  sort?: React.ReactNode;
  hasActive?: boolean;
  onReset?: () => void;
}

export default function FilterBar({ children, summary, sort, hasActive, onReset }: FilterBarProps) {
  const t = useT();
  return (
    <section
      aria-label={t('Filter dan urutan')}
      className="rounded-xl border border-slate-200 bg-card shadow-[0_1px_2px_rgb(15_23_42/0.04)]"
    >
      <div className="grid grid-cols-2 gap-2.5 p-3 lg:grid-cols-[repeat(auto-fill,minmax(13.5rem,1fr))]">
        {children}
      </div>
      {(summary || sort || hasActive) && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-slate-100 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-3 text-[13px] text-slate-500">
            {summary && <span aria-live="polite">{summary}</span>}
            {hasActive && onReset && (
              <button
                type="button"
                onClick={onReset}
                className="cursor-pointer font-semibold text-blue-600 hover:text-blue-700 hover:underline"
              >
                {t('Reset Filter')}
              </button>
            )}
          </div>
          {sort && <div className="flex flex-wrap items-center gap-3">{sort}</div>}
        </div>
      )}
    </section>
  );
}

export function FilterSearch({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label?: string;
}) {
  return (
    <div className="relative col-span-2">
      <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400" aria-hidden="true">
        search
      </span>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label || placeholder}
        className="cms-input h-9 !pl-10 !text-[13px]"
      />
    </div>
  );
}

export function FilterSelect({
  value,
  onChange,
  label,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Accessible name (visually the first option, e.g. "Semua Status", says it). */
  label: string;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      aria-label={label}
      className="cms-select-filter w-full min-w-0 truncate"
    >
      {children}
    </select>
  );
}

const DATE_FIELD =
  'min-w-0 flex-1 bg-transparent text-[13px] text-slate-700 outline-none [color-scheme:inherit]';
const DATE_WRAP =
  'flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-card px-3 text-[13px] text-slate-500 transition-colors focus-within:border-blue-600 focus-within:ring-[3px] focus-within:ring-blue-600/15 hover:border-slate-400';

/** Single date with an inline caption, same height as the selects. */
export function FilterDate({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <label className={DATE_WRAP} title={label}>
      <span className="shrink-0 whitespace-nowrap">{label}</span>
      <input type="date" value={value} onChange={e => onChange(e.target.value)} aria-label={label} className={DATE_FIELD} />
    </label>
  );
}

/** From–to date range with an inline caption (spans two grid columns). */
export function FilterDateRange({
  from,
  to,
  onFromChange,
  onToChange,
  label,
  fromLabel,
  toLabel,
}: {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  label: string;
  fromLabel: string;
  toLabel: string;
}) {
  return (
    <div role="group" aria-label={label} className={`${DATE_WRAP} col-span-2`}>
      <span className="shrink-0 whitespace-nowrap">{label}</span>
      <input type="date" value={from} max={to || undefined} onChange={e => onFromChange(e.target.value)} aria-label={fromLabel} title={fromLabel} className={DATE_FIELD} />
      <span aria-hidden="true">–</span>
      <input type="date" value={to} min={from || undefined} onChange={e => onToChange(e.target.value)} aria-label={toLabel} title={toLabel} className={DATE_FIELD} />
    </div>
  );
}
