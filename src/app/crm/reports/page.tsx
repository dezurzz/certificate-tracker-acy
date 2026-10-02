'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { DB, Lead, TrainingProgram } from '@/lib/db';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import { useT } from '@/i18n/LanguageContext';
import { TableSkeletonRows, type SkeletonColumn } from '@/components/Skeleton';

interface ProgramMetric {
  name: string;
  code: string;
  totalLeads: number;
  activeOpportunities: number;
  estimatedSeats: number;
  waitingListSeats: number;
  registeredSeats: number;
  completedSeats: number;
}

const REPORT_SKELETON_COLUMNS: SkeletonColumn[] = [
  'w-56',
  { w: 'w-12', align: 'center' },
  { w: 'w-6', align: 'center' },
  { w: 'w-6', align: 'center' },
  { w: 'w-12', align: 'center' },
  { w: 'w-12', align: 'center' },
  { w: 'w-12', align: 'center' },
  { w: 'w-16', kind: 'badge', align: 'center' },
];

export default function CrmReportsPage() {
  const t = useT();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allLeads, allPrograms] = await Promise.all([
        DB.getLeads(),
        DB.getTrainingPrograms()
      ]);
      setLeads(allLeads);
      setPrograms(allPrograms);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('bki-db-update', handleUpdate);
    return () => window.removeEventListener('bki-db-update', handleUpdate);
  }, []);

  // Compute metrics per training program
  const programMap: Record<string, ProgramMetric> = {};

  programs.forEach(p => {
    programMap[p.name] = {
      name: p.name,
      code: p.code,
      totalLeads: 0,
      activeOpportunities: 0,
      estimatedSeats: 0,
      waitingListSeats: 0,
      registeredSeats: 0,
      completedSeats: 0
    };
  });

  leads.forEach(l => {
    if (!programMap[l.program_name]) {
      programMap[l.program_name] = {
        name: l.program_name,
        code: 'GENERAL',
        totalLeads: 0,
        activeOpportunities: 0,
        estimatedSeats: 0,
        waitingListSeats: 0,
        registeredSeats: 0,
        completedSeats: 0
      };
    }

    const m = programMap[l.program_name];
    m.totalLeads += 1;
    m.estimatedSeats += (l.estimated_seats || 1);

    if (l.status !== 'Selesai Training' && l.status !== 'Batal') {
      m.activeOpportunities += 1;
    }
    if (l.status === 'Waiting List') {
      m.waitingListSeats += (l.estimated_seats || 1);
    }
    if (l.status === 'Terdaftar') {
      m.registeredSeats += (l.confirmed_seats || l.estimated_seats || 1);
    }
    if (l.status === 'Selesai Training') {
      m.completedSeats += (l.confirmed_seats || l.estimated_seats || 1);
    }
  });

  const programMetrics = Object.values(programMap).sort((a, b) => b.estimatedSeats - a.estimatedSeats);

  // Overall totals
  const totalLeads = leads.length;
  const activeLeads = leads.filter(l => l.status !== 'Selesai Training' && l.status !== 'Batal').length;
  const totalEstSeats = leads.reduce((acc, l) => acc + (l.estimated_seats || 1), 0);
  const totalWaitingSeats = leads.filter(l => l.status === 'Waiting List').reduce((acc, l) => acc + (l.estimated_seats || 1), 0);
  const totalRegisteredSeats = leads.filter(l => l.status === 'Terdaftar').reduce((acc, l) => acc + (l.confirmed_seats || l.estimated_seats || 1), 0);

  // Source breakdown
  const sourceCounts: Record<string, number> = {};
  leads.forEach(l => {
    sourceCounts[l.source] = (sourceCounts[l.source] || 0) + 1;
  });

  // PIC workload
  const picCounts: Record<string, { total: number; registered: number }> = {};
  leads.forEach(l => {
    const pic = l.pic_staff_name || 'System';
    if (!picCounts[pic]) picCounts[pic] = { total: 0, registered: 0 };
    picCounts[pic].total += 1;
    if (l.status === 'Terdaftar' || l.status === 'Selesai Training') {
      picCounts[pic].registered += 1;
    }
  });

  return (
    <DashboardLayout pageTitle="Rekap Peminat & Laporan Leads CRM">
      <div className="space-y-6">
        <PageHeader
          title={t('Rekap Minat')}
          description={t('Permintaan kursi pelatihan, antrean waiting list, dan distribusi sumber prospek BKI Academy.')}
        />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <StatCard label={t('Total peluang tercatat')} value={totalLeads} />
          <StatCard label={t('Peluang aktif')} value={activeLeads} />
          <StatCard label={t('Total permintaan kursi')} value={totalEstSeats} hint={t('pax')} />
          <StatCard label={t('Antrean waiting list')} value={totalWaitingSeats} hint={t('pax')} />
          <StatCard label={t('Terkonfirmasi terdaftar')} value={totalRegisteredSeats} hint={t('pax')} tone={totalRegisteredSeats > 0 ? 'success' : 'default'} />
        </div>

        {/* Table: Demand & Interest Breakdown per Training Program */}
        <div className="bg-card border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-card">
            <div>
              <h2 className="font-semibold text-slate-900 text-sm">{t('Peringkat minat pelatihan')}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{t('Urutan program berdasarkan total estimasi kursi dan antrean waiting list.')}</p>
            </div>
          </div>

          <div className="overflow-x-auto table-scroll">
            <table className="cms-table w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                  <th className="py-3 px-4">{t('Program Pelatihan')}</th>
                  <th className="py-3 px-4 text-center">{t('Kode')}</th>
                  <th className="py-3 px-4 text-center">{t('Total Lead')}</th>
                  <th className="py-3 px-4 text-center">{t('Peluang Aktif')}</th>
                  <th className="py-3 px-4 text-center">{t('Total Estimasi Kursi')}</th>
                  <th className="py-3 px-4 text-center">{t('Waiting List (Backlog)')}</th>
                  <th className="py-3 px-4 text-center">{t('Pasti Terdaftar')}</th>
                  <th className="py-3 px-4 text-center">{t('Tingkat Minat')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <TableSkeletonRows label={t('Memuat rekap minat...')} columns={REPORT_SKELETON_COLUMNS} />
                ) : (
                  programMetrics.map(p => {
                    const demandLevel = p.estimatedSeats >= 5 ? 'Tinggi' : p.estimatedSeats >= 2 ? 'Sedang' : 'Rendah';
                    const badgeClass = p.estimatedSeats >= 5 ? 'cms-badge-info' : 'cms-badge-neutral';

                    return (
                      <tr key={p.name} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-medium text-slate-900">{p.name}</td>
                        <td className="py-3 px-4 text-center font-mono text-[11px] text-slate-500">{p.code}</td>
                        <td className="py-3 px-4 text-center text-slate-700">{p.totalLeads}</td>
                        <td className="py-3 px-4 text-center text-slate-700">{p.activeOpportunities}</td>
                        <td className="py-3 px-4 text-center font-semibold text-slate-900">{p.estimatedSeats} {t('pax')}</td>
                        <td className="py-3 px-4 text-center text-slate-700">{p.waitingListSeats} {t('pax')}</td>
                        <td className="py-3 px-4 text-center text-slate-700">{p.registeredSeats} {t('pax')}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`cms-badge ${badgeClass}`}>
                            {demandLevel}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Secondary Widgets: Sources & PIC Performance */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Source Breakdown */}
          <div className="bg-card border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <h2 className="font-semibold text-slate-900 text-sm">{t('Distribusi kanal sumber leads')}</h2>
            <div className="space-y-2 pt-1 text-xs">
              {Object.entries(sourceCounts).map(([src, count]) => {
                const percent = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0;
                return (
                  <div key={src} className="space-y-1">
                    <div className="flex justify-between items-center text-slate-700">
                      <span className="font-medium">{src}</span>
                      <span className="tabular-nums text-slate-600">{t('{count} lead ({percent}%)', { count, percent })}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${percent}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* PIC Staf Distribution */}
          <div className="bg-card border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <h2 className="font-semibold text-slate-900 text-sm">{t('Beban kerja & konversi per PIC')}</h2>
            <div className="pt-1 text-xs">
              {Object.entries(picCounts).map(([picName, data]) => {
                const convRate = data.total > 0 ? Math.round((data.registered / data.total) * 100) : 0;
                return (
                  <div key={picName} className="py-2.5 flex justify-between items-center border-b border-slate-100 last:border-0">
                    <div>
                      <p className="font-medium text-slate-900">{picName}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {t('Menangani:')} <b>{data.total} {t('Peluang')}</b>
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="cms-badge cms-badge-success">
                        {t('{registered} Terdaftar ({rate}%)', { registered: data.registered, rate: convRate })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
