'use client';

import React from 'react';

export interface TabItem<T extends string> {
  id: T;
  label: React.ReactNode;
  icon?: string;
  count?: number;
  /** Highlight the count when it signals a problem (e.g. overdue > 0). */
  countTone?: 'default' | 'danger' | 'warning';
}

interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}

const countCls = {
  default: 'bg-slate-100 text-slate-600',
  danger: 'bg-red-50 text-red-700',
  warning: 'bg-amber-50 text-amber-700',
};

/** Underline tabs: the single tab pattern used across the app. */
export default function Tabs<T extends string>({ items, value, onChange, className = '' }: TabsProps<T>) {
  return (
    <div role="tablist" className={`flex gap-6 overflow-x-auto overflow-y-hidden border-b border-slate-200 table-scroll ${className}`}>
      {items.map(item => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={`-mb-px flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 pb-3 pt-1 text-sm transition-colors ${
              active
                ? 'border-blue-600 font-medium text-slate-900'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            {item.icon && (
              <span className={`material-symbols-outlined text-[18px] ${active ? 'text-blue-600' : ''}`} aria-hidden="true">
                {item.icon}
              </span>
            )}
            {item.label}
            {typeof item.count === 'number' && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${
                  item.count > 0 ? countCls[item.countTone ?? 'default'] : countCls.default
                }`}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
