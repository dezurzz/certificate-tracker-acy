import React from 'react';
import { useT } from '@/i18n/LanguageContext';

export type ScoreStatus = 'good' | 'watch' | 'risk' | 'neutral';

const DOT: Record<ScoreStatus, string> = {
  good: 'bg-emerald-500',
  watch: 'bg-amber-500',
  risk: 'bg-red-500',
  neutral: 'bg-slate-300',
};

/** One indicator against its target. Colour appears only as the status dot: the number stays neutral. */
export default function ScorecardTile({
  label,
  value,
  target,
  status,
  note,
  labels,
}: {
  label: string;
  value: React.ReactNode;
  /** Short target text, e.g. "≥ 40%". */
  target?: string;
  status: ScoreStatus;
  note?: React.ReactNode;
  /** Override the wording of the status for indicators that have no numeric target (trends, counts). */
  labels?: Partial<Record<ScoreStatus, string>>;
}) {
  const t = useT();
  const statusText: Record<ScoreStatus, string> = {
    good: t('Sesuai target'),
    watch: t('Perlu dipantau'),
    risk: t('Di bawah target'),
    neutral: t('Tanpa target'),
    ...labels,
  };
  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-card p-4 break-inside-avoid">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-slate-500">{label}</p>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] text-slate-500">
          <span className={`h-2 w-2 rounded-full ${DOT[status]}`} aria-hidden="true" />
          {statusText[status]}
        </span>
      </div>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      <p className="mt-1 text-[11px] text-slate-500">
        {target ? `${t('Target')}: ${target}` : ''}
        {target && note ? ' · ' : ''}
        {note}
      </p>
    </div>
  );
}
