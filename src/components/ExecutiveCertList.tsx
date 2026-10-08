'use client';

import React, { useMemo, useState } from 'react';
import FilterBar, { FilterSearch, FilterSelect } from '@/components/FilterBar';
import SortSelect from '@/components/SortSelect';
import Pagination, { usePagination } from '@/components/Pagination';
import { CertStatusBadge, CertTypeBadge } from '@/components/StatusBadge';
import Button from '@/components/Button';
import { useLanguage, useT } from '@/i18n/LanguageContext';
import { notify } from '@/lib/notify';
import { cmpDateDesc, cmpNumberDesc, cmpText } from '@/lib/sort';
import type { Certificate } from '@/lib/db';

/** Where a certificate is in the physical workflow. */
export type CertStage = '' | 'notPrinted' | 'printed' | 'completed' | 'overdue';
type SortKey = 'newest' | 'age_desc' | 'printed_new' | 'name_asc' | 'training_asc' | 'stage';

const stageOf = (c: Certificate): Exclude<CertStage, '' | 'overdue'> =>
  c.status === 'Completed' ? 'completed' : c.status === 'Printing' ? 'printed' : 'notPrinted';
const STAGE_ORDER = { notPrinted: 0, printed: 1, completed: 2 } as const;
const trainingKey = (c: Certificate) => `${c.trainings?.program_name ?? '-'} · ${c.trainings?.batch_code ?? '-'}`;
const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

/**
 * The certificates behind the dashboard numbers: searchable, filterable by print stage, sortable.
 * Read-only on purpose (executives may open this page but not edit data).
 */
export default function ExecutiveCertList({
  certs,
  slaDays,
  stage,
  onStageChange,
}: {
  certs: Certificate[];
  slaDays: number;
  stage: CertStage;
  onStageChange: (s: CertStage) => void;
}) {
  const t = useT();
  const { locale } = useLanguage();
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [training, setTraining] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('newest');

  const trainingOptions = useMemo(() => [...new Set(certs.map(trainingKey))].sort(cmpText), [certs]);
  const isOverdue = (c: Certificate) => c.status !== 'Completed' && c.sla_age_days > slaDays;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return certs
      .filter(c => {
        if (stage === 'overdue' ? !isOverdue(c) : stage && stageOf(c) !== stage) return false;
        if (type && c.certificate_type !== type) return false;
        if (training && trainingKey(c) !== training) return false;
        if (!q) return true;
        const hay = `${c.participants?.name ?? ''} ${c.participants?.company ?? ''} ${c.certificate_number ?? ''} ${c.participants?.registration_number ?? ''} ${trainingKey(c)}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        switch (sortKey) {
          case 'age_desc': return cmpNumberDesc(a.sla_age_days, b.sla_age_days) || cmpText(a.participants?.name, b.participants?.name);
          case 'printed_new': return cmpDateDesc(a.printed_at, b.printed_at) || cmpText(a.participants?.name, b.participants?.name);
          case 'name_asc': return cmpText(a.participants?.name, b.participants?.name);
          case 'training_asc': return cmpText(trainingKey(a), trainingKey(b)) || cmpText(a.participants?.name, b.participants?.name);
          case 'stage': return STAGE_ORDER[stageOf(a)] - STAGE_ORDER[stageOf(b)] || cmpNumberDesc(a.sla_age_days, b.sla_age_days);
          // newest first: most recently added, then most recently touched
          default: return cmpDateDesc(a.created_at, b.created_at) || cmpDateDesc(a.updated_at, b.updated_at) || cmpText(a.participants?.name, b.participants?.name);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [certs, search, stage, type, training, sortKey, slaDays]);

  const pg = usePagination(rows, `${search}|${stage}|${type}|${training}|${sortKey}`);
  const hasActive = !!(search || stage || type || training);
  const reset = () => { setSearch(''); onStageChange(''); setType(''); setTraining(''); };

  const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : '–');
  const stageLabel = { notPrinted: t('Belum dicetak'), printed: t('Sudah dicetak, belum dikirim'), completed: t('Terkirim / selesai') };

  const exportCsv = () => {
    const head = [t('Peserta'), t('Perusahaan'), t('Nomor sertifikat'), t('Pelatihan'), t('Tipe'), t('Tahap'), t('Dicetak'), t('Dikirim'), t('Umur (hari)')];
    const body = rows.map(c => [
      c.participants?.name ?? '', c.participants?.company ?? '', c.certificate_number ?? '', trainingKey(c),
      c.certificate_type === 'Qualification' ? t('Kualifikasi') : t('Kehadiran'), stageLabel[stageOf(c)],
      stageOf(c) === 'notPrinted' ? '' : fmt(c.printed_at), stageOf(c) === 'completed' ? fmt(c.sent_at) : '', c.sla_age_days,
    ]);
    const csv = [head, ...body].map(r => r.map(csvCell).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
    const el = document.createElement('a');
    el.href = url;
    el.download = 'bki-sertifikat.csv';
    el.click();
    URL.revokeObjectURL(url);
    notify.success(t('Daftar diekspor'));
  };

  return (
    <div className="space-y-3">
      <FilterBar
        summary={t('Menampilkan {n} dari {total} sertifikat', { n: rows.length, total: certs.length })}
        hasActive={hasActive}
        onReset={reset}
        sort={
          <>
            <SortSelect<SortKey>
              value={sortKey}
              onChange={setSortKey}
              options={[
                { value: 'newest', label: t('Terbaru ditambahkan') },
                { value: 'age_desc', label: t('Umur terlama') },
                { value: 'printed_new', label: t('Terbaru dicetak') },
                { value: 'stage', label: t('Tahap (belum dicetak dulu)') },
                { value: 'name_asc', label: t('Nama peserta (A–Z)') },
                { value: 'training_asc', label: t('Pelatihan (A–Z)') },
              ]}
            />
            <Button variant="secondary" size="sm" icon="download" onClick={exportCsv} disabled={rows.length === 0}>{t('Ekspor daftar')}</Button>
          </>
        }
      >
        <FilterSearch value={search} onChange={setSearch} placeholder={t('Cari peserta, perusahaan, nomor sertifikat, atau pelatihan')} />
        <FilterSelect value={stage} onChange={v => onStageChange(v as CertStage)} label={t('Tahap')}>
          <option value="">{t('Semua tahap')}</option>
          <option value="notPrinted">{stageLabel.notPrinted}</option>
          <option value="printed">{stageLabel.printed}</option>
          <option value="completed">{stageLabel.completed}</option>
          <option value="overdue">{t('Terlambat (melewati SLA)')}</option>
        </FilterSelect>
        <FilterSelect value={type} onChange={setType} label={t('Tipe sertifikat')}>
          <option value="">{t('Semua Tipe')}</option>
          <option value="Qualification">{t('Kualifikasi')}</option>
          <option value="Attendance">{t('Kehadiran')}</option>
        </FilterSelect>
        <FilterSelect value={training} onChange={setTraining} label={t('Pelatihan')}>
          <option value="">{t('Semua pelatihan')}</option>
          {trainingOptions.map(o => <option key={o} value={o}>{o}</option>)}
        </FilterSelect>
      </FilterBar>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-card">
        <div className="table-scroll overflow-x-auto">
          <table className="cms-table w-full min-w-[860px] text-left text-[13px]">
            <thead>
              <tr>
                <th className="px-4">{t('Peserta')}</th>
                <th className="px-4">{t('Pelatihan')}</th>
                <th className="px-4">{t('Tipe')}</th>
                <th className="px-4">{t('Tahap')}</th>
                <th className="px-4">{t('Dicetak')}</th>
                <th className="px-4">{t('Dikirim')}</th>
                <th className="px-4 text-right">{t('Umur')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pg.pageItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    <p className="text-sm font-medium text-slate-900">{t('Tidak ada sertifikat yang cocok dengan filter ini.')}</p>
                  </td>
                </tr>
              ) : (
                pg.pageItems.map(c => {
                  const st = stageOf(c);
                  const late = isOverdue(c);
                  return (
                    <tr key={c.id} className="align-top hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{c.participants?.name ?? '–'}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{c.participants?.company || c.certificate_number || ''}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-800">{c.trainings?.program_name ?? '–'}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{c.trainings?.batch_code ?? ''}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3"><CertTypeBadge type={c.certificate_type} /></td>
                      <td className="whitespace-nowrap px-4 py-3"><CertStatusBadge status={c.status} /></td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-700">{st === 'notPrinted' ? <span className="text-slate-400">{t('Belum')}</span> : fmt(c.printed_at)}</td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-700">{st === 'completed' ? fmt(c.sent_at) : <span className="text-slate-400">{t('Belum')}</span>}</td>
                      <td className={`whitespace-nowrap px-4 py-3 text-right tabular-nums ${late ? 'font-semibold text-red-700' : 'text-slate-700'}`}>
                        {c.sla_age_days} {t('hari')}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={pg.page} pageSize={pg.pageSize} total={pg.total} onPageChange={pg.setPage} onPageSizeChange={pg.setPageSize} />
      </div>
    </div>
  );
}
