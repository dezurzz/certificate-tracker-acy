'use client';

import React from 'react';
import { useT } from '@/i18n/LanguageContext';

/**
 * The one loading pattern for the whole app: skeletons that mirror the final layout.
 * Never use a bare spinner or "Memuat..." text for data that has a known shape.
 *
 *   <Skeleton className="h-4 w-32" />                      one block
 *   <TableSkeletonRows columns={[...]} />                  rows inside an existing <tbody>
 *   <CardListSkeleton /> <CardGridSkeleton /> <TimelineSkeleton /> <ChartSkeleton />
 *   <ListRowsSkeleton />                                   small lists inside cards
 *   <AppShellSkeleton />                                   whole screen (session check, Suspense)
 *
 * Every composite announces itself to screen readers (role=status + hidden label).
 * Motion is disabled automatically under prefers-reduced-motion (globals.css).
 */

export function Skeleton({ className = '' }: { className?: string }) {
  // span + block: valid inside <p>, <h1>, <button>, ... (a <div> there breaks hydration)
  return <span aria-hidden="true" className={`block animate-pulse rounded-md bg-slate-200/70 ${className}`} />;
}

/** Visually hidden live label for assistive tech. */
function LoadingLabel({ label }: { label?: string }) {
  const t = useT();
  return <span className="sr-only">{label ?? t('Memuat...')}</span>;
}

// ---------------------------------------------------------------- tables

export type SkeletonColumn =
  | string // a width class, e.g. 'w-32'
  | { w: string; kind?: 'text' | 'badge' | 'check' | 'avatar' | 'icon' | 'action' | 'twoLine'; align?: 'right' | 'center' };

function Cell({ col }: { col: SkeletonColumn }) {
  const c = typeof col === 'string' ? { w: col } : col;
  const justify = c.align === 'right' ? 'justify-end' : c.align === 'center' ? 'justify-center' : '';
  switch (c.kind) {
    case 'check':
      return <Skeleton className="h-4 w-4" />;
    case 'badge':
      return <Skeleton className={`h-5 rounded-full ${c.w}`} />;
    case 'icon':
      return <Skeleton className="h-8 w-8" />;
    case 'action':
      return (
        <div className={`flex gap-2 ${justify || 'justify-end'}`}>
          <Skeleton className="h-8 w-14" />
          <Skeleton className="h-8 w-8" />
        </div>
      );
    case 'avatar':
      return (
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className={`h-3 ${c.w}`} />
        </div>
      );
    case 'twoLine':
      return (
        <div className="space-y-1.5">
          <Skeleton className={`h-3 ${c.w}`} />
          <Skeleton className="h-2.5 w-20" />
        </div>
      );
    default:
      return (
        <div className={`flex ${justify}`}>
          <Skeleton className={`h-3 ${c.w}`} />
        </div>
      );
  }
}

/**
 * Skeleton rows for a table. Render it INSIDE <tbody> in place of the data rows so the
 * header, filters and pagination stay visible while data loads.
 * Pass one entry per column (match the real column count).
 */
export function TableSkeletonRows({
  columns,
  rows = 6,
  label,
}: {
  columns: SkeletonColumn[];
  rows?: number;
  label?: string;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} aria-busy="true">
          {columns.map((col, c) => (
            <td key={c} className="px-4 py-4">
              {r === 0 && c === 0 && <LoadingLabel label={label} />}
              <Cell col={col} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ------------------------------------------------------------ card layouts

/** Task cards (follow-ups). */
export function CardListSkeleton({ rows = 4, label }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-busy="true" className="space-y-3">
      <LoadingLabel label={label} />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-card p-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-3 w-3/4 max-w-md" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Master-data cards (companies). */
export function CardGridSkeleton({ count = 6, label, className = 'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3' }: { count?: number; label?: string; className?: string }) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <LoadingLabel label={label} />
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-xl border border-slate-200 bg-card p-4">
          <div className="flex items-start justify-between">
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
    </div>
  );
}

/** Grouped activity timeline (audit history). */
export function TimelineSkeleton({ groups = 2, items = 3, label }: { groups?: number; items?: number; label?: string }) {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-6">
      <LoadingLabel label={label} />
      {Array.from({ length: groups }).map((_, g) => (
        <div key={g} className="overflow-hidden rounded-xl border border-slate-200 bg-card">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-14" />
          </div>
          <div className="space-y-6 p-5">
            {Array.from({ length: items }).map((__, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="mt-1.5 h-2 w-2 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-2.5 w-1/4" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Bar chart placeholder. */
export function ChartSkeleton({ bars = 6, height = 'h-52', label }: { bars?: number; height?: string; label?: string }) {
  const heights = ['h-1/3', 'h-2/3', 'h-1/2', 'h-5/6', 'h-2/5', 'h-3/5'];
  return (
    <div role="status" aria-busy="true" className={`flex items-end justify-between gap-3 px-4 pt-4 ${height}`}>
      <LoadingLabel label={label} />
      {Array.from({ length: bars }).map((_, i) => (
        <Skeleton key={i} className={`w-full max-w-10 rounded-b-none ${heights[i % heights.length]}`} />
      ))}
    </div>
  );
}

/** Rows inside a card: title + subtitle + progress, or a right-aligned value. */
export function ListRowsSkeleton({ rows = 4, withBar = true, label }: { rows?: number; withBar?: boolean; label?: string }) {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-4">
      <LoadingLabel label={label} />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-2.5 w-1/2" />
            </div>
            <Skeleton className="h-3.5 w-10" />
          </div>
          {withBar && <Skeleton className="h-1.5 w-full rounded-full" />}
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------- whole screen

/**
 * Whole-screen placeholder (session check, Suspense fallbacks): dark sidebar, top bar and
 * a content area, so the page does not jump when the real layout arrives.
 */
export function AppShellSkeleton({ label }: { label?: string }) {
  return (
    <div role="status" aria-busy="true" className="flex min-h-screen bg-slate-50">
      <LoadingLabel label={label} />
      <aside aria-hidden="true" className="sidebar-fixed fixed left-0 top-0 hidden h-dvh w-64 flex-col gap-6 border-r border-slate-800 bg-slate-900 p-4 lg:flex">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 animate-pulse rounded-lg bg-blue-600/80" />
          <div className="space-y-1.5">
            <div className="h-3 w-24 animate-pulse rounded bg-slate-700" />
            <div className="h-2.5 w-16 animate-pulse rounded bg-slate-800" />
          </div>
        </div>
        {[5, 4, 2].map((n, g) => (
          <div key={g} className="space-y-2">
            <div className="h-2.5 w-20 animate-pulse rounded bg-slate-800" />
            {Array.from({ length: n }).map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded-lg bg-slate-800/70" />
            ))}
          </div>
        ))}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col lg:ml-64">
        <div aria-hidden="true" className="flex h-16 items-center justify-between border-b border-slate-200 bg-card px-4 sm:px-6">
          <Skeleton className="h-4 w-40" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
        <div aria-hidden="true" className="mx-auto w-full max-w-[1440px] space-y-6 px-4 pb-12 pt-6 sm:px-6 lg:px-8">
          <div className="space-y-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-3.5 w-80 max-w-full" />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

/** Centered card (login while the session is being checked). */
export function AuthCardSkeleton({ label }: { label?: string }) {
  return (
    <div role="status" aria-busy="true" className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <LoadingLabel label={label} />
      <div aria-hidden="true" className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-card">
        <div className="flex flex-col items-center gap-3 border-b border-slate-100 px-6 pb-6 pt-8">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-3.5 w-52" />
        </div>
        <div className="space-y-4 p-6">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/** Certificate cards inside a kanban column. */
export function KanbanCardsSkeleton({ count = 3, label }: { count?: number; label?: string }) {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-2.5">
      <LoadingLabel label={label} />
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} aria-hidden="true" className="space-y-2.5 rounded-lg border border-slate-200 bg-card p-3">
          <Skeleton className="h-2.5 w-28" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-20" />
          <div className="border-t border-slate-100 pt-2.5">
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}
