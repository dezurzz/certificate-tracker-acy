'use client';

import React from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import PageHeader from '@/components/PageHeader';
import { useT } from '@/i18n/LanguageContext';

/**
 * Landing page of the Executive role. Placeholder until the executive dashboard (lead funnel,
 * SLA performance, period trends) is built in the next stage; it already links to the two
 * analytics pages an executive may open today.
 */
export default function ExecutivePage() {
  const t = useT();
  return (
    <DashboardLayout pageTitle="Executive Dashboard">
      <div className="space-y-6">
        <PageHeader
          title={t('Dashboard Eksekutif')}
          description={t('Ringkasan performa untuk menganalisis data: konversi leads, SLA sertifikat, dan tren.')}
        />

        <div className="cms-card flex flex-col items-center gap-3 !p-10 text-center">
          <span className="material-symbols-outlined text-4xl text-slate-400" aria-hidden="true">query_stats</span>
          <p className="text-sm font-semibold text-slate-900">{t('Dashboard eksekutif sedang disiapkan')}</p>
          <p className="max-w-md text-xs text-slate-500">
            {t('Sementara itu, Anda bisa melihat laporan yang sudah tersedia.')}
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <Link href="/reports" className="cms-btn-secondary">{t('Laporan SLA')}</Link>
            <Link href="/crm/reports" className="cms-btn-secondary">{t('Rekap Minat')}</Link>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
