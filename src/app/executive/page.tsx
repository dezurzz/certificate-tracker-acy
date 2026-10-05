'use client';

import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import Tabs from '@/components/Tabs';
import Button from '@/components/Button';
import BarChart from '@/components/BarChart';
import LoadError from '@/components/LoadError';
import FilterBar, { FilterDateRange, FilterSelect } from '@/components/FilterBar';
import { Skeleton, ChartSkeleton } from '@/components/Skeleton';
import { DB, type Lead, type LeadActivity, type Certificate, type CertificateHistory } from '@/lib/db';
import { useLanguage, useT } from '@/i18n/LanguageContext';
import { useSlaDays } from '@/lib/settings';
import { getErrorMessage } from '@/lib/errors';
import { notify } from '@/lib/notify';
import {
  computeFunnel,
  computeSla,
  computeTrend,
  delta,
  lastDays,
  previousRange,
  summarizePeriod,
  yearToDate,
  type DateRange,
} from '@/lib/analytics';

type Preset = '30d' | '90d' | '6m' | 'ytd' | 'custom';
type TabId = 'funnel' | 'sla' | 'trend';

const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

export default function ExecutivePage() {
  const t = useT();
  const { locale } = useLanguage();
  const slaDays = useSlaDays();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [histories, setHistories] = useState<CertificateHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [preset, setPreset] = useState<Preset>('90d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [tab, setTab] = useState<TabId>('funnel');

  useEffect(() => {
    async function load() {
      try {
        const [l, a, c, h] = await Promise.all([
          DB.getLeads(),
          DB.getLeadActivities(),
          DB.getCertificates(),
          DB.getCertificateHistory(),
        ]);
        setLeads(l);
        setActivities(a);
        setCerts(c);
        setHistories(h);
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

  // ---- period
  const range: DateRange = useMemo(() => {
    if (preset === 'custom' && customFrom && customTo && customFrom <= customTo) return { from: customFrom, to: customTo };
    if (preset === '30d') return lastDays(30);
    if (preset === '6m') return lastDays(183);
    if (preset === 'ytd') return yearToDate();
    return lastDays(90);
  }, [preset, customFrom, customTo]);
  const prevRange = useMemo(() => previousRange(range), [range]);

  const fmtDay = (key: string) =>
    new Date(key + 'T00:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  const fmtMonth = (key: string) =>
    new Date(key + '-01T00:00:00').toLocaleDateString(locale, { month: 'short', year: '2-digit' });

  // ---- analytics
  const funnel = useMemo(() => computeFunnel(leads, activities, range), [leads, activities, range]);
  const cur = useMemo(() => summarizePeriod(leads, activities, certs, histories, range), [leads, activities, certs, histories, range]);
  const prev = useMemo(() => summarizePeriod(leads, activities, certs, histories, prevRange), [leads, activities, certs, histories, prevRange]);
  const sla = useMemo(() => computeSla(certs, slaDays), [certs, slaDays]);
  const trend = useMemo(() => computeTrend(leads, activities, certs, histories, range), [leads, activities, certs, histories, range]);

  const stageLabel: Record<string, string> = {
    Baru: t('Lead baru'),
    'Jadwal Ditawarkan': t('Jadwal ditawarkan'),
    'Link Terkirim': t('Link terkirim'),
    Terdaftar: t('Terdaftar'),
    'Selesai Training': t('Selesai training'),
  };

  /** "▲ 12% vs periode lalu" (or points for rates). Green/red only when the direction is good/bad. */
  const deltaHint = (current: number, previous: number, opts: { goodWhenUp: boolean; points?: boolean }) => {
    const d = delta(current, previous);
    if (d.diff === 0) return <span>{t('Sama dengan periode sebelumnya')}</span>;
    const up = d.diff > 0;
    const good = up === opts.goodWhenUp;
    const amount = opts.points
      ? t('{n} poin', { n: Math.abs(Math.round(d.diff * 10) / 10) })
      : d.pct === null
        ? t('baru ({n} sebelumnya)', { n: previous })
        : `${Math.abs(d.pct)}%`;
    return (
      <span>
        <span className={good ? 'font-medium text-emerald-700' : 'font-medium text-red-700'}>
          {up ? '▲' : '▼'} {amount}
        </span>{' '}
        <span>{t('dibanding periode sebelumnya')}</span>
      </span>
    );
  };

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      [t('Laporan Dashboard Eksekutif')],
      [t('Periode'), `${range.from} – ${range.to}`],
      [],
      [t('Funnel konversi leads')],
      [t('Tahap'), t('Jumlah lead'), t('% dari total'), t('% dari tahap sebelumnya')],
      ...funnel.steps.map(s => [stageLabel[s.stage], s.reached, s.pctOfTotal, s.pctOfPrevious]),
      [t('Batal'), funnel.cancelled, funnel.cancelRate],
      [t('Waiting List'), funnel.waiting],
      [],
      [t('Performa SLA per PIC (kondisi saat ini)')],
      [t('PIC'), t('Sertifikat'), t('Selesai'), t('Terlambat'), t('Rata-rata umur (hari)'), t('Kepatuhan SLA (%)')],
      ...sla.byPic.map(p => [p.name, p.total, p.completed, p.overdue, p.avgAge, p.compliance]),
      [],
      [t('Tren bulanan')],
      [t('Bulan'), t('Lead masuk'), t('Pendaftaran'), t('Sertifikat selesai')],
      ...trend.map(p => [p.month, p.leadsIn, p.registrations, p.certsCompleted]),
    ];
    const csv = rows.map(r => r.map(csvCell).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `bki-executive-${range.from}_${range.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notify.success(t('Laporan diekspor'));
  };

  const noData = !loading && !loadError && leads.length === 0 && certs.length === 0;
  const stageBarWidth = (reached: number) => (funnel.total > 0 ? Math.max(reached > 0 ? 2 : 0, (reached / funnel.total) * 100) : 0);

  return (
    <DashboardLayout pageTitle="Executive Dashboard">
      <div className="space-y-6">
        <PageHeader
          title={t('Dashboard Eksekutif')}
          description={t('Ringkasan performa untuk menganalisis data: konversi leads, SLA sertifikat, dan tren.')}
          actions={
            <Button variant="secondary" icon="download" onClick={exportCsv} disabled={loading || noData}>
              {t('Ekspor CSV')}
            </Button>
          }
        />

        {loadError && <LoadError message={loadError} onRetry={() => setReloadKey(k => k + 1)} />}

        <FilterBar
          summary={t('Periode {from} – {to}, dibanding {pfrom} – {pto}', {
            from: fmtDay(range.from),
            to: fmtDay(range.to),
            pfrom: fmtDay(prevRange.from),
            pto: fmtDay(prevRange.to),
          })}
        >
          <FilterSelect value={preset} onChange={v => setPreset(v as Preset)} label={t('Periode')}>
            <option value="30d">{t('30 Hari Terakhir')}</option>
            <option value="90d">{t('90 Hari Terakhir')}</option>
            <option value="6m">{t('6 Bulan Terakhir')}</option>
            <option value="ytd">{t('Tahun Ini')}</option>
            <option value="custom">{t('Rentang kustom')}</option>
          </FilterSelect>
          {preset === 'custom' && (
            <FilterDateRange
              from={customFrom}
              to={customTo}
              onFromChange={setCustomFrom}
              onToChange={setCustomTo}
              label={t('Tanggal')}
              fromLabel={t('Dari tanggal')}
              toLabel={t('Sampai tanggal')}
            />
          )}
        </FilterBar>

        {noData ? (
          <div className="cms-card flex flex-col items-center gap-3 !p-10 text-center">
            <span className="material-symbols-outlined text-4xl text-slate-400" aria-hidden="true">query_stats</span>
            <p className="text-sm font-semibold text-slate-900">{t('Belum ada data untuk dianalisis')}</p>
            <p className="max-w-md text-xs text-slate-500">{t('Dashboard akan terisi setelah ada leads dan sertifikat.')}</p>
          </div>
        ) : (
          <>
            {/* KPI row: current period vs the previous period of the same length */}
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
              <StatCard
                loading={loading}
                label={t('Lead masuk')}
                value={cur.leadsIn}
                hint={deltaHint(cur.leadsIn, prev.leadsIn, { goodWhenUp: true })}
                icon="groups"
              />
              <StatCard
                loading={loading}
                label={t('Konversi ke pendaftaran')}
                value={`${cur.registerRate}%`}
                hint={deltaHint(cur.registerRate, prev.registerRate, { goodWhenUp: true, points: true })}
                icon="how_to_reg"
              />
              <StatCard
                loading={loading}
                label={t('Tingkat batal')}
                value={`${cur.cancelRate}%`}
                hint={deltaHint(cur.cancelRate, prev.cancelRate, { goodWhenUp: false, points: true })}
                icon="cancel"
              />
              <StatCard
                loading={loading}
                label={t('Kursi terkonfirmasi')}
                value={cur.confirmedSeats}
                hint={deltaHint(cur.confirmedSeats, prev.confirmedSeats, { goodWhenUp: true })}
                icon="school"
              />
              <StatCard
                loading={loading}
                label={t('Sertifikat selesai')}
                value={cur.certsCompleted}
                hint={deltaHint(cur.certsCompleted, prev.certsCompleted, { goodWhenUp: true })}
                icon="verified"
                className="col-span-2 xl:col-span-1"
              />
            </div>

            <Tabs
              value={tab}
              onChange={setTab}
              items={[
                { id: 'funnel', label: t('Funnel Leads'), icon: 'filter_alt' },
                { id: 'sla', label: t('SLA & Sertifikat'), icon: 'assessment' },
                { id: 'trend', label: t('Tren'), icon: 'trending_up' },
              ]}
            />

            {loading ? (
              <div className="cms-card" role="status" aria-busy="true">
                <span className="sr-only">{t('Memuat data...')}</span>
                <Skeleton className="mb-4 h-4 w-48" />
                <ChartSkeleton height="h-56" />
              </div>
            ) : tab === 'funnel' ? (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <section className="cms-card lg:col-span-7">
                  <h2 className="text-sm font-semibold text-slate-900">{t('Funnel konversi leads')}</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {t('Lead yang dibuat pada periode ini dan sejauh mana mereka maju. Lead baru belum sempat berkonversi.')}
                  </p>
                  {funnel.total === 0 ? (
                    <p className="py-10 text-center text-xs text-slate-500">{t('Tidak ada lead pada periode ini.')}</p>
                  ) : (
                    <ol className="mt-5 space-y-4">
                      {funnel.steps.map((s, k) => (
                        <li key={s.stage}>
                          <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                            <span className="font-medium text-slate-800">{stageLabel[s.stage]}</span>
                            <span className="tabular-nums text-slate-600">
                              <span className="font-semibold text-slate-900">{s.reached}</span>
                              {' · '}{s.pctOfTotal}%
                              {k > 0 && <span className="text-slate-500"> · {t('{n}% dari tahap sebelumnya', { n: s.pctOfPrevious })}</span>}
                            </span>
                          </div>
                          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100" role="presentation">
                            <div className="h-full rounded-full bg-blue-600" style={{ width: `${stageBarWidth(s.reached)}%` }} />
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </section>

                <section className="cms-card flex flex-col gap-5 lg:col-span-5">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">{t('Keluar dari funnel')}</h2>
                    <p className="mt-0.5 text-xs text-slate-500">{t('Lead yang batal atau sedang menunggu jadwal.')}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-700">
                      {t('Batal')}: <span className="tabular-nums">{funnel.cancelled}</span> ({funnel.cancelRate}%)
                    </p>
                    {funnel.cancelReasons.length === 0 ? (
                      <p className="mt-1 text-[11px] text-slate-500">{t('Belum ada alasan tercatat.')}</p>
                    ) : (
                      <ul className="mt-1.5 space-y-1 text-[11px] text-slate-600">
                        {funnel.cancelReasons.map(r => (
                          <li key={r.reason} className="flex justify-between gap-3">
                            <span className="truncate">{r.reason}</span>
                            <span className="tabular-nums font-medium">{r.count}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-700">
                      {t('Waiting List')}: <span className="tabular-nums">{funnel.waiting}</span>
                    </p>
                    {funnel.waitingReasons.length === 0 ? (
                      <p className="mt-1 text-[11px] text-slate-500">{t('Belum ada alasan tercatat.')}</p>
                    ) : (
                      <ul className="mt-1.5 space-y-1 text-[11px] text-slate-600">
                        {funnel.waitingReasons.map(r => (
                          <li key={r.reason} className="flex justify-between gap-3">
                            <span className="truncate">{t(r.reason)}</span>
                            <span className="tabular-nums font-medium">{r.count}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="border-t border-slate-100 pt-3 text-xs text-slate-600">
                    {t('Kursi: estimasi {est}, terkonfirmasi {conf}', { est: funnel.estimatedSeats, conf: funnel.confirmedSeats })}
                  </div>
                </section>
              </div>
            ) : tab === 'sla' ? (
              <div className="space-y-6">
                <p className="text-xs text-slate-500">
                  {t('Kondisi sertifikat saat ini (tidak mengikuti filter periode). Batas SLA: {days} hari.', { days: slaDays })}
                </p>
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                  <StatCard label={t('Sertifikat berjalan')} value={sla.open} hint={t('dari {n} sertifikat', { n: sla.total })} icon="hourglass_top" />
                  <StatCard
                    label={t('Terlambat')}
                    value={sla.overdue}
                    hint={t('{n}% dari yang berjalan', { n: sla.overdueRate })}
                    icon="warning"
                    tone={sla.overdue > 0 ? 'danger' : 'default'}
                  />
                  <StatCard
                    label={t('Kepatuhan SLA')}
                    value={`${sla.compliance}%`}
                    hint={t('usia sertifikat dalam batas SLA')}
                    icon="verified"
                    tone={sla.total > 0 && sla.compliance < 90 ? 'warning' : 'default'}
                  />
                  <StatCard label={t('Rata-rata umur (berjalan)')} value={t('{n} hari', { n: sla.avgOpenAge })} icon="schedule" />
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                  <section className="cms-card lg:col-span-7">
                    <h2 className="text-sm font-semibold text-slate-900">{t('Sebaran status sertifikat')}</h2>
                    {sla.total === 0 ? (
                      <p className="py-8 text-center text-xs text-slate-500">{t('Belum ada sertifikat.')}</p>
                    ) : (
                      <>
                        <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={t('Sebaran status sertifikat')}>
                          {([
                            ['Pending', 'bg-slate-400'],
                            ['Processing', 'bg-blue-300'],
                            ['Printing', 'bg-blue-600'],
                            ['Completed', 'bg-emerald-500'],
                          ] as const).map(([key, cls]) => (
                            <div key={key} className={cls} style={{ width: `${(sla.statusCounts[key] / sla.total) * 100}%` }} />
                          ))}
                        </div>
                        <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-4">
                          {([
                            ['Pending', t('Menunggu'), 'bg-slate-400'],
                            ['Processing', t('Proses QC'), 'bg-blue-300'],
                            ['Printing', t('Dicetak'), 'bg-blue-600'],
                            ['Completed', t('Selesai'), 'bg-emerald-500'],
                          ] as const).map(([key, label, cls]) => (
                            <li key={key} className="flex items-center gap-2 text-slate-600">
                              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${cls}`} aria-hidden="true" />
                              <span className="truncate">{label}</span>
                              <span className="ml-auto font-semibold tabular-nums text-slate-900">{sla.statusCounts[key]}</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </section>
                  <section className="cms-card lg:col-span-5">
                    <h2 className="text-sm font-semibold text-slate-900">{t('Keterlambatan per tahap')}</h2>
                    <ul className="mt-4 space-y-3 text-xs">
                      {([
                        ['Pending', t('Menunggu (belum diproses)')],
                        ['Processing', t('Proses QC')],
                        ['Printing', t('Dicetak')],
                      ] as const).map(([key, label]) => (
                        <li key={key} className="flex items-center justify-between gap-3 text-slate-600">
                          <span>{label}</span>
                          <span className={`font-semibold tabular-nums ${sla.overdueByStage[key] > 0 ? 'text-red-700' : 'text-slate-900'}`}>
                            {sla.overdueByStage[key]}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>

                <section className="cms-card overflow-hidden !p-0">
                  <div className="border-b border-slate-200 px-5 py-4">
                    <h2 className="text-sm font-semibold text-slate-900">{t('Performa per PIC')}</h2>
                  </div>
                  <div className="table-scroll overflow-x-auto">
                    <table className="cms-table w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-500">
                          <th className="px-4 py-3">{t('PIC')}</th>
                          <th className="px-4 py-3 text-right">{t('Sertifikat')}</th>
                          <th className="px-4 py-3 text-right">{t('Selesai')}</th>
                          <th className="px-4 py-3 text-right">{t('Terlambat')}</th>
                          <th className="px-4 py-3 text-right">{t('Rata-rata umur (hari)')}</th>
                          <th className="px-4 py-3 text-right">{t('Kepatuhan SLA')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sla.byPic.length === 0 ? (
                          <tr><td colSpan={6} className="p-8 text-center text-slate-500">{t('Belum ada sertifikat.')}</td></tr>
                        ) : (
                          sla.byPic.map(p => (
                            <tr key={p.name} className="hover:bg-slate-50">
                              <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                              <td className="px-4 py-3 text-right tabular-nums">{p.total}</td>
                              <td className="px-4 py-3 text-right tabular-nums">{p.completed}</td>
                              <td className={`px-4 py-3 text-right tabular-nums ${p.overdue > 0 ? 'font-semibold text-red-700' : ''}`}>{p.overdue}</td>
                              <td className="px-4 py-3 text-right tabular-nums">{p.avgAge}</td>
                              <td className="px-4 py-3 text-right">
                                <span className={`cms-badge ${p.compliance >= 90 ? 'cms-badge-success' : 'cms-badge-warning'}`}>{p.compliance}%</span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            ) : (
              <div className="space-y-6">
                <section className="cms-card overflow-hidden !p-0">
                  <div className="border-b border-slate-200 px-5 py-4">
                    <h2 className="text-sm font-semibold text-slate-900">{t('Periode ini dibanding sebelumnya')}</h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {fmtDay(range.from)} – {fmtDay(range.to)} {t('dibanding')} {fmtDay(prevRange.from)} – {fmtDay(prevRange.to)}
                    </p>
                  </div>
                  <div className="table-scroll overflow-x-auto">
                    <table className="cms-table w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-500">
                          <th className="px-4 py-3">{t('Indikator')}</th>
                          <th className="px-4 py-3 text-right">{t('Periode ini')}</th>
                          <th className="px-4 py-3 text-right">{t('Sebelumnya')}</th>
                          <th className="px-4 py-3 text-right">{t('Perubahan')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {([
                          [t('Lead masuk'), cur.leadsIn, prev.leadsIn, false, true],
                          [t('Konversi ke pendaftaran'), cur.registerRate, prev.registerRate, true, true],
                          [t('Tingkat batal'), cur.cancelRate, prev.cancelRate, true, false],
                          [t('Kursi terkonfirmasi'), cur.confirmedSeats, prev.confirmedSeats, false, true],
                          [t('Sertifikat selesai'), cur.certsCompleted, prev.certsCompleted, false, true],
                        ] as [string, number, number, boolean, boolean][]).map(([label, c, p, isRate, goodWhenUp]) => {
                          const d = delta(c, p);
                          const good = d.diff === 0 ? null : d.diff > 0 === goodWhenUp;
                          return (
                            <tr key={label} className="hover:bg-slate-50">
                              <td className="px-4 py-3 font-medium text-slate-900">{label}</td>
                              <td className="px-4 py-3 text-right tabular-nums">{c}{isRate ? '%' : ''}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-slate-500">{p}{isRate ? '%' : ''}</td>
                              <td className={`px-4 py-3 text-right tabular-nums font-medium ${good === null ? 'text-slate-500' : good ? 'text-emerald-700' : 'text-red-700'}`}>
                                {d.diff === 0
                                  ? '–'
                                  : isRate
                                    ? `${d.diff > 0 ? '+' : ''}${Math.round(d.diff * 10) / 10} ${t('poin')}`
                                    : `${d.diff > 0 ? '+' : ''}${d.diff}${d.pct === null ? '' : ` (${d.pct > 0 ? '+' : ''}${d.pct}%)`}`}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                  {([
                    [t('Lead masuk per bulan'), 'leadsIn'],
                    [t('Pendaftaran per bulan'), 'registrations'],
                    [t('Sertifikat selesai per bulan'), 'certsCompleted'],
                  ] as const).map(([title, field]) => (
                    <section key={field} className="cms-card pb-10">
                      <h2 className="mb-2 text-sm font-semibold text-slate-900">{title}</h2>
                      <BarChart
                        ariaLabel={title}
                        data={trend.map(p => ({ label: fmtMonth(p.month), value: p[field] }))}
                      />
                    </section>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
