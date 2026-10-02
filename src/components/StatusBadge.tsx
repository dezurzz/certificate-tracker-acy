import React from 'react';
import { useT, msg } from '@/i18n/LanguageContext';

/**
 * Certificate workflow: Pending -> Processing -> Printing -> Completed.
 * In-flight steps share the accent (info); only "done" and "overdue" carry
 * semantic color, so the eye goes straight to what needs attention.
 */
const CERT_STATUS: Record<string, { label: string; cls: string }> = {
  Pending: { label: msg('Menunggu'), cls: 'cms-badge-neutral' },
  Processing: { label: msg('Proses QC'), cls: 'cms-badge-info' },
  Printing: { label: msg('Dicetak'), cls: 'cms-badge-info' },
  Completed: { label: msg('Selesai'), cls: 'cms-badge-success' },
  Overdue: { label: msg('Terlambat'), cls: 'cms-badge-danger' },
};

export function CertStatusBadge({ status, className = '' }: { status: string; className?: string }) {
  const t = useT();
  const cfg = CERT_STATUS[status] ?? { label: status, cls: 'cms-badge-neutral' };
  return <span className={`cms-badge ${cfg.cls} ${className}`}>{t(cfg.label)}</span>;
}

/** Certificate type is a category, not a state: always neutral, told apart by icon. */
export function CertTypeBadge({ type }: { type: string }) {
  const t = useT();
  const isQualification = type === 'Qualification';
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-600">
      <span className="material-symbols-outlined text-[14px] text-slate-400" aria-hidden="true">
        {isQualification ? 'workspace_premium' : 'assignment_turned_in'}
      </span>
      {isQualification ? t('Kualifikasi') : t('Kehadiran')}
    </span>
  );
}
