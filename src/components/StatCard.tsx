import React from 'react';
import Link from 'next/link';
import { Skeleton } from './Skeleton';

export type StatTone = 'default' | 'success' | 'warning' | 'danger';

interface StatCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Secondary line under the value. */
  hint?: React.ReactNode;
  /** Material Symbols icon name. */
  icon?: string;
  /**
   * Semantic tone. Only colors the value/icon when the number signals state
   * (e.g. overdue > 0). Leave 'default' for plain counts.
   */
  tone?: StatTone;
  /** When set, the card becomes a filter toggle. */
  onClick?: () => void;
  /** When set, the card navigates to a detail page. */
  href?: string;
  active?: boolean;
  /** Show a placeholder instead of the value while data loads (the label stays). */
  loading?: boolean;
  className?: string;
}

const toneValue: Record<StatTone, string> = {
  default: 'text-slate-900',
  success: 'text-emerald-700',
  warning: 'text-amber-700',
  danger: 'text-red-700',
};

const toneIcon: Record<StatTone, string> = {
  default: 'text-slate-400',
  success: 'text-emerald-600',
  warning: 'text-amber-600',
  danger: 'text-red-600',
};

/**
 * Neutral KPI tile. Color is reserved for semantic state; the accent (blue)
 * only marks the active filter.
 */
export default function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'default',
  onClick,
  href,
  active = false,
  loading = false,
  className = '',
}: StatCardProps) {
  const interactive = typeof onClick === 'function' || Boolean(href);
  const base = `group relative flex flex-col rounded-xl border bg-card p-4 text-left shadow-[0_1px_2px_rgb(15_23_42/0.04)] transition-colors ${
    active ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-200'
  } ${interactive ? 'cursor-pointer hover:border-slate-300' : ''} ${className}`;

  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        {icon && (
          <span className={`material-symbols-outlined text-[18px] ${toneIcon[tone]}`} aria-hidden="true">
            {icon}
          </span>
        )}
      </div>
      {loading ? (
        <>
          <Skeleton className="mt-2 h-8 w-16" />
          {hint && <Skeleton className="mt-2 h-3 w-28" />}
        </>
      ) : (
        <>
          <span className={`cms-stat-value mt-2 text-2xl font-semibold tracking-tight ${toneValue[tone]}`}>{value}</span>
          {hint && <span className="mt-1 text-xs text-slate-500">{hint}</span>}
        </>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={base}>
        {content}
      </Link>
    );
  }
  if (interactive) {
    return (
      <button type="button" onClick={onClick} aria-pressed={active} className={base}>
        {content}
      </button>
    );
  }
  return <div className={base}>{content}</div>;
}
