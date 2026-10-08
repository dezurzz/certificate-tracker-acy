'use client';

import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/Button';
import BarChart, { PairedBarChart } from '@/components/BarChart';
import ExecutiveCertList, { type CertStage } from '@/components/ExecutiveCertList';
import InsightCard, { SeverityBadge, WhyAction } from '@/components/InsightCard';
import ScorecardTile, { type ScoreStatus } from '@/components/ScorecardTile';
import LoadError from '@/components/LoadError';
import { FilterDateRange, FilterSelect } from '@/components/FilterBar';
import { Skeleton, ChartSkeleton } from '@/components/Skeleton';
import { DB, type Lead, type LeadActivity, type Certificate, type CertificateHistory } from '@/lib/db';
import { useLanguage, useT } from '@/i18n/LanguageContext';
import { useSlaDays } from '@/lib/settings';
import { getErrorMessage } from '@/lib/errors';
import { notify } from '@/lib/notify';
import {
  averageBatchSize,
  computeAgingBuckets,
  computeCertFlow,
  computeCertPipeline,
  computeFunnel,
  computeProgramBreakdown,
  computeSla,
  computeSourceBreakdown,
  computeStageDurations,
  computeStaleLeads,
  computeTrend,
  computeWaitingOpportunity,
  delta,
  lastDays,
  medianDaysToRegister,
  previousRange,
  summarizePeriod,
  yearToDate,
  type DateRange,
} from '@/lib/analytics';
import { buildInsights, decisionsNeeded, keyFindings, overallStatus, type Insight, type Severity } from '@/lib/executive/insights';
import { insightCopy, overallCopy, stageName } from '@/lib/executive/insightCopy';
import { DEFAULT_TARGETS, type ExecutiveTargets } from '@/lib/executive/targets';
import { fetchExecutiveTargets } from '@/lib/executive/targetsStore';

type Preset = '30d' | '90d' | '6m' | 'ytd' | 'custom';

const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
const SECTION = 'scroll-mt-32 space-y-5 print:break-before-page first:print:break-before-auto';

const STATUS_STYLE = {
  healthy: { border: 'border-emerald-300', icon: 'check_circle', iconCls: 'text-emerald-600' },
  attention: { border: 'border-amber-300', icon: 'warning', iconCls: 'text-amber-600' },
  action: { border: 'border-red-300', icon: 'error', iconCls: 'text-red-600' },
  insufficient: { border: 'border-slate-300', icon: 'info', iconCls: 'text-slate-400' },
} as const;

/**
 * A detail block: the title IS the conclusion (with its status), then the evidence, then a one-line takeaway.
 * When the finding is one of the top three it is written out in the summary, so the block only points back to it
 * (`refIndex`) instead of repeating it; other findings carry their own why/action here.
 */
function Block({
  title,
  severity,
  evidence,
  refIndex,
  why,
  action,
  children,
  className = '',
}: {
  title: string;
  severity?: Severity;
  evidence?: string;
  refIndex?: number;
  why?: string;
  action?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const t = useT();
  return (
    <section className={`cms-card flex flex-col gap-4 break-inside-avoid ${className}`}>
      <header>
        {severity && <div className="mb-1"><SeverityBadge severity={severity} /></div>}
        <h3 className="text-[15px] font-semibold leading-snug text-slate-900">{title}</h3>
        {evidence && <p className="mt-1 text-xs text-slate-500">{evidence}</p>}
      </header>
      {children && <div className="min-w-0">{children}</div>}
      {refIndex ? (
        <a href={`#temuan-${refIndex}`} className="mt-auto self-start text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline print:hidden">
          {t('Alasan dan tindakan: lihat temuan {n}', { n: refIndex })} ↑
        </a>
      ) : (
        (why || action) && <WhyAction why={why} action={action} className="mt-auto border-t border-slate-100 pt-3" />
      )}
    </section>
  );
}

function SectionHeading({ id, eyebrow, title, question, icon, iconCls }: { id: string; eyebrow: string; title: string; question: string; icon?: string; iconCls?: string }) {
  return (
    <header id={id} className="scroll-mt-32">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-600">{eyebrow}</p>
      <h2 className="mt-0.5 flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-900">
        {icon && <span className={`material-symbols-outlined text-[26px] ${iconCls ?? ''}`} aria-hidden="true">{icon}</span>}
        {title}
      </h2>
      <p className="mt-1 text-sm text-slate-500">{question}</p>
    </header>
  );
}

export default function ExecutivePage() {
  const t = useT();
  const { locale } = useLanguage();
  const slaDays = useSlaDays();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [histories, setHistories] = useState<CertificateHistory[]>([]);
  const [targets, setTargets] = useState<ExecutiveTargets>(DEFAULT_TARGETS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [certStage, setCertStage] = useState<CertStage>('');
  const [preset, setPreset] = useState<Preset>('90d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [l, a, c, h, tg] = await Promise.all([
          DB.getLeads(),
          DB.getLeadActivities(),
          DB.getCertificates(),
          DB.getCertificateHistory(),
          fetchExecutiveTargets(),
        ]);
        setLeads(l);
        setActivities(a);
        setCerts(c);
        setHistories(h);
        setTargets(tg.targets);
        setLoadError(null);
      } catch (e) {
        setLoadError(getErrorMessage(e));
      } finally {
        setLoading(false);
      }
    }
    load();
    const refresh = () => load();
    window.addEventListener('bki-db-update', refresh);
    return () => window.removeEventListener('bki-db-update', refresh);
  }, [reloadKey]);

  // Printing: always on a light page, whatever theme is active on screen
  useEffect(() => {
    const root = document.documentElement;
    let wasDark = false;
    const before = () => {
      wasDark = root.classList.contains('dark');
      root.classList.remove('dark');
    };
    const after = () => {
      if (wasDark) root.classList.add('dark');
    };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);

  // ---- period
  const range: DateRange = useMemo(() => {
    if (preset === 'custom' && customFrom && customTo && customFrom <= customTo) return { from: customFrom, to: customTo };
    if (preset === '30d') return lastDays(30);
    if (preset === '6m') return lastDays(183);
    if (preset === 'ytd') return yearToDate();
    return lastDays(90);
  }, [preset, customFrom, customTo]);
  const prevRange = useMemo(() => previousRange(range), [range]);
  const today = useMemo(() => lastDays(1).to, []);

  const fmtDay = (key: string) => new Date(key + 'T00:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  const fmtMonth = (key: string) => new Date(key + '-01T00:00:00').toLocaleDateString(locale, { month: 'short', year: '2-digit' });

  // ---- analytics (all pure, see lib/analytics.ts)
  const a = useMemo(() => {
    const funnel = computeFunnel(leads, activities, range);
    const cur = summarizePeriod(leads, activities, certs, histories, range);
    const prev = summarizePeriod(leads, activities, certs, histories, prevRange);
    const sources = computeSourceBreakdown(leads, activities, range);
    const programs = computeProgramBreakdown(leads, activities, range);
    const medianDays = medianDaysToRegister(leads, activities, range);
    const stale = computeStaleLeads(leads, activities, today, targets.staleDays);
    const waiting = computeWaitingOpportunity(leads, averageBatchSize(certs));
    const sla = computeSla(certs, slaDays);
    const aging = computeAgingBuckets(certs, slaDays);
    const flow = computeCertFlow(certs, histories, range, today);
    const stages = computeStageDurations(histories);
    const pipeline = computeCertPipeline(certs, today);
    const trend = computeTrend(leads, activities, certs, histories, range);
    const prevFunnel = computeFunnel(leads, activities, prevRange);
    const insights = buildInsights({ targets, slaDays, funnel, cur, prev, prevFunnel, sources, medianDays, stale, waiting, sla, aging, flow, stages, pipeline });
    return { funnel, cur, prev, sources, programs, medianDays, stale, waiting, sla, aging, flow, stages, pipeline, trend, insights };
  }, [leads, activities, certs, histories, range, prevRange, today, targets, slaDays]);

  const { funnel, cur, prev, sources, programs, medianDays, stale, waiting, sla, aging, flow, stages, pipeline, trend, insights } = a;
  const status = overallStatus(insights);
  const findings = keyFindings(insights);
  const decisions = decisionsNeeded(insights);
  const overall = overallCopy(t, status, insights);
  const find = (code: Insight['code']) => insights.find(i => i.code === code);
  const copy = (i: Insight) => insightCopy(t, i);
  /** Props of a detail block for one insight; falls back to a neutral title when the insight did not fire. */
  const blk = (code: Insight['code'], fallbackTitle: string, fallbackWhy?: string) => {
    const ins = find(code);
    if (!ins) return { title: fallbackTitle, why: fallbackWhy };
    const c = copy(ins);
    const idx = findings.findIndex(f => f.code === code);
    return idx >= 0
      ? { title: c.headline, severity: ins.severity, evidence: c.evidence, refIndex: idx + 1 }
      : { title: c.headline, severity: ins.severity, evidence: c.evidence, why: c.why, action: c.action };
  };
  const sev = (code: Insight['code']): ScoreStatus => {
    const s: Severity | undefined = find(code)?.severity;
    return !s || s === 'info' ? 'neutral' : s;
  };
  const isNoData = !loading && !loadError && leads.length === 0 && certs.length === 0;
  const enoughLeads = funnel.total >= targets.minSample;

  const leak = find('funnel_leak');
  const leakTo = leak ? String(leak.params.to) : null;
  const popPct = (n: number, whole: number) => (whole > 0 ? Math.round((n / whole) * 100) : 0);

  const leadsDelta = delta(cur.leadsIn, prev.leadsIn);
  const slowest = [...stages].filter(s => s.n > 0).sort((x, y) => y.avgDays - x.avgDays)[0];
  const maxStageDays = Math.max(0.1, ...stages.map(s => s.avgDays));
  const avgSeats = programs.length ? programs.reduce((s, p) => s + p.seats, 0) / programs.length : 0;

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      [t('Laporan Dashboard Eksekutif')],
      [t('Periode'), `${range.from} – ${range.to}`, t('Pembanding'), `${prevRange.from} – ${prevRange.to}`],
      [t('Status keseluruhan'), overall.title, overall.summary],
      [],
      [t('Temuan utama')],
      ...findings.map(i => [copy(i).headline, copy(i).why, copy(i).action]),
      [],
      [t('Funnel konversi leads')],
      [t('Tahap'), t('Jumlah lead'), t('% dari total'), t('% dari tahap sebelumnya')],
      ...funnel.steps.map(s => [stageName(t, s.stage), s.reached, s.pctOfTotal, s.pctOfPrevious]),
      [t('Batal'), funnel.cancelled, funnel.cancelRate],
      [],
      [t('Sumber lead'), t('Lead'), t('Terdaftar'), t('Konversi (%)')],
      ...sources.map(s => [t(s.source), s.leads, s.registered, s.rate]),
      [],
      [t('Program'), t('Kursi diminati'), t('Lead'), t('Konversi (%)')],
      ...programs.map(p => [p.program, p.seats, p.leads, p.rate]),
      [],
      [t('Alasan batal'), t('Jumlah')],
      ...funnel.cancelReasons.map(r => [r.reason, r.count]),
      [],
      [t('Sertifikasi (kondisi saat ini)')],
      [t('Backlog'), flow.backlog],
      [t('Laju selesai per minggu'), flow.weeklyRate],
      [t('Estimasi hari menghabiskan backlog'), flow.daysToClear ?? '-'],
      [t('Kepatuhan SLA (%)'), sla.compliance],
      [t('Dalam batas SLA'), aging.withinSla],
      [t('1–2× batas SLA'), aging.upTo2x],
      [t('Lebih dari 2× batas SLA'), aging.over2x],
      [],
      [t('Tahap'), t('Rata-rata hari'), t('Pengamatan')],
      ...stages.map(s => [stageName(t, s.stage), s.avgDays, s.n]),
      [],
      [t('Bulan'), t('Lead masuk'), t('Pendaftaran'), t('Sertifikat selesai')],
      ...trend.map(p => [p.month, p.leadsIn, p.registrations, p.certsCompleted]),
    ];
    const csv = rows.map(r => r.map(csvCell).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
    const el = document.createElement('a');
    el.href = url;
    el.download = `bki-executive-${range.from}_${range.to}.csv`;
    el.click();
    URL.revokeObjectURL(url);
    notify.success(t('Laporan diekspor'));
  };

  const st = STATUS_STYLE[status];

  return (
    <DashboardLayout pageTitle="Executive Dashboard">
      <div className="space-y-6">
        <PageHeader
          title={t('Dashboard Eksekutif')}
          description={
            <>
              <span className="block">{t('Apakah bisnis pelatihan tumbuh sehat dan sertifikat terbit tepat waktu?')}</span>
              <span className="mt-1 block text-xs">
                {t('Periode {from} – {to}, dibanding {pfrom} – {pto}', { from: fmtDay(range.from), to: fmtDay(range.to), pfrom: fmtDay(prevRange.from), pto: fmtDay(prevRange.to) })}
              </span>
            </>
          }
          actions={
            <>
              <Button variant="secondary" icon="download" onClick={exportCsv} disabled={loading || isNoData} className="print:hidden">
                {t('Ekspor CSV')}
              </Button>
              <Button variant="primary" icon="print" onClick={() => window.print()} disabled={loading || isNoData} className="print:hidden">
                {t('Cetak / PDF')}
              </Button>
            </>
          }
        />

        {loadError && <LoadError message={loadError} onRetry={() => setReloadKey(k => k + 1)} />}

        {/* One control band: sections on the left, period on the right. Hidden when printing. */}
        <div className="-mx-1 flex flex-col gap-2 bg-slate-50/95 px-1 py-2 backdrop-blur sm:sticky sm:top-16 sm:z-30 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <nav aria-label={t('Bagian laporan')} className="flex gap-2 overflow-x-auto">
            {!loading && !isNoData &&
              [
                ['ringkasan', t('Ringkasan Eksekutif')],
                ['sertifikasi', t('Sertifikasi')],
                ['daftar-sertifikat', t('Daftar sertifikat')],
                ['leads', t('Leads')],
              ].map(([id, label]) => (
                <a key={id} href={`#${id}`} className="whitespace-nowrap rounded-full border border-slate-200 bg-card px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-blue-600 hover:text-blue-700">
                  {label}
                </a>
              ))}
          </nav>
          <div className="flex flex-wrap items-center gap-2">
            {preset === 'custom' && (
              <FilterDateRange
                from={customFrom} to={customTo} onFromChange={setCustomFrom} onToChange={setCustomTo}
                label={t('Tanggal')} fromLabel={t('Dari tanggal')} toLabel={t('Sampai tanggal')}
              />
            )}
            <div className="w-full sm:w-48">
              <FilterSelect value={preset} onChange={v => setPreset(v as Preset)} label={t('Periode')}>
                <option value="30d">{t('30 Hari Terakhir')}</option>
                <option value="90d">{t('90 Hari Terakhir')}</option>
                <option value="6m">{t('6 Bulan Terakhir')}</option>
                <option value="ytd">{t('Tahun Ini')}</option>
                <option value="custom">{t('Rentang kustom')}</option>
              </FilterSelect>
            </div>
          </div>
        </div>

        {isNoData ? (
          <div className="cms-card flex flex-col items-center gap-3 !p-10 text-center">
            <span className="material-symbols-outlined text-4xl text-slate-400" aria-hidden="true">query_stats</span>
            <p className="text-sm font-semibold text-slate-900">{t('Belum ada data untuk dianalisis')}</p>
            <p className="max-w-md text-xs text-slate-500">{t('Dashboard akan terisi setelah ada leads dan sertifikat.')}</p>
          </div>
        ) : loading ? (
          <div className="space-y-4" role="status" aria-busy="true">
            <span className="sr-only">{t('Memuat data...')}</span>
            <Skeleton className="h-24 w-full" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Skeleton className="h-40" /><Skeleton className="h-40" /><Skeleton className="h-40" />
            </div>
            <div className="cms-card"><ChartSkeleton height="h-48" /></div>
          </div>
        ) : (
          <>
            {/* ============ 1. EXECUTIVE SUMMARY: the answer first ============ */}
            <section className={SECTION}>
              <SectionHeading id="ringkasan" eyebrow={t('1 · Ringkasan Eksekutif')} title={overall.title} question={overall.summary} icon={st.icon} iconCls={st.iconCls} />

              <div>
                <h3 className="mb-3 text-base font-semibold text-slate-900">{t('Papan skor terhadap target')}</h3>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                  <ScorecardTile
                    label={t('Kepatuhan SLA sertifikat')}
                    value={sla.total >= targets.minSample ? `${sla.compliance}%` : '–'}
                    target={`≥ ${targets.slaCompliancePct}%`}
                    status={sev('sla_compliance')}
                    note={t('batas SLA {n} hari', { n: slaDays })}
                  />
                  <ScorecardTile
                    label={t('Sertifikat terlambat')}
                    value={sla.overdue}
                    status={aging.over2x > 0 ? 'risk' : sla.overdue > 0 ? 'watch' : sla.total >= targets.minSample ? 'good' : 'neutral'}
                    labels={{ good: t('Tepat waktu'), watch: t('Ada yang terlambat'), risk: t('Ada yang kritis'), neutral: t('Tanpa data') }}
                    note={t('dari {n} yang berjalan', { n: sla.open })}
                  />
                  <ScorecardTile
                    label={t('Estimasi hari menghabiskan backlog')}
                    value={flow.daysToClear === null ? '–' : t('{n} hari', { n: flow.daysToClear })}
                    status={sev('backlog')}
                    labels={{ good: t('Terkendali'), watch: t('Perlu dipantau'), risk: t('Perlu tindakan'), neutral: t('Tanpa data') }}
                    note={t('backlog {n} sertifikat', { n: flow.backlog })}
                  />
                  <ScorecardTile
                    label={t('Konversi lead ke pendaftaran')}
                    value={enoughLeads ? `${funnel.registerRate}%` : '–'}
                    target={`≥ ${targets.conversionPct}%`}
                    status={enoughLeads ? sev('conversion') : 'neutral'}
                    note={enoughLeads ? t('{n} dari {total} lead', { n: funnel.registered, total: funnel.total }) : t('data belum cukup')}
                  />
                  <ScorecardTile
                    label={t('Tingkat batal')}
                    value={enoughLeads ? `${funnel.cancelRate}%` : '–'}
                    target={`≤ ${targets.cancelMaxPct}%`}
                    status={enoughLeads ? sev('cancel_rate') : 'neutral'}
                    note={enoughLeads ? t('{n} lead batal', { n: funnel.cancelled }) : t('data belum cukup')}
                  />
                  <ScorecardTile
                    label={t('Lead masuk')}
                    value={cur.leadsIn}
                    status={sev('demand_trend')}
                    labels={{ good: t('Tumbuh'), watch: t('Menurun'), risk: t('Menurun tajam'), neutral: t('Stabil') }}
                    note={leadsDelta.pct === null ? t('periode lalu: {n}', { n: prev.leadsIn }) : `${leadsDelta.pct > 0 ? '+' : ''}${leadsDelta.pct}% ${t('dibanding periode sebelumnya')}`}
                  />
                </div>
              </div>

              {findings.length > 0 && (
                <div>
                  <h3 className="mb-3 text-base font-semibold text-slate-900">{t('Temuan utama')}</h3>
                  <div className="space-y-4">
                    {findings.map((i, k) => (
                      <InsightCard
                        key={i.code}
                        index={k + 1}
                        severity={i.severity}
                        copy={copy(i)}
                        tag={i.area === 'leads' ? t('Leads') : t('Sertifikasi')}
                        detailHref={i.area === 'leads' ? '#leads' : '#sertifikasi'}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="cms-card break-inside-avoid border-2 border-blue-600 !p-5">
                <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                  <span className="material-symbols-outlined text-[22px] text-blue-600" aria-hidden="true">assignment_turned_in</span>
                  {t('Keputusan yang dibutuhkan')}
                </h3>
                {decisions.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-600">{t('Tidak ada keputusan mendesak pada periode ini.')}</p>
                ) : (
                  <ol className="mt-3 space-y-2.5 text-sm text-slate-800">
                    {decisions.map((i, k) => (
                      <li key={i.code} className="flex gap-3">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[11px] font-semibold text-white" aria-hidden="true">{k + 1}</span>
                        <span>{copy(i).decision ?? copy(i).action}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </section>

            {/* ============ 2. CERTIFICATION ============ */}
            <section className={SECTION}>
              <SectionHeading
                id="sertifikasi"
                eyebrow={t('2 · Sertifikasi')}
                title={t('Sertifikat terbit tepat waktu?')}
                question={t('Pertanyaan yang dijawab: apakah antrean terkendali, apakah SLA terpenuhi, dan tahap mana yang menahan.')}
              />

              {find('low_sample_cert') && <InsightCard severity="info" copy={copy(find('low_sample_cert') as Insight)} />}

              <Block {...blk('pipeline_hold', t('Alur sertifikat: dicetak dan dikirim'), t('Menunjukkan berapa sertifikat yang belum dicetak, sudah dicetak tetapi belum dikirim, dan sudah selesai.'))}>
                {pipeline.total === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-500">{t('Belum ada sertifikat.')}</p>
                ) : (
                  <>
                    <div className="flex h-3 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={t('Proporsi sertifikat per tahap pencetakan')}>
                      <div className="h-full bg-slate-400" style={{ width: `${popPct(pipeline.notPrinted, pipeline.total)}%` }} />
                      <div className="h-full bg-blue-600" style={{ width: `${popPct(pipeline.printed, pipeline.total)}%` }} />
                      <div className="h-full bg-emerald-500" style={{ width: `${popPct(pipeline.completed, pipeline.total)}%` }} />
                    </div>
                    <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {([
                        ['notPrinted', t('Belum dicetak'), pipeline.notPrinted, t('{a} menunggu, {b} proses QC', { a: pipeline.pending, b: pipeline.processing }), 'bg-slate-400'],
                        ['printed', t('Sudah dicetak, belum dikirim'), pipeline.printed, pipeline.oldestPrintedDays > 0 ? t('terlama menunggu {n} hari', { n: pipeline.oldestPrintedDays }) : t('menunggu pengiriman'), 'bg-blue-600'],
                        ['completed', t('Terkirim / selesai'), pipeline.completed, t('{n}% dari seluruh sertifikat', { n: popPct(pipeline.completed, pipeline.total) }), 'bg-emerald-500'],
                      ] as [CertStage, string, number, string, string][]).map(([key, label, count, note, dot]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            setCertStage(key);
                            document.getElementById('daftar-sertifikat')?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className="cursor-pointer rounded-lg border border-slate-200 p-3 text-left transition-colors hover:border-blue-600 print:cursor-default"
                        >
                          <dt className="flex items-center gap-2 text-xs text-slate-500"><span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />{label}</dt>
                          <dd className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{count}</dd>
                          <dd className="text-[11px] text-slate-500">{note}</dd>
                        </button>
                      ))}
                    </dl>
                    <p className="mt-3 text-[11px] text-slate-500 print:hidden">{t('Klik satu kotak untuk melihat daftar sertifikatnya di bawah.')}</p>
                  </>
                )}
              </Block>

              <Block
                {...blk('backlog', t('Aliran sertifikat: masuk dan selesai'), t('Membandingkan yang masuk dengan yang selesai menunjukkan apakah antrean membesar atau menyusut.'))}
              >
                <PairedBarChart
                  ariaLabel={t('Sertifikat masuk dan selesai per bulan')}
                  aLabel={t('Masuk')}
                  bLabel={t('Selesai')}
                  data={flow.monthly.map(m => ({ label: fmtMonth(m.month), a: m.inflow, b: m.outflow }))}
                />
                <dl className="mt-2 grid grid-cols-3 gap-3 text-center">
                  <div>
                    <dt className="text-[11px] text-slate-500">{t('Backlog sekarang')}</dt>
                    <dd className="text-lg font-semibold tabular-nums text-slate-900">{flow.backlog}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-slate-500">{t('Selesai per minggu')}</dt>
                    <dd className="text-lg font-semibold tabular-nums text-slate-900">{flow.weeklyRate}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-slate-500">{t('Hari menghabiskan backlog')}</dt>
                    <dd className="text-lg font-semibold tabular-nums text-slate-900">{flow.daysToClear ?? '–'}</dd>
                  </div>
                </dl>
              </Block>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <Block
                  {...blk('sla_compliance', t('Kepatuhan SLA'), t('Ketepatan waktu penerbitan adalah janji layanan kepada klien.'))}
                >
                  <div className="relative pt-5">
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${sev('sla_compliance') === 'good' ? 'bg-emerald-500' : sev('sla_compliance') === 'watch' ? 'bg-amber-500' : sev('sla_compliance') === 'risk' ? 'bg-red-500' : 'bg-slate-400'}`}
                        style={{ width: `${sla.compliance}%` }}
                      />
                    </div>
                    <span
                      className={`absolute top-0 whitespace-nowrap text-[10px] text-slate-500 ${targets.slaCompliancePct > 80 ? '-translate-x-full pr-1' : '-translate-x-1/2'}`}
                      style={{ left: `${targets.slaCompliancePct}%` }}
                    >
                      {t('Target')} {targets.slaCompliancePct}%
                    </span>
                    <span className="absolute bottom-0 h-5 w-px bg-slate-700" style={{ left: `${targets.slaCompliancePct}%` }} aria-hidden="true" />
                  </div>
                  <p className="mt-2 text-xs text-slate-600">{t('{n}% sertifikat dalam batas SLA ({days} hari).', { n: sla.compliance, days: slaDays })}</p>

                  <h4 className="mb-2 mt-5 text-xs font-semibold text-slate-700">{t('Umur sertifikat yang masih berjalan')}</h4>
                  <ul className="space-y-2.5 text-xs">
                    {([
                      [t('Dalam batas SLA'), aging.withinSla, 'bg-emerald-500'],
                      [t('1–2× batas SLA'), aging.upTo2x, 'bg-amber-500'],
                      [t('Lebih dari 2× batas SLA'), aging.over2x, 'bg-red-500'],
                    ] as [string, number, string][]).map(([label, n, cls]) => (
                      <li key={label}>
                        <div className="mb-1 flex justify-between gap-3 text-slate-700">
                          <span>{label}</span>
                          <span className="tabular-nums font-medium">{n}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-full rounded-full ${cls}`} style={{ width: `${popPct(n, aging.open)}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </Block>

                <div className="flex flex-col gap-5">
                  <Block {...blk('overdue_aging', t('Tidak ada sertifikat yang melewati batas SLA'), t('Semua sertifikat yang berjalan masih dalam batas waktu yang dijanjikan.'))} className="flex-1">
                    <p className="text-xs text-slate-500">{t('Batas SLA {n} hari.', { n: slaDays })}</p>
                  </Block>
                  {find('throughput_trend') && <Block {...blk('throughput_trend', t('Laju penyelesaian sertifikat'))} className="flex-1" />}
                </div>
              </div>

              <Block
                {...blk('bottleneck', t('Waktu rata-rata di setiap tahap'), t('Menunjukkan tahap yang paling memakan waktu, tempat perbaikan memberi dampak terbesar.'))}
              >
                {stages.every(s => s.n === 0) ? (
                  <p className="py-6 text-center text-xs text-slate-500">{t('Riwayat status belum cukup untuk mengukur waktu per tahap.')}</p>
                ) : (
                  <ul className="space-y-3.5">
                    {stages.map(s => {
                      const isSlow = find('bottleneck')?.params.mode === 'duration' && slowest?.stage === s.stage && String(find('bottleneck')?.params.stage) === s.stage;
                      return (
                        <li key={s.stage}>
                          <div className="mb-1 flex justify-between gap-3 text-xs">
                            <span className={`font-medium ${isSlow ? 'text-slate-900' : 'text-slate-700'}`}>{stageName(t, s.stage)}</span>
                            <span className="tabular-nums text-slate-600">
                              {s.n > 0 ? (s.avgDays < 0.1 ? t('kurang dari 0,1 hari') : t('{n} hari', { n: s.avgDays })) : '–'} <span className="text-slate-400">({t('{n} pengamatan', { n: s.n })})</span>
                            </span>
                          </div>
                          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full rounded-full ${isSlow ? 'bg-blue-600' : 'bg-slate-400'}`} style={{ width: `${(s.avgDays / maxStageDays) * 100}%` }} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <p className="mt-4 text-xs text-slate-500">
                  {t('Sedang berjalan sekarang: {a} menunggu, {b} proses QC, {c} cetak.', { a: sla.statusCounts.Pending, b: sla.statusCounts.Processing, c: sla.statusCounts.Printing })}
                </p>
              </Block>

              <section id="daftar-sertifikat" className="scroll-mt-32 space-y-3 print:hidden">
                <header>
                  <h3 className="text-[15px] font-semibold text-slate-900">{t('Daftar sertifikat')}</h3>
                  <p className="mt-1 text-xs text-slate-500">{t('Cari sertifikat dan lihat mana yang sudah dicetak, mana yang belum, dan mana yang sudah dikirim.')}</p>
                </header>
                <ExecutiveCertList certs={certs} slaDays={slaDays} stage={certStage} onStageChange={setCertStage} />
              </section>
            </section>

            {/* ============ 3. LEADS ============ */}
            <section className={SECTION}>
              <SectionHeading
                id="leads"
                eyebrow={t('3 · Leads')}
                title={t('Permintaan terkonversi menjadi pendaftaran?')}
                question={t('Pertanyaan yang dijawab: apakah permintaan tumbuh, di mana lead hilang, dan peluang apa yang belum diambil.')}
              />

              {!enoughLeads && find('low_sample_leads') && <InsightCard severity="info" copy={copy(find('low_sample_leads') as Insight)} />}

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <Block
                  {...blk('demand_trend', t('{n} lead masuk pada periode ini', { n: cur.leadsIn }), t('Volume lead yang masuk membatasi jumlah pendaftaran yang mungkin terjadi.'))}
                >
                  <BarChart ariaLabel={t('Lead masuk per bulan')} data={trend.map(p => ({ label: fmtMonth(p.month), value: p.leadsIn }))} />
                </Block>

                <Block
                  {...blk('source_gap', t('Konversi menurut sumber lead'), t('Menunjukkan sumber mana yang paling efektif menghasilkan pendaftaran, supaya usaha diarahkan ke sana.'))}
                >
                  {sources.length === 0 ? (
                    <p className="py-6 text-center text-xs text-slate-500">{t('Tidak ada lead pada periode ini.')}</p>
                  ) : (
                    <table className="cms-table w-full text-left text-xs">
                      <thead>
                        <tr className="text-slate-500">
                          <th className="pb-2 font-semibold">{t('Sumber')}</th>
                          <th className="pb-2 text-right font-semibold">{t('Lead')}</th>
                          <th className="pb-2 text-right font-semibold">{t('Terdaftar')}</th>
                          <th className="w-2/5 pb-2 pl-3 font-semibold">{t('Konversi')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sources.map(s => {
                          const best = find('source_gap') && s.source === String(find('source_gap')?.params.best);
                          return (
                            <tr key={s.source}>
                              <td className="py-2 font-medium text-slate-800">{t(s.source)}</td>
                              <td className="py-2 text-right tabular-nums">{s.leads}</td>
                              <td className="py-2 text-right tabular-nums">{s.registered}</td>
                              <td className="py-2 pl-3">
                                <div className="flex items-center gap-2">
                                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                                    <div className={`h-full rounded-full ${best ? 'bg-blue-600' : 'bg-slate-400'}`} style={{ width: `${s.rate}%` }} />
                                  </div>
                                  <span className="w-10 text-right tabular-nums text-slate-700">{s.rate}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </Block>
              </div>

              <Block
                {...blk(leak ? 'funnel_leak' : 'conversion', t('Funnel konversi leads'), t('Menunjukkan pada tahap mana lead berhenti, supaya perbaikan difokuskan di sana.'))}
              >
                {funnel.total === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-500">{t('Tidak ada lead pada periode ini.')}</p>
                ) : (
                  <>
                    <ol className="space-y-3.5">
                      {funnel.steps.map((s, k) => {
                        const isLeak = leakTo === s.stage;
                        return (
                          <li key={s.stage}>
                            <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                              <span className={`font-medium ${isLeak ? 'text-red-700' : 'text-slate-800'}`}>{stageName(t, s.stage)}</span>
                              <span className="tabular-nums text-slate-600">
                                <span className="font-semibold text-slate-900">{s.reached}</span> · {s.pctOfTotal}%
                                {k > 0 && <span className={isLeak ? 'font-medium text-red-700' : 'text-slate-500'}> · {t('{n}% dari tahap sebelumnya', { n: s.pctOfPrevious })}</span>}
                              </span>
                            </div>
                            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100" role="presentation">
                              <div className={`h-full rounded-full ${isLeak ? 'bg-red-500' : 'bg-blue-600'}`} style={{ width: `${Math.max(s.reached > 0 ? 2 : 0, s.pctOfTotal)}%` }} />
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                    <p className="mt-4 text-xs text-slate-500">
                      {medianDays.median !== null
                        ? t('Median {days} hari dari lead masuk sampai terdaftar (dari {n} lead).', { days: medianDays.median, n: medianDays.n })
                        : t('Belum ada lead yang terdaftar pada periode ini.')}
                    </p>
                  </>
                )}
              </Block>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <Block
                  {...blk('cancel_rate', t('Alasan lead batal'), t('Alasan batal menunjukkan apa yang bisa diperbaiki agar lead tidak hilang.'))}
                >
                  {funnel.cancelReasons.length === 0 ? (
                    <p className="py-6 text-center text-xs text-slate-500">{t('Belum ada alasan tercatat.')}</p>
                  ) : (
                    <ul className="space-y-3">
                      {funnel.cancelReasons.map((r, idx) => (
                        <li key={r.reason}>
                          <div className="mb-1 flex justify-between gap-3 text-xs">
                            <span className="truncate text-slate-800">{r.reason}</span>
                            <span className="tabular-nums text-slate-600">{r.count} · {popPct(r.count, funnel.cancelled)}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full rounded-full ${idx === 0 ? 'bg-blue-600' : 'bg-slate-400'}`} style={{ width: `${popPct(r.count, funnel.cancelled)}%` }} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Block>

                <div className="flex flex-col gap-5">
                  <Block {...blk('waiting_opportunity', t('Tidak ada kursi yang menunggu jadwal'), t('Waiting list kosong berarti permintaan yang ada sudah terlayani.'))} className="flex-1">
                    <p className="text-xs text-slate-500">{t('{n} lead di waiting list', { n: waiting.leads })}</p>
                  </Block>
                  <Block {...blk('stale_leads', t('Tidak ada lead aktif yang terbengkalai'), t('Lead yang rutin ditindaklanjuti lebih mungkin terdaftar.'))} className="flex-1">
                    <p className="text-xs text-slate-500">{t('{n} lead aktif, {days} hari tanpa aktivitas dianggap diam', { n: stale.open, days: targets.staleDays })}</p>
                  </Block>
                </div>
              </div>

              <Block
                title={t('Program dengan permintaan tertinggi dan konversinya')}
                why={t('Menunjukkan di program mana permintaan besar tetapi belum menjadi pendaftaran.')}
              >
                {programs.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-500">{t('Tidak ada lead pada periode ini.')}</p>
                ) : (
                  <div className="table-scroll overflow-x-auto">
                    <table className="cms-table w-full text-left text-xs">
                      <thead>
                        <tr className="text-slate-500">
                          <th className="pb-2 font-semibold">{t('Program')}</th>
                          <th className="pb-2 text-right font-semibold">{t('Kursi diminati')}</th>
                          <th className="pb-2 text-right font-semibold">{t('Lead')}</th>
                          <th className="pb-2 text-right font-semibold">{t('Konversi')}</th>
                          <th className="pb-2 pl-3 font-semibold">{t('Catatan')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {programs.slice(0, 6).map(p => {
                          const flag = p.leads >= targets.minSample && p.seats >= avgSeats && p.rate < targets.conversionPct;
                          return (
                            <tr key={p.program}>
                              <td className="py-2 font-medium text-slate-800">{p.program}</td>
                              <td className="py-2 text-right tabular-nums">{p.seats}</td>
                              <td className="py-2 text-right tabular-nums">{p.leads}</td>
                              <td className="py-2 text-right tabular-nums">{p.leads >= targets.minSample ? `${p.rate}%` : '–'}</td>
                              <td className="py-2 pl-3 text-amber-700">{flag ? t('Diminati, konversi rendah') : ''}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Block>
            </section>

            <footer className="space-y-1 border-t border-slate-200 pt-4 text-[11px] text-slate-500 print:break-inside-avoid">
              <p className="font-semibold text-slate-600">{t('Catatan dan dasar perhitungan')}</p>
              <p>{t('Leads dianalisis sebagai kohor: lead yang dibuat pada periode terpilih dan sejauh mana mereka maju. Lead terbaru belum sempat berkonversi sehingga konversinya cenderung terlihat rendah.')}</p>
              <p>{t('Bagian sertifikasi menunjukkan kondisi saat ini, kecuali arus masuk/selesai yang mengikuti periode. Waktu per tahap dihitung dari riwayat status. Umur sertifikat dihitung sejak sertifikat dibuat sampai selesai, atau sampai hari ini bila masih berjalan.')}</p>
              <p>
                {t('Target: konversi ≥ {c}%, tingkat batal ≤ {x}%, kepatuhan SLA ≥ {s}%, lead diam > {d} hari, sampel minimum {m}. Admin dapat mengubahnya di Pengaturan > Konfigurasi Sistem.', {
                  c: targets.conversionPct, x: targets.cancelMaxPct, s: targets.slaCompliancePct, d: targets.staleDays, m: targets.minSample,
                })}
              </p>
            </footer>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
