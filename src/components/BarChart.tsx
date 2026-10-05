'use client';

import React from 'react';

export interface BarDatum {
  label: string;
  value: number;
}

/**
 * Minimal vertical bar chart (CSS only, no chart library). One accent color; the value sits above
 * each bar so exact numbers are readable without hovering. Used for monthly trends.
 */
export default function BarChart({ data, height = 'h-48', ariaLabel }: { data: BarDatum[]; height?: string; ariaLabel: string }) {
  const max = Math.max(1, ...data.map(d => d.value));
  return (
    <div role="img" aria-label={ariaLabel} className={`relative flex items-end justify-around gap-2 border-b border-slate-200 px-2 pt-6 ${height}`}>
      {data.map(d => (
        <div key={d.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
          <span className="text-[11px] font-medium tabular-nums text-slate-700">{d.value}</span>
          <div
            className={`w-full max-w-12 rounded-t-md ${d.value > 0 ? 'bg-blue-600' : 'bg-slate-200'}`}
            style={{ height: `${d.value > 0 ? Math.max(4, (d.value / max) * 100) : 2}%` }}
          />
        </div>
      ))}
      {/* month labels sit below the axis line */}
      <div className="pointer-events-none absolute inset-x-2 top-full flex justify-around gap-2 pt-1.5">
        {data.map(d => (
          <span key={d.label} className="min-w-0 flex-1 truncate text-center text-[11px] text-slate-500">{d.label}</span>
        ))}
      </div>
    </div>
  );
}
