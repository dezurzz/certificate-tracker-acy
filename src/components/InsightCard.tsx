import React from 'react';
import type { Severity } from '@/lib/executive/insights';
import type { InsightCopy } from '@/lib/executive/insightCopy';
import { useT } from '@/i18n/LanguageContext';

const STYLE: Record<Severity, { border: string; icon: string; iconCls: string; pill: string }> = {
  risk: { border: 'border-l-red-500', icon: 'error', iconCls: 'text-red-600', pill: 'text-red-700' },
  watch: { border: 'border-l-amber-500', icon: 'warning', iconCls: 'text-amber-600', pill: 'text-amber-700' },
  good: { border: 'border-l-emerald-500', icon: 'check_circle', iconCls: 'text-emerald-600', pill: 'text-emerald-700' },
  info: { border: 'border-l-slate-300', icon: 'info', iconCls: 'text-slate-400', pill: 'text-slate-500' },
};

const DOT: Record<Severity, string> = { risk: 'bg-red-500', watch: 'bg-amber-500', good: 'bg-emerald-500', info: 'bg-slate-300' };

/** Status word with a coloured dot. Colour is only ever used to say how an indicator stands against its target. */
export function SeverityBadge({ severity }: { severity: Severity }) {
  const t = useT();
  const label: Record<Severity, string> = { risk: t('Risiko'), watch: t('Perlu dipantau'), good: t('Sesuai'), info: t('Info') };
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 text-[11px] font-semibold ${STYLE[severity].pill}`}>
      <span className={`h-2 w-2 rounded-full ${DOT[severity]}`} aria-hidden="true" />
      {label[severity]}
    </span>
  );
}

/** Two labelled statements: why it matters, and what to do. Shared by the finding card and the detail blocks. */
export function WhyAction({ why, action, className = '' }: { why?: string; action?: string; className?: string }) {
  const t = useT();
  if (!why && !action) return null;
  return (
    <div className={`grid grid-cols-1 gap-x-6 gap-y-3 text-[13px] leading-relaxed sm:grid-cols-2 ${className}`}>
      {why && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-600">{t('Kenapa penting')}</p>
          <p className="mt-0.5 text-slate-700">{why}</p>
        </div>
      )}
      {action && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-600">{t('Tindakan yang disarankan')}</p>
          <p className="mt-0.5 text-slate-700">{action}</p>
        </div>
      )}
    </div>
  );
}

/**
 * A finding in consulting form: the headline is the conclusion, the evidence line lets the reader check it,
 * then why it matters and what to do. `index` numbers the finding (the detail blocks refer back to it).
 */
export default function InsightCard({
  severity,
  copy,
  tag,
  index,
  detailHref,
}: {
  severity: Severity;
  copy: InsightCopy;
  tag?: string;
  index?: number;
  detailHref?: string;
}) {
  const t = useT();
  const s = STYLE[severity];
  return (
    <article id={index ? `temuan-${index}` : undefined} className={`cms-card scroll-mt-32 flex flex-col gap-3 border-l-4 !p-5 break-inside-avoid ${s.border}`}>
      <header className="flex items-start gap-3">
        {index ? (
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white" aria-hidden="true">
            {index}
          </span>
        ) : (
          <span className={`material-symbols-outlined mt-0.5 text-[22px] ${s.iconCls}`} aria-hidden="true">{s.icon}</span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            {tag ? <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{tag}</p> : <span />}
            <SeverityBadge severity={severity} />
          </div>
          <h3 className="mt-0.5 text-base font-semibold leading-snug text-slate-900">{copy.headline}</h3>
          {copy.evidence && <p className="mt-1 text-xs text-slate-500">{copy.evidence}</p>}
        </div>
      </header>
      <WhyAction why={copy.why} action={copy.action} className="border-t border-slate-100 pt-3" />
      {detailHref && (
        <a href={detailHref} className="self-start text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline print:hidden">
          {t('Lihat bukti')} ↓
        </a>
      )}
    </article>
  );
}
