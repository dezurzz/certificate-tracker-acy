'use client';

import React from 'react';
import { useT } from '@/i18n/LanguageContext';

export interface SortOption<K extends string = string> {
  value: K;
  label: string;
}

interface SortSelectProps<K extends string> {
  value: K;
  onChange: (value: K) => void;
  options: SortOption<K>[];
  className?: string;
}

/** "Urutkan: <option>" dropdown used by every list page, styled like the other filter selects. */
export default function SortSelect<K extends string>({ value, onChange, options, className = '' }: SortSelectProps<K>) {
  const t = useT();
  return (
    <label className={`inline-flex items-center gap-2 text-[13px] font-medium text-slate-500 ${className}`}>
      <span className="material-symbols-outlined text-[18px] text-slate-400" aria-hidden="true">swap_vert</span>
      <span className="whitespace-nowrap">{t('Urutkan')}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value as K)}
        className="cms-select-filter min-w-[170px]"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
