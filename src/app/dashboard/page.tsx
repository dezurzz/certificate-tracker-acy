'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { DB, Training, Certificate, Lead } from '@/lib/db';
import { useAuth } from '@/context/AuthContext';
import Button from '@/components/Button';
import PageHeader from '@/components/PageHeader';
import LoadError from '@/components/LoadError';
import { getErrorMessage } from '@/lib/errors';
import StatCard from '@/components/StatCard';
import Tabs from '@/components/Tabs';
import { useT, useLanguage } from '@/i18n/LanguageContext';
import { formatRelativeTime } from '@/lib/relativeTime';
import { certStatusLabel, certTypeLabel, leadActionLabel } from '@/i18n/labels';
import { useSlaDays } from '@/lib/settings';
import { Skeleton, ChartSkeleton, ListRowsSkeleton } from '@/components/Skeleton';

interface ActivityItem {
  type: string;
  title: string;
  desc: string;
  time: Date;
  dotColor: string;
  badgeHtml: React.ReactNode;
}

export default function DashboardPage() {
  const t = useT();
  const slaThreshold = useSlaDays();
  const { locale } = useLanguage();
  const { user } = useAuth();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activeModuleTab, setActiveModuleTab] = useState<'all' | 'leads' | 'certs'>('all');
  const [greetingKey, setGreetingKey] = useState<'pagi' | 'siang' | 'sore' | 'malam'>('pagi');
  const [todayDate, setTodayDate] = useState('');
  // true only until the first load finishes (later refreshes update in place, no flicker)
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  // KPI Stats
  const [completedTrainings, setCompletedTrainings] = useState(0);
  const [pendingCerts, setPendingCerts] = useState(0);
  const [overdueCerts, setOverdueCerts] = useState(0);
  const [completionRate, setCompletionRate] = useState(100);

  // Pipeline Stats
  const [pipePending, setPipePending] = useState(0);
  const [pipeProcessing, setPipeProcessing] = useState(0);
  const [pipePrinting, setPipePrinting] = useState(0);
  const [pipeShipping, setPipeShipping] = useState(0);
  const [pipeCompleted, setPipeCompleted] = useState(0);
  
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  // New States for Enrichment
  const [monthlyRecords, setMonthlyRecords] = useState<{ name: string; count: number }[]>([]);
  const [activeBatches, setActiveBatches] = useState<(Training & { totalCerts: number; completedCount: number; percentage: number })[]>([]);
  const [overdueList, setOverdueList] = useState<Certificate[]>([]);

  async function loadData() {
    setLoadError(null);
    try {
      const [trainList, certList, leadList, leadActList] = await Promise.all([
        DB.getTrainings(),
        DB.getCertificates(),
        DB.getLeads(),
        DB.getLeadActivities()
      ]);
      
      setCertificates(certList);
      setLeads(leadList);

      // Calculate KPIs
      const compTrain = trainList.filter(t => t.status === 'Completed').length;
      const pendCert = certList.filter(c => c.status === 'Pending').length;
      const overCert = certList.filter(c => c.status !== 'Completed' && c.sla_age_days > slaThreshold).length;
      const totalCert = certList.length;
      const compCert = certList.filter(c => c.status === 'Completed').length;
      const rate = totalCert > 0 ? Math.round((compCert / totalCert) * 100) : 100;

      setCompletedTrainings(compTrain);
      setPendingCerts(pendCert);
      setOverdueCerts(overCert);
      setCompletionRate(rate);

      // Calculate Pipeline stages
      const pPend = certList.filter(c => c.status === 'Pending').length;
      const pProc = certList.filter(c => c.status === 'Processing').length;
      const pPrint = certList.filter(c => c.status === 'Printing').length;
      const pShip = certList.filter(c => c.status === 'Shipping').length;
      const pComp = compCert;

      setPipePending(pPend);
      setPipeProcessing(pProc);
      setPipePrinting(pPrint);
      setPipeShipping(pShip);
      setPipeCompleted(pComp);

      // Monthly Completed Certificates (rolling 4 months)
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const last4Months: { index: number; year: number; name: string }[] = [];
      const today = new Date();
      for (let i = 3; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        last4Months.push({
          index: d.getMonth(),
          year: d.getFullYear(),
          name: monthNames[d.getMonth()]
        });
      }
      const monthCounts = [0, 0, 0, 0];
      certList.forEach(c => {
        if (c.status === 'Completed' && c.created_at) {
          const date = new Date(c.created_at);
          const cMonth = date.getMonth();
          const cYear = date.getFullYear();
          for (let idx = 0; idx < 4; idx++) {
            if (cMonth === last4Months[idx].index && cYear === last4Months[idx].year) {
              monthCounts[idx]++;
              break;
            }
          }
        }
      });
      const records = last4Months.map((m, idx) => ({
        name: m.name,
        count: monthCounts[idx]
      }));
      setMonthlyRecords(records);

      // Active trainings progress
      const activeTrainingsList = trainList.filter(t => t.status !== 'Completed').slice(0, 5);
      const getProgressWeight = (status: string) => {
        switch (status) {
          case 'Pending': return 25;
          case 'Processing': return 50;
          case 'Printing': return 75;
          case 'Completed': return 100;
          default: return 0;
        }
      };
      const activeBatchesWithProgress = activeTrainingsList.map(t => {
        const tCerts = certList.filter(c => c.training_id === t.id);
        const totalCerts = tCerts.length;
        const completedCount = tCerts.filter(c => c.status === 'Completed').length;
        const progressSum = tCerts.reduce((sum, c) => sum + getProgressWeight(c.status), 0);
        const percentage = totalCerts > 0 ? Math.round(progressSum / totalCerts) : 0;
        return {
          ...t,
          totalCerts,
          completedCount,
          percentage
        };
      });
      setActiveBatches(activeBatchesWithProgress);

      // Actionable Overdue List
      const overdues = certList
        .filter(c => c.status !== 'Completed' && c.sla_age_days > slaThreshold)
        .sort((a, b) => b.sla_age_days - a.sla_age_days)
        .slice(0, 5);
      setOverdueList(overdues);

      const histories = await DB.getCertificateHistory();

      // Construct Activities
      const acts: ActivityItem[] = [];

      // Trainings creation events
      trainList.forEach(training => {
        acts.push({
          type: 'training',
          title: t('Batch baru dibuat'),
          desc: `${training.program_name} (${training.batch_code})`,
          time: training.created_at ? new Date(training.created_at) : new Date(training.start_date),
          dotColor: 'bg-blue-600',
          badgeHtml: <span className="cms-badge cms-badge-neutral">{t('Dibuat')}</span>
        });
      });

      // Certificate drafts generated events
      certList.forEach(c => {
        const name = c.participants ? c.participants.name : 'Unknown';
        if (c.created_at) {
          acts.push({
            type: 'certificate_created',
            title: t('Sertifikat dibuat'),
            desc: `${name} - ${certTypeLabel(t, c.certificate_type)}`,
            time: new Date(c.created_at),
            dotColor: 'bg-slate-300',
            badgeHtml: <span className="cms-badge cms-badge-neutral">{t('Draf')}</span>
          });
        }
      });

      // Certificate status history updates
      histories.forEach(h => {
        const cert = certList.find(c => c.id === h.certificate_id);
        const name = cert?.participants ? cert.participants.name : 'Unknown';
        const certType = cert ? cert.certificate_type : 'Certificate';

        let dotColor = 'bg-blue-500';
        let badgeClass = 'cms-badge-info';
        if (h.new_status === 'Completed') {
          dotColor = 'bg-emerald-500';
          badgeClass = 'cms-badge-success';
        } else if (h.new_status === 'Pending') {
          dotColor = 'bg-slate-300';
          badgeClass = 'cms-badge-neutral';
        }

        acts.push({
          type: 'certificate_updated',
          title: t('Sertifikat {status}', { status: certStatusLabel(t, h.new_status).toLowerCase() }),
          desc: t('{name} ({type}) status diperbarui ke {status} oleh {by}', { name, type: certTypeLabel(t, certType), status: certStatusLabel(t, h.new_status), by: h.changed_by }),
          time: new Date(h.created_at),
          dotColor: dotColor,
          badgeHtml: <span className={`cms-badge ${badgeClass}`}>{certStatusLabel(t, h.new_status)}</span>
        });
      });

      // Lead activities
      leadActList.forEach(la => {
        let dotColor = 'bg-blue-500';
        let badgeClass = 'cms-badge-info';
        if (la.action_type === 'registered') {
          dotColor = 'bg-emerald-500';
          badgeClass = 'cms-badge-success';
        } else if (la.action_type === 'rescheduled') {
          dotColor = 'bg-amber-500';
          badgeClass = 'cms-badge-warning';
        } else if (la.action_type === 'cancelled') {
          dotColor = 'bg-red-500';
          badgeClass = 'cms-badge-danger';
        }

        acts.push({
          type: 'lead_activity',
          title: t('CRM ({actor})', { actor: la.actor }),
          desc: la.note,
          time: new Date(la.created_at),
          dotColor: dotColor,
          badgeHtml: <span className={`cms-badge ${badgeClass}`}>{leadActionLabel(t, la.action_type)}</span>
        });
      });

      // Sort descending by time
      acts.sort((a, b) => b.time.getTime() - a.time.getTime());
      setActivities(acts.slice(0, 5));

    } catch (err) {
      setLoadError(getErrorMessage(err));
      console.error('Failed to load dashboard statistics:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Set greeting based on client time
    const hours = new Date().getHours();
    setGreetingKey(hours >= 18 ? 'malam' : hours >= 15 ? 'sore' : hours >= 12 ? 'siang' : 'pagi');

    // Set today's date formatted
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
    setTodayDate(new Date().toLocaleDateString(locale, options));

    loadData();

    const handleDbUpdate = () => {
      loadData();
    };
    window.addEventListener('bki-db-update', handleDbUpdate);
    return () => {
      window.removeEventListener('bki-db-update', handleDbUpdate);
    };
    // Reload when the SLA threshold changes so overdue counts stay correct
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slaThreshold]);

  const downloadDashboardReport = () => {
    const csvContent = "Metric,Value\n" +
      `Training Completed,${completedTrainings}\n` +
      `Certificate Pending,${pendingCerts}\n` +
      `Overdue,${overdueCerts}\n` +
      `Completion Rate,${completionRate}%\n`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "bki-dashboard-report.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatRelTime = (dateInput: Date) => formatRelativeTime(dateInput, t, locale, { withYear: true });

  const totalCerts = certificates.length;
  const todayIso = new Date().toISOString().split('T')[0];
  const totalActiveLeads = leads.filter(l => l.status !== 'Selesai Training' && l.status !== 'Batal').length;
  const totalEstimatedSeats = leads.reduce((sum, l) => sum + (l.estimated_seats || 1), 0);
  const totalWaitingSeats = leads.filter(l => l.status === 'Waiting List').reduce((sum, l) => sum + (l.estimated_seats || 1), 0);
  const totalOverdueFollowUps = leads.filter(l => l.status !== 'Selesai Training' && l.status !== 'Batal' && l.next_follow_up_date < todayIso).length;
  const totalTodayFollowUps = leads.filter(l => l.status !== 'Selesai Training' && l.status !== 'Batal' && l.next_follow_up_date === todayIso).length;

  const urgentFollowUps = leads
    .filter(l => l.status !== 'Selesai Training' && l.status !== 'Batal' && l.next_follow_up_date <= todayIso)
    .sort((a, b) => a.next_follow_up_date.localeCompare(b.next_follow_up_date))
    .slice(0, 5);

  const demandByProgram = React.useMemo(() => {
    const map: Record<string, number> = {};
    leads.forEach(l => {
      if (l.status !== 'Selesai Training' && l.status !== 'Batal') {
        const prog = l.program_name || 'Program Umum';
        map[prog] = (map[prog] || 0) + (l.estimated_seats || 1);
      }
    });
    return Object.entries(map)
      .map(([name, seats]) => ({ name, seats }))
      .sort((a, b) => b.seats - a.seats)
      .slice(0, 5);
  }, [leads]);

  const filteredActivities = activeModuleTab === 'leads'
    ? activities.filter(a => a.type === 'lead_activity')
    : activeModuleTab === 'certs'
    ? activities.filter(a => a.type !== 'lead_activity')
    : activities;

  return (
    <DashboardLayout pageTitle="BKI Academy Platform Dashboard">
      <div className="space-y-6">
      <PageHeader
        title={`${{ pagi: t('Selamat Pagi'), siang: t('Selamat Siang'), sore: t('Selamat Sore'), malam: t('Selamat Malam') }[greetingKey]}, ${user?.name || 'Admin'}`}
        description={todayDate}
        actions={
          <>
            <Button variant="secondary" icon="download" onClick={downloadDashboardReport}>{t('Ekspor Laporan')}</Button>
            <Link href="/crm/leads" className="cms-btn-secondary !h-10">
              <span className="material-symbols-outlined text-[18px] text-slate-500" aria-hidden="true">person_add</span>
              {t('Input Lead Baru')}</Link>
            <Link href="/trainings?openModal=true" className="cms-btn-primary !h-10">
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
              {t('Batch Baru')}</Link>
          </>
        }
      />

      {loadError && <LoadError message={loadError} onRetry={loadData} />}

      <Tabs
        value={activeModuleTab}
        onChange={setActiveModuleTab}
        items={[
          { id: 'all', label: t('Ringkasan Terpadu'), icon: 'space_dashboard' },
          { id: 'leads', label: t('Pipeline Leads & Waiting List'), icon: 'person_search' },
          { id: 'certs', label: t('Pelacak Sertifikat (SLA)'), icon: 'verified' },
        ]}
      />

      {(activeModuleTab === 'all' || activeModuleTab === 'leads') && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <h2 className="text-sm font-semibold text-slate-900">{t('Pipeline prospek & waiting list')}</h2>
            <Link href="/crm/leads" className="inline-flex items-center gap-1 text-[13px] font-medium text-blue-600 hover:text-blue-700">
              {t('Buka semua leads')} <span className="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_forward</span>
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard href="/crm/leads" loading={loading} label={t('Peluang aktif')} icon="person_search" value={totalActiveLeads} hint={t('Estimasi {totalEstimatedSeats} total kursi', { totalEstimatedSeats })} />
            <StatCard href="/crm/waiting-list" loading={loading} label={t('Waiting list')} icon="hourglass_top" value={totalWaitingSeats} hint={t('pax menunggu jadwal / reschedule')} />
            <StatCard
              href="/crm/follow-ups" loading={loading}
              label={t('Follow-up terlambat')}
              icon="warning"
              value={totalOverdueFollowUps}
              tone={totalOverdueFollowUps > 0 ? 'danger' : 'default'}
              hint={t('{totalTodayFollowUps} tugas jatuh tempo hari ini', { totalTodayFollowUps })}
            />
            <StatCard href="/crm/reports" label={t('Rekap peminat')} icon="bar_chart" value="Ranking" hint={t('Analisis kebutuhan batch baru')} />
          </div>
        </section>
      )}

      {(activeModuleTab === 'all' || activeModuleTab === 'certs') && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <h2 className="text-sm font-semibold text-slate-900">{t('Siklus sertifikat & monitoring SLA')}</h2>
            <Link href="/certificates" className="inline-flex items-center gap-1 text-[13px] font-medium text-blue-600 hover:text-blue-700">
              {t('Buka semua sertifikat')} <span className="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_forward</span>
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard href="/trainings" loading={loading} label={t('Training selesai')} icon="task_alt" value={completedTrainings} hint={t('Total batch yang selesai')} />
            <StatCard href="/certificates?filter=pending" loading={loading} label={t('Sertifikat menunggu')} icon="hourglass_empty" value={pendingCerts} hint={t('Perlu antrean verifikasi')} />
            <StatCard
              href="/certificates?filter=overdue" loading={loading}
              label={t('Terlambat')}
              icon="warning"
              value={overdueCerts}
              tone={overdueCerts > 0 ? 'danger' : 'default'}
              hint={t('Melewati batas SLA standar')}
            />
            <StatCard loading={loading} label={t('Tingkat penyelesaian')} icon="query_stats" value={`${completionRate}%`} hint={t('Terkirim vs total tugas')} />
          </div>
        </section>
      )}

      {/* Main Grid: Pipeline and Output Trend Chart */}
      {(activeModuleTab === 'all' || activeModuleTab === 'certs') && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Certificate Pipeline */}
        <div className="cms-card lg:col-span-2 flex flex-col">
          <div className="flex justify-between items-center mb-5">
            <div>
              <h2 className="font-semibold text-slate-900 text-sm">{t('Alur Proses Sertifikat')}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{t('Pelacak beban kerja real-time di setiap tahap proses.')}</p>
            </div>
                      </div>

          <div className="flex flex-col gap-6 flex-grow justify-between">
            {/* Grid display of pipeline stages */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
              {/* Pending */}
              <div className="p-4 rounded-lg border border-slate-200 flex flex-col justify-between gap-4 min-h-[96px]">
                <div className="flex justify-end items-start">
                  <span aria-hidden="true" className="material-symbols-outlined text-slate-400 text-[18px]">hourglass_empty</span>
                </div>
                <div>
                  {loading ? <Skeleton className="mb-1.5 h-7 w-10" /> : <p className="text-2xl font-semibold text-slate-900 mb-0.5 tabular-nums">{pipePending}</p>}
                  <p className="truncate text-xs text-slate-500">{t('Menunggu')}</p>
                </div>
              </div>

              {/* Processing */}
              <div className="p-4 rounded-lg border border-slate-200 flex flex-col justify-between gap-4 min-h-[96px]">
                <div className="flex justify-end items-start">
                  <span aria-hidden="true" className="material-symbols-outlined text-slate-400 text-[18px]">progress_activity</span>
                </div>
                <div>
                  {loading ? <Skeleton className="mb-1.5 h-7 w-10" /> : <p className="text-2xl font-semibold text-slate-900 mb-0.5 tabular-nums">{pipeProcessing}</p>}
                  <p className="truncate text-xs text-slate-500">{t('Diproses')}</p>
                </div>
              </div>

              {/* Printing */}
              <div className="p-4 rounded-lg border border-slate-200 flex flex-col justify-between gap-4 min-h-[96px]">
                <div className="flex justify-end items-start">
                  <span aria-hidden="true" className="material-symbols-outlined text-slate-400 text-[18px]">print</span>
                </div>
                <div>
                  {loading ? <Skeleton className="mb-1.5 h-7 w-10" /> : <p className="text-2xl font-semibold text-slate-900 mb-0.5 tabular-nums">{pipePrinting}</p>}
                  <p className="truncate text-xs text-slate-500">{t('Dicetak')}</p>
                </div>
              </div>

              {/* Shipping */}
              <div className="p-4 rounded-lg border border-slate-200 flex flex-col justify-between gap-4 min-h-[96px]">
                <div className="flex justify-end items-start">
                  <span aria-hidden="true" className="material-symbols-outlined text-slate-400 text-[18px]">local_shipping</span>
                </div>
                <div>
                  {loading ? <Skeleton className="mb-1.5 h-7 w-10" /> : <p className="text-2xl font-semibold text-slate-900 mb-0.5 tabular-nums">{pipeShipping}</p>}
                  <p className="truncate text-xs text-slate-500">{t('Pengiriman')}</p>
                </div>
              </div>

              {/* Completed */}
              <div className="p-4 rounded-lg border border-slate-200 flex flex-col justify-between gap-4 min-h-[96px]">
                <div className="flex justify-end items-start">
                  <span aria-hidden="true" className="material-symbols-outlined text-emerald-600 text-[18px]">done_all</span>
                </div>
                <div>
                  {loading ? <Skeleton className="mb-1.5 h-7 w-10" /> : <p className="text-2xl font-semibold text-slate-900 mb-0.5 tabular-nums">{pipeCompleted}</p>}
                  <p className="truncate text-xs text-slate-500">{t('Selesai')}</p>
                </div>
              </div>
            </div>

            {/* Progress Bar visualization */}
            <div className="w-full h-2 rounded-full overflow-hidden flex gap-0.5 bg-slate-100">
              {loading ? (
                <Skeleton className="h-full w-full rounded-full" />
              ) : totalCerts > 0 ? (
                <>
                  <div className="bg-slate-300 h-full" style={{ width: `${(pipePending / totalCerts) * 100}%` }} title={t('Menunggu: {pipePending}', { pipePending })}></div>
                  <div className="bg-blue-300 h-full" style={{ width: `${(pipeProcessing / totalCerts) * 100}%` }} title={t('Diproses: {pipeProcessing}', { pipeProcessing })}></div>
                  <div className="bg-blue-500 h-full" style={{ width: `${(pipePrinting / totalCerts) * 100}%` }} title={t('Dicetak: {pipePrinting}', { pipePrinting })}></div>
                  <div className="bg-blue-700 h-full" style={{ width: `${(pipeShipping / totalCerts) * 100}%` }} title={t('Pengiriman: {pipeShipping}', { pipeShipping })}></div>
                  <div className="bg-emerald-500 h-full" style={{ width: `${(pipeCompleted / totalCerts) * 100}%` }} title={t('Selesai: {pipeCompleted}', { pipeCompleted })}></div>
                </>
              ) : (
                <div className="bg-slate-200 h-full w-full" title={t('Tidak ada sertifikat aktif')}></div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Monthly Output Trend Bar Chart */}
        <div className="cms-card flex flex-col gap-4 min-h-[220px]">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <div className="min-w-0">
              <h2 className="font-semibold text-slate-900 text-sm">{t('Tren Output Bulanan')}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{t('Sertifikat selesai per bulan.')}</p>
            </div>
            <span className="shrink-0 whitespace-nowrap text-xs text-slate-500">{t('4 bulan terakhir')}</span>
          </div>
          
          <div className="flex-grow flex items-end justify-between px-6 pt-6 pb-2 h-full relative">
            {/* Grid lines */}
            <div className="absolute inset-x-0 bottom-0 h-px bg-slate-200"></div>
            <div className="absolute inset-x-0 bottom-1/4 h-px border-t border-dashed border-slate-200"></div>
            <div className="absolute inset-x-0 bottom-2/4 h-px border-t border-dashed border-slate-200"></div>
            <div className="absolute inset-x-0 bottom-3/4 h-px border-t border-dashed border-slate-200"></div>

            {loading ? (
              <ChartSkeleton bars={4} height="h-full" label={t('Memuat...')} />
            ) : monthlyRecords.map((m, idx) => {
              const maxVal = Math.max(...monthlyRecords.map(r => r.count), 1);
              const isLast = idx === 3;
              const val = m.count;
              
              // Compute proportional height
              const ht = val > 0 ? Math.max(12, Math.round((val / maxVal) * 90)) : 4;
              
              return (
                <div key={idx} className="flex flex-col items-center gap-1.5 z-10 w-[36px]">
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
                  <span className="text-xs text-slate-500 mt-0.5">{m.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      )}

      {/* Row 2 Grid: Actionable Overdue, Active Batches, and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Row 2 Left & Center (lg:col-span-2): Leads View or Certificate Ops View */}
        {activeModuleTab === 'leads' ? (
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Urgent Follow-ups */}
            <div className="cms-card flex flex-col h-[360px]">
              <div className="flex justify-between items-start gap-3 mb-4">
                <div>
                  <h2 className="font-semibold text-slate-900 text-sm">{t('Antrean Follow-up Mendesak')}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{t('Leads jatuh tempo hari ini atau terlewat.')}</p>
                </div>
                <Link href="/crm/follow-ups" className="shrink-0 text-[13px] font-medium text-blue-600 hover:text-blue-700">
                  {t('Buka Queue')}</Link>
              </div>

              <div className="overflow-y-auto flex-grow table-scroll pr-1">
                {loading ? (
                  <ListRowsSkeleton rows={3} withBar={false} />
                ) : urgentFollowUps.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-12 text-slate-500 gap-2 h-full">
                    <span className="material-symbols-outlined text-3xl text-emerald-600" aria-hidden="true">task_alt</span>
                    <p className="text-sm font-medium text-slate-900">{t('Semua follow-up beres!')}</p>
                    <p className="text-[11px] text-slate-500">{t('Tidak ada lead yang tertunda hari ini.')}</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {urgentFollowUps.map(lead => {
                      const isOverdue = lead.next_follow_up_date < todayIso;
                      const cleanPhone = lead.contact_phone ? lead.contact_phone.replace(/\D/g, '') : '';
                      return (
                        <div key={lead.id} className="p-3 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors flex justify-between items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-medium text-slate-900 truncate">{lead.contact_name}</p>
                            <p className="text-[11px] text-slate-500 truncate">{lead.company_name} • {lead.program_name}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className={`cms-badge ${isOverdue ? 'cms-badge-danger' : 'cms-badge-warning'}`}>
                                {isOverdue ? t('Terlambat') : t('Hari Ini')}
                              </span>
                              <span className="text-[11px] text-slate-500">{t('PIC:')} {lead.pic_staff_name}</span>
                            </div>
                          </div>
                          {cleanPhone && (
                            <Link
                              href={`https://wa.me/${cleanPhone}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="cms-btn-secondary !h-8 !w-8 !p-0 justify-center shrink-0"
                              title={t('Chat WhatsApp')}
                              aria-label={t('Chat WhatsApp {contact_name}', { contact_name: lead.contact_name })}
                            >
                              <span className="material-symbols-outlined text-base">chat</span>
                            </Link>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Demand by Program */}
            <div className="cms-card flex flex-col h-[360px]">
              <div className="flex justify-between items-start gap-3 mb-4">
                <div>
                  <h2 className="font-semibold text-slate-900 text-sm">{t('Peminat per Program Pelatihan')}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{t('Top program dengan akumulasi peminat.')}</p>
                </div>
                <Link href="/crm/waiting-list" className="shrink-0 text-[13px] font-medium text-blue-600 hover:text-blue-700">
                  {t('Waiting List')}</Link>
              </div>

              <div className="overflow-y-auto flex-grow table-scroll pr-1">
                {loading ? (
                  <ListRowsSkeleton rows={4} withBar={true} />
                ) : demandByProgram.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-12 text-slate-500 gap-2 h-full">
                    <span className="material-symbols-outlined text-3xl text-slate-400" aria-hidden="true">query_stats</span>
                    <p className="text-sm font-medium text-slate-900">{t('Belum ada data peminat')}</p>
                    <p className="text-[11px] text-slate-500">{t('Data akan terakumulasi dari leads.')}</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3.5">
                    {demandByProgram.map(item => {
                      const maxDemand = Math.max(...demandByProgram.map(d => d.seats), 1);
                      const pct = Math.min(100, Math.round((item.seats / maxDemand) * 100));
                      return (
                        <div key={item.name} className="flex flex-col gap-1.5">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-medium text-slate-900 truncate pr-2">{item.name}</span>
                            <span className="text-slate-600 tabular-nums shrink-0">{item.seats} {t('kursi')}</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-600 rounded-full transition-all duration-300" style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Active Batches Progress Tracker */}
            <div className="cms-card flex flex-col h-[360px]">
              <div className="flex justify-between items-start gap-3 mb-4">
                <div>
                  <h2 className="font-semibold text-slate-900 text-sm">{t('Progres Batch Aktif')}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{t('Tingkat penyelesaian sertifikat untuk batch training aktif.')}</p>
                </div>
                              </div>
              
              <div className="overflow-y-auto flex-grow table-scroll pr-1">
                {loading ? (
                  <ListRowsSkeleton rows={4} withBar={true} />
                ) : activeBatches.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-12 text-slate-500 gap-2 h-full">
                    <span className="material-symbols-outlined text-3xl text-slate-400">inbox</span>
                    <p className="text-sm font-medium text-slate-900">{t('Tidak ada batch aktif')}</p>
                    <p className="text-[11px] text-slate-500">{t('Semua batch training sudah selesai.')}</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {activeBatches.map((b) => {
                      const isDone = b.percentage === 100;
                      return (
                        <div key={b.id} className="flex flex-col gap-2">
                          <div className="flex justify-between items-center text-left">
                            <div className="min-w-0 flex-grow pr-2">
                              <Link href={`/trainings/${b.id}`} className="text-[13px] font-medium text-slate-900 hover:text-blue-600 truncate block">
                                {b.program_name} ({b.batch_code})
                              </Link>
                              <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                                {t('Metode:')} {b.learning_method} {t('| PIC:')} {b.pic || t('Belum Diatur')}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <span className={`text-xs font-medium tabular-nums ${isDone ? 'text-emerald-700' : 'text-slate-900'}`}>{b.percentage}%</span>
                              <p className="text-[11px] text-slate-500">{b.completedCount}/{b.totalCerts}</p>
                            </div>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${isDone ? 'bg-emerald-500' : 'bg-blue-600'}`}
                              style={{ width: `${b.percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Actionable Overdue List */}
            <div className="cms-card flex flex-col h-[360px]">
              <div className="flex justify-between items-start gap-3 mb-4">
                <div>
                  <h2 className="font-semibold text-slate-900 text-sm">{t('Daftar Keterlambatan yang Perlu Ditindak')}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{t('Sertifikat yang melewati batas SLA standar.')}</p>
                </div>
                              </div>

              <div className="overflow-y-auto flex-grow table-scroll pr-1">
                {loading ? (
                  <ListRowsSkeleton rows={3} withBar={false} />
                ) : overdueList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-12 text-slate-500 gap-2 h-full">
                    <span className="material-symbols-outlined text-3xl text-emerald-600" aria-hidden="true">verified</span>
                    <p className="text-sm font-medium text-slate-900">{t('Semua beres!')}</p>
                    <p className="text-[11px] text-slate-500">{t('Tidak ada sertifikat terlambat dalam antrean.')}</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {overdueList.map((c) => {
                      const name = c.participants?.name || 'Unknown';
                      const program = `${c.trainings?.program_name} ${c.trainings?.batch_code}`;
                      return (
                        <div key={c.id} className="flex justify-between items-center p-3 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors gap-3">
                          <div className="text-left min-w-0 flex-1">
                            <p className="text-[13px] font-medium text-slate-900 truncate">{name}</p>
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">{program}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="cms-badge cms-badge-danger">
                                {t('{days} hari terlambat', { days: c.sla_age_days })}</span>
                              <span className="text-[11px] text-slate-500">{certTypeLabel(t, c.certificate_type)}</span>
                            </div>
                          </div>
                          <div className="shrink-0">
                            <select
                              value={c.status}
                              onChange={async (e) => {
                                const nextStatus = e.target.value;
                                try {
                                  await DB.updateCertificateStatus(c.id, nextStatus);
                                  loadData();
                                } catch (err) {
                                  console.error('Failed to update certificate status:', err);
                                }
                              }}
                              aria-label={t('Ubah status {name}', { name })}
                              className="cms-select-filter !h-8 !text-xs"
                            >
                              <option value="Pending">{t('Menunggu')}</option>
                              <option value="Processing">{t('Diproses')}</option>
                              <option value="Printing">{t('Dicetak')}</option>
                              <option value="Shipping">{t('Pengiriman')}</option>
                              <option value="Completed">{t('Selesai')}</option>
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Row 2 Right Column: Recent Activity */}
        <div className="cms-card flex flex-col h-[360px] !p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center gap-3">
            <h2 className="font-semibold text-slate-900 text-sm">{t('Aktivitas Terbaru')}</h2>
            <Link className="shrink-0 whitespace-nowrap text-[13px] font-medium text-blue-600 hover:text-blue-700" href="/history-logs">{t('Lihat semua')}</Link>
          </div>

          <div className="overflow-y-auto p-5 flex-grow table-scroll">
            {loading ? (
                  <ListRowsSkeleton rows={4} withBar={false} />
                ) : filteredActivities.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-12 text-slate-500 gap-2 h-full">
                <span className="material-symbols-outlined text-3xl text-slate-400" aria-hidden="true">history</span>
                <p className="text-sm font-medium text-slate-900">{t('Belum ada aktivitas terbaru')}</p>
                <p className="text-[11px] text-slate-500">{t('Aktivitas akan dicatat di sini')}</p>
              </div>
            ) : (
              <div className="relative before:absolute before:inset-y-0 before:left-3 before:w-px before:bg-slate-200">
                {filteredActivities.map((act, index) => (
                  <div key={index} className="relative pl-8 mb-5 last:mb-0">
                    <div className={`absolute left-[8px] top-1.5 w-2 h-2 rounded-full ${act.dotColor} ring-4 ring-card`}></div>
                    <p className="text-[13px] text-slate-700">
                      <span className="font-medium text-slate-900">{act.title}</span>: <span>{act.desc}</span>
                    </p>
                    <div className="mt-1.5">{act.badgeHtml}</div>
                    <span className="text-xs text-slate-500 block mt-1.5">
                      {formatRelTime(act.time)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </DashboardLayout>
  );
}
