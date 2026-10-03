'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { DB, Training, Certificate } from '@/lib/db';
import Button from '@/components/Button';
import DropdownButton from '@/components/DropdownButton';
import PageHeader from '@/components/PageHeader';
import LoadError from '@/components/LoadError';
import { getErrorMessage } from '@/lib/errors';
import { useT, useLanguage, msg } from '@/i18n/LanguageContext';
import { useSlaDays } from '@/lib/settings';
import { Skeleton, ChartSkeleton, ListRowsSkeleton, TableSkeletonRows } from '@/components/Skeleton';

interface PicMetric {
  name: string;
  batches: number;
  avgAge: number;
  overdueRate: number;
  complianceRate: number;
  complianceClass: string;
  overdueClass: string;
}

interface MonthlyRecord {
  name: string;
  count: number;
}

/** Period options. `days: null` = all time. Applied to a certificate's created_at. */
const PERIODS = [
  { id: '7d', label: msg('7 Hari Terakhir'), days: 7 },
  { id: '30d', label: msg('30 Hari Terakhir'), days: 30 },
  { id: '6m', label: msg('6 Bulan Terakhir'), days: 183 },
  { id: 'all', label: msg('Semua Waktu'), days: null },
] as const;

const CHART_MONTHS = 6;

export default function ReportsPage() {
  const t = useT();
  const slaThreshold = useSlaDays();
  const { locale } = useLanguage();
  const router = useRouter();
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activePeriod, setActivePeriod] = useState<string>('6m');

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [trainList, certList] = await Promise.all([DB.getTrainings(), DB.getCertificates()]);
      setTrainings(trainList);
      setCertificates(certList);
    } catch (e) {
      setLoadError(getErrorMessage(e));
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);


  // Everything below is derived from the loaded data and the selected period.
  const { picMetrics, monthlyRecords, overdueByStage, totalOverdue } = useMemo(() => {
    const days = PERIODS.find(p => p.id === activePeriod)?.days ?? null;
    const cutoff = days === null ? null : Date.now() - days * 24 * 3600 * 1000;
    const inPeriod = (c: Certificate) => {
      if (cutoff === null) return true;
      return c.created_at ? new Date(c.created_at).getTime() >= cutoff : false;
    };
    const periodCerts = certificates.filter(inPeriod);

    // 1. PIC SLA metrics (batches counted for PICs that have certificates in the period)
    const pics: Record<string, { name: string; batchIds: Set<string>; certs: Certificate[] }> = {};
    periodCerts.forEach(c => {
      const pic = c.trainings?.pic || 'Not set';
      if (!pics[pic]) pics[pic] = { name: pic, batchIds: new Set(), certs: [] };
      pics[pic].certs.push(c);
      pics[pic].batchIds.add(c.training_id);
    });

    const picMetrics: PicMetric[] = Object.values(pics).map(p => {
      const total = p.certs.length;
      const compliant = p.certs.filter(c => c.sla_age_days <= slaThreshold).length;
      const overdue = p.certs.filter(c => c.status !== 'Completed' && c.sla_age_days > slaThreshold).length;
      const complianceRate = total > 0 ? Math.round((compliant / total) * 100) : 100;
      const overdueRate = total > 0 ? Math.round((overdue / total) * 100) : 0;
      const avgAge = total > 0 ? Math.round((p.certs.reduce((a, c) => a + (c.sla_age_days || 0), 0) / total) * 10) / 10 : 0;
      return {
        name: p.name,
        batches: p.batchIds.size,
        avgAge,
        overdueRate,
        complianceRate,
        complianceClass: complianceRate >= 90 ? 'cms-badge-success' : 'cms-badge-warning',
        overdueClass: overdueRate > 10 ? 'text-amber-700' : 'text-slate-700',
      };
    });

    // 2. Certificates completed per month (rolling, independent of the period filter).
    // Completion date = last update of a Completed certificate (created_at as fallback).
    const today = new Date();
    const months = Array.from({ length: CHART_MONTHS }, (_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth() - (CHART_MONTHS - 1 - i), 1);
      return { index: d.getMonth(), year: d.getFullYear(), name: d.toLocaleDateString(locale, { month: 'short' }), count: 0 };
    });
    certificates.forEach(c => {
      if (c.status !== 'Completed') return;
      const stamp = c.updated_at || c.created_at;
      if (!stamp) return;
      const date = new Date(stamp);
      const m = months.find(x => x.index === date.getMonth() && x.year === date.getFullYear());
      if (m) m.count++;
    });
    const monthlyRecords: MonthlyRecord[] = months.map(m => ({ name: m.name, count: m.count }));

    // 3. Overdue certificates by workflow stage
    const overdueList = periodCerts.filter(c => c.status !== 'Completed' && c.sla_age_days > slaThreshold);
    const stageCounts = { Pending: 0, Processing: 0, Printing: 0 };
    overdueList.forEach(c => {
      if (c.status === 'Processing') stageCounts.Processing++;
      else if (c.status === 'Printing') stageCounts.Printing++;
      else stageCounts.Pending++;
    });
    const pct = (n: number) => (overdueList.length ? Math.round((n / overdueList.length) * 100) : 0);
    const overdueByStage = [
      { label: t('Menunggu (belum diproses)'), count: stageCounts.Pending, pct: pct(stageCounts.Pending) },
      { label: t('Proses QC'), count: stageCounts.Processing, pct: pct(stageCounts.Processing) },
      { label: t('Dicetak'), count: stageCounts.Printing, pct: pct(stageCounts.Printing) },
    ];

    return { picMetrics, monthlyRecords, overdueByStage, totalOverdue: overdueList.length };
  }, [certificates, activePeriod, slaThreshold, locale]);

  const changePeriod = (label: string) => {
    setActivePeriod(label);
  };

  return (
    <DashboardLayout pageTitle="Reports & Analytics">
      <div className="space-y-6">
      <PageHeader
        title={t('Laporan SLA')}
        description={t('Metrik dan statistik kinerja SLA operasional.')}
        actions={
          <>
          <DropdownButton
            variant="secondary"
            size="md"
            icon="calendar_today"
            align="right"
            menuWidth="w-48"
            headerTitle={t('Periode')}
            items={PERIODS.map(p => ({
              label: t(p.label),
              icon: p.id === activePeriod ? 'check' : undefined,
              onClick: () => changePeriod(p.id),
            }))}
          >
            {t(PERIODS.find(p => p.id === activePeriod)?.label ?? '6 Bulan Terakhir')}
          </DropdownButton>
          <Button variant="primary" icon="print" onClick={() => window.print()}>{t('Ekspor PDF')}</Button>
          </>
        }
      />

      {loadError && <LoadError message={loadError} onRetry={loadData} />}

      {loading ? (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12" role="status" aria-busy="true">
          <span className="sr-only">{t('Memuat laporan')}</span>
          <div className="cms-card flex flex-col gap-6 lg:col-span-7">
            <div className="space-y-2">
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-3 w-72 max-w-full" />
            </div>
            <ChartSkeleton height="h-64" />
          </div>
          <div className="cms-card flex flex-col gap-6 lg:col-span-5">
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-64 max-w-full" />
            </div>
            <ListRowsSkeleton rows={3} />
          </div>
          <div className="cms-card overflow-hidden !p-0 lg:col-span-12">
            <div className="space-y-2 border-b border-slate-200 px-5 py-4">
              <Skeleton className="h-4 w-52" />
              <Skeleton className="h-3 w-64 max-w-full" />
            </div>
            <table className="cms-table w-full text-left">
              <tbody>
                <TableSkeletonRows columns={['w-28', 'w-20', 'w-16', 'w-12', { w: 'w-20', kind: 'badge' }]} rows={3} />
              </tbody>
            </table>
          </div>
        </div>
      ) : trainings.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16 bg-card border border-dashed border-slate-300 rounded-xl gap-4 w-full">
          <span className="material-symbols-outlined text-5xl text-slate-400" aria-hidden="true">bar_chart</span>
          <div>
            <h2 className="text-base font-semibold text-slate-900">{t('Data laporan belum tersedia')}</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {t('Setelah Anda mengimpor agenda training, mendaftarkan peserta, dan memproses tahap sertifikat, log kepatuhan dan efisiensi SLA akan muncul di sini.')}</p>
          </div>
          <button onClick={() => router.push('/trainings')} className="cms-btn-primary mt-2">
            {t('Ke Daftar Training')}</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Bar Chart Completed Certificates */}
          <div className="lg:col-span-7 cms-card flex flex-col gap-6">
            <div>
              <h2 className="font-semibold text-slate-900 text-sm">{t('Sertifikat selesai per bulan')}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{t('Sertifikat selesai per bulan (6 bulan terakhir).')}</p>
            </div>
            
            {/* Custom SVG Bar Chart */}
            <div className="w-full h-64 p-2 flex flex-col justify-between">
              <div className="flex-grow flex items-end justify-between px-6 pt-4 h-full relative">
                {/* Grid lines */}
                <div className="absolute inset-x-0 bottom-0 h-px bg-slate-200"></div>
                <div className="absolute inset-x-0 bottom-1/4 h-px border-t border-dashed border-slate-200"></div>
                <div className="absolute inset-x-0 bottom-2/4 h-px border-t border-dashed border-slate-200"></div>
                <div className="absolute inset-x-0 bottom-3/4 h-px border-t border-dashed border-slate-200"></div>

                {monthlyRecords.map((m, idx) => {
                  const maxVal = Math.max(...monthlyRecords.map(r => r.count), 1);
                  const isLast = idx === monthlyRecords.length - 1;
                  const val = m.count;
                  
                  // Compute proportional height
                  const ht = val > 0 ? Math.max(20, Math.round((val / maxVal) * 160)) : 6;
                  
                  return (
                    <div key={idx} className="flex flex-col items-center gap-2 z-10 w-[40px]">
                      <span className={`text-xs font-medium tabular-nums ${isLast ? 'text-slate-900' : 'text-slate-500'}`}>
                        {val}
                      </span>
                      <div
                        style={{ height: `${ht}px` }}
                        className={`w-full transition-colors duration-300 rounded-t-md ${
                          val > 0
                            ? isLast
                              ? 'bg-blue-600'
                              : 'bg-slate-300 hover:bg-slate-400'
                            : 'bg-slate-200 cursor-not-allowed'
                        }`}
                      ></div>
                    </div>
                  );
                })}
              </div>
              
              {/* Labels */}
              <div className="flex justify-between px-6 pt-2 text-xs text-slate-500">
                {monthlyRecords.map((m, idx) => (
                  <span key={idx} className="w-[40px] text-center">{m.name}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Delay Reasons progress metrics */}
          <div className="lg:col-span-5 cms-card flex flex-col gap-6 h-full">
            <div>
              <h2 className="font-semibold text-slate-900 text-sm">{t('Keterlambatan per tahap')}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{t('Posisi sertifikat terlambat saat ini ({period}).', { period: t(PERIODS.find(p => p.id === activePeriod)?.label ?? '6 Bulan Terakhir').toLowerCase() })}</p>
            </div>
            <div className="flex flex-col gap-4">
              {totalOverdue === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-10 text-slate-500 gap-2 select-none h-full">
                  <span className="material-symbols-outlined text-3xl text-emerald-600" aria-hidden="true">verified</span>
                  <p className="text-sm font-medium text-slate-900">{t('Tidak ada pelanggaran SLA tercatat')}</p>
                  <p className="text-[11px] text-slate-500">{t('Semua sertifikat masih dalam batas kepatuhan.')}</p>
                </div>
              ) : (
                <>
                  {overdueByStage.map(stage => (
                    <div key={stage.label} className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-xs text-slate-700">
                        <span>{stage.label}</span>
                        <span className="font-medium tabular-nums">{stage.count} ({stage.pct}%)</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600 rounded-full transition-all duration-300" style={{ width: `${stage.pct}%` }}></div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Table: PIC Efficiency Metrics */}
          <div className="lg:col-span-12 cms-card !p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h2 className="font-semibold text-slate-900 text-sm">{t('Efisiensi penyelesaian SLA per PIC')}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{t('Memantau usia respons tiap koordinator.')}</p>
            </div>
            <div className="overflow-x-auto w-full">
              <table className="cms-table w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                    <th className="px-6 py-4">{t('Nama PIC')}</th>
                    <th className="px-6 py-4">{t('Batch Ditugaskan')}</th>
                    <th className="px-6 py-4">{t('Rata-rata Respons (Hari)')}</th>
                    <th className="px-6 py-4">{t('Tingkat Keterlambatan')}</th>
                    <th className="px-6 py-4">{t('Kepatuhan target')}</th>
                  </tr>
                </thead>
                <tbody className="text-[13px] divide-y divide-slate-100 text-slate-700">
                  {picMetrics.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                        {t('Tidak ada sertifikat pada periode ini.')}</td>
                    </tr>
                  ) : (
                    picMetrics.map((pic, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-3 font-medium text-slate-900">{pic.name}</td>
                        <td className="px-6 py-3">{pic.batches} {t('batch')}</td>
                        <td className="px-6 py-3">{pic.avgAge} {t('hari')}</td>
                        <td className={`px-6 py-3 ${pic.overdueClass} font-medium tabular-nums`}>{pic.overdueRate}%</td>
                        <td className="px-6 py-3">
                          <span className={`cms-badge ${pic.complianceClass}`}>{t('{rate}% Patuh', { rate: pic.complianceRate })}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      </div>
    </DashboardLayout>
  );
}
