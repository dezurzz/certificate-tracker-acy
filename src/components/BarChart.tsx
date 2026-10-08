'use client';

import React from 'react';

export interface BarDatum {
  label: string;
  value: number;
}

/**
 * Minimal vertical bar chart (CSS only, no chart library). One message per chart: pass `highlight`
 * (a bar index) to put the accent on the bar the headline is about and mute the rest. The value sits
 * above each bar so exact numbers are readable without hovering.
 */
export default function BarChart({
  data,
  height = 'h-48',
  ariaLabel,
  highlight,
}: {
  data: BarDatum[];
  height?: string;
  ariaLabel: string;
  highlight?: number;
}) {
  const max = Math.max(1, ...data.map(d => d.value));
  return (
    <div className="pb-6">
      <div role="img" aria-label={ariaLabel} className={`relative flex items-end justify-around gap-2 border-b border-slate-200 px-2 pt-6 ${height}`}>
        {data.map((d, i) => {
          const accent = highlight === undefined || highlight === i;
          return (
            <div key={d.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <span className={`text-[11px] tabular-nums ${accent ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>{d.value}</span>
              <div
                className={`w-full max-w-12 rounded-t-md ${d.value === 0 ? 'bg-slate-200' : accent ? 'bg-blue-600' : 'bg-slate-300'}`}
                style={{ height: `${d.value > 0 ? Math.max(4, (d.value / max) * 100) : 2}%` }}
              />
            </div>
          );
        })}
        <div className="pointer-events-none absolute inset-x-2 top-full flex justify-around gap-2 pt-1.5">
          {data.map(d => (
            <span key={d.label} className="min-w-0 flex-1 truncate text-center text-[11px] text-slate-500">{d.label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

export interface PairDatum {
  label: string;
  a: number;
  b: number;
}

/** Two bars per month (e.g. entered vs completed) with a legend: for flow comparisons. */
export function PairedBarChart({
  data,
  aLabel,
  bLabel,
  height = 'h-48',
  ariaLabel,
}: {
  data: PairDatum[];
  aLabel: string;
  bLabel: string;
  height?: string;
  ariaLabel: string;
}) {
  const max = Math.max(1, ...data.flatMap(d => [d.a, d.b]));
  const bar = (value: number, cls: string) => (
    <div className="flex h-full w-full max-w-7 flex-col items-center justify-end gap-1">
      <span className="text-[11px] tabular-nums text-slate-700">{value}</span>
      <div className={`w-full rounded-t-md ${value === 0 ? 'bg-slate-200' : cls}`} style={{ height: `${value > 0 ? Math.max(4, (value / max) * 100) : 2}%` }} />
    </div>
  );
  return (
    <div className="pb-6">
      <div className="mb-2 flex gap-4 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-400" aria-hidden="true" />{aLabel}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-blue-600" aria-hidden="true" />{bLabel}</span>
      </div>
      <div role="img" aria-label={ariaLabel} className={`relative flex items-end justify-around gap-3 border-b border-slate-200 px-2 pt-6 ${height}`}>
        {data.map(d => (
          <div key={d.label} className="flex h-full min-w-0 flex-1 items-end justify-center gap-1">
            {bar(d.a, 'bg-slate-400')}
            {bar(d.b, 'bg-blue-600')}
          </div>
        ))}
        <div className="pointer-events-none absolute inset-x-2 top-full flex justify-around gap-3 pt-1.5">
          {data.map(d => (
            <span key={d.label} className="min-w-0 flex-1 truncate text-center text-[11px] text-slate-500">{d.label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
