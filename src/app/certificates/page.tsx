'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { DB, Certificate } from '@/lib/db';
import ConfirmationModal from '@/components/ConfirmationModal';
import ActionMenu from '@/components/ActionMenu';
import Pagination, { usePagination } from '@/components/Pagination';
import Button from '@/components/Button';
import PageHeader from '@/components/PageHeader';
import { CertStatusBadge, CertTypeBadge } from '@/components/StatusBadge';
import { notify } from '@/lib/notify';
import { useT } from '@/i18n/LanguageContext';
import { useSlaDays } from '@/lib/settings';
import { TableSkeletonRows, AppShellSkeleton, type SkeletonColumn } from '@/components/Skeleton';

const CERT_SKELETON_COLUMNS: SkeletonColumn[] = [
  { w: '', kind: 'check' },
  'w-36',
  'w-52',
  'w-24',
  { w: 'w-24', kind: 'badge' },
  'w-14',
  { w: 'w-16', kind: 'avatar' },
  { w: '', kind: 'action' },
];

function CertificatesContent() {
  const t = useT();
  const slaThreshold = useSlaDays();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Data states
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [trainFilter, setTrainFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  
  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    type?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await DB.getCertificates();
      setCertificates(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Sync URL search parameters
  useEffect(() => {
    const filterVal = searchParams.get('filter');
    if (filterVal === 'pending') {
      setStateFilter('Pending');
    } else if (filterVal === 'overdue') {
      // Set to all states except Completed, and handle overdue filter logic
      setStateFilter('Overdue');
    }
  }, [searchParams]);

  // Bulk Actions
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(prev => Array.from(new Set([...prev, ...pageItems.map(c => c.id)])));
    } else {
      const pageIds = new Set(pageItems.map(c => c.id));
      setSelectedIds(prev => prev.filter(id => !pageIds.has(id)));
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(i => i !== id));
    }
  };

  const handleDeleteCert = (id: string) => {
    setConfirmConfig({
      isOpen: true,
      title: t('Hapus Sertifikat'),
      message: t('Yakin ingin menghapus sertifikat ini? Tindakan ini tidak dapat dibatalkan.'),
      confirmLabel: t('Hapus'),
      type: 'danger',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        try {
          await DB.deleteCertificate(id);
          setCertificates(prev => prev.filter(c => c.id !== id));
          setSelectedIds(prev => prev.filter(i => i !== id));
          notify.success(t('Sertifikat dihapus'));
        } catch (err) {
          notify.error(t('Gagal menghapus sertifikat'), err);
        }
      }
    });
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setTrainFilter('');
    setTypeFilter('');
    setStateFilter('');
  };

  // Export report
  const handleExport = () => {
    let csv = "Participant,Training,Type,Status,Age,PIC\n";
    filteredCerts.forEach(c => {
      const pic = c.trainings?.pic || '-';
      csv += `"${c.participants?.name}","${c.trainings?.program_name} ${c.trainings?.batch_code}","${c.certificate_type}","${c.status}",${c.sla_age_days},"${pic}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "bki-certificates-report.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter calculation

  const filteredCerts = certificates.filter(c => {
    const pName = c.participants?.name || '';
    const tName = c.trainings?.program_name || '';
    const tBatch = c.trainings?.batch_code || '';
    const text = `${pName} ${tName} ${tBatch}`.toLowerCase();
    
    const matchesSearch = text.includes(searchTerm.toLowerCase());
    const matchesTrain = !trainFilter || tName === trainFilter;
    const matchesType = !typeFilter || c.certificate_type === typeFilter;
    
    let matchesState = true;
    if (stateFilter === 'Overdue') {
      matchesState = c.status !== 'Completed' && c.sla_age_days > slaThreshold;
    } else if (stateFilter) {
      matchesState = c.status === stateFilter;
    }

    return matchesSearch && matchesTrain && matchesType && matchesState;
  });

  // Full program names for the training filter
  const uniqueTrainings = Array.from(new Set(certificates.map(c => c.trainings?.program_name || '').filter(Boolean))).sort();

  const { page, setPage, pageSize, setPageSize, pageItems } = usePagination(
    filteredCerts,
    [searchTerm, trainFilter, typeFilter, stateFilter].join('|')
  );

  return (
    <DashboardLayout pageTitle="Certificate Monitoring">
      <div className="space-y-6">
      <PageHeader
        title={t('Monitoring Sertifikat')}
        description={t('Pantau siklus dan status seluruh sertifikat yang diterbitkan.')}
        actions={
          <>
            <Button variant="secondary" icon="download" onClick={handleExport}>{t('Ekspor')}</Button>
            <Button variant="primary" icon="add" onClick={() => router.push('/trainings?openModal=true')}>{t('Batch Baru')}</Button>
          </>
        }
      />

      {/* Filters */}
      <div className="bg-card border border-slate-200 rounded-xl p-3 flex gap-3 items-center flex-wrap shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
        {/* Search bar inside table filter section */}
        <div className="relative w-full md:w-60">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="cms-input h-9 !pl-10 !text-[13px]"
            aria-label={t('Cari sertifikat')}
            placeholder={t('Cari sertifikat...')}
            type="text"
          />
        </div>

        <select
          value={trainFilter}
          onChange={(e) => setTrainFilter(e.target.value)}
          className="cms-select-filter min-w-[140px]"
        >
          <option value="">{t('Semua Training')}</option>
          {uniqueTrainings.map(t => t && <option key={t} value={t}>{t}</option>)}
        </select>
        
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="cms-select-filter min-w-[140px]"
        >
          <option value="">{t('Semua Tipe')}</option>
          <option value="Qualification">{t('Kualifikasi')}</option>
          <option value="Attendance">{t('Kehadiran')}</option>
        </select>

        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="cms-select-filter min-w-[140px]"
        >
          <option value="">{t('Semua Status')}</option>
          <option value="Pending">{t('Menunggu')}</option>
          <option value="Processing">{t('Diproses')}</option>
          <option value="Printing">{t('Dicetak')}</option>
          <option value="Completed">{t('Selesai')}</option>
          <option value="Overdue">{t('Terlambat')}</option>
        </select>

        <button onClick={handleClearFilters} className="ml-auto text-[13px] font-medium text-blue-600 hover:text-blue-700">
          {t('Hapus Filter')}</button>
      </div>

      {/* Data Table */}
      <div className="bg-card border border-slate-200 rounded-xl overflow-hidden shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
          <div className="table-scroll overflow-x-auto w-full">
            <table className="cms-table w-full text-left border-collapse bg-card">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                  <th className="p-4 w-12 text-center">
                    <input
                      checked={pageItems.length > 0 && pageItems.every(c => selectedIds.includes(c.id))}
                      onChange={handleSelectAll}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 border-slate-200 cursor-pointer"
                      type="checkbox"
                    />
                  </th>
                  <th className="p-4">{t('Nama Peserta')}</th>
                  <th className="p-4">{t('Training')}</th>
                  <th className="p-4">{t('Tipe')}</th>
                  <th className="p-4">{t('Status')}</th>
                  <th className="p-4">{t('Usia (Hari)')}</th>
                  <th className="p-4">{t('PIC')}</th>
                  <th className="p-4 text-right">{t('Tindakan')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-card text-[13px]">
                {loading ? (
                  <TableSkeletonRows label={t('Memuat sertifikat')} columns={CERT_SKELETON_COLUMNS} />
                ) : filteredCerts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                      <p className="text-sm font-medium text-slate-900">{t('Sertifikat tidak ditemukan')}</p>
                      <p className="mt-1 text-xs">{t('Ubah filter atau hapus filter untuk melihat semua sertifikat.')}</p>
                    </td>
                  </tr>
                ) : (
                  pageItems.map(c => {
                    const isOverdue = c.sla_age_days > slaThreshold && c.status !== 'Completed';
                    const initials = (c.trainings?.pic || 'AD').substring(0, 2).toUpperCase();

                    return (
                      <tr key={c.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="p-4 text-center">
                          <input
                            checked={selectedIds.includes(c.id)}
                            onChange={(e) => handleSelectRow(c.id, e.target.checked)}
                            className="row-checkbox rounded border-slate-300 text-blue-600 focus:ring-blue-500 border-slate-200 cursor-pointer"
                            type="checkbox"
                          />
                        </td>
                        <td className="p-4 font-medium text-slate-900">{c.participants?.name}</td>
                        <td className="p-4 text-slate-600">{c.trainings?.program_name} {c.trainings?.batch_code}</td>
                        <td className="p-4">
                          <CertTypeBadge type={c.certificate_type} />
                        </td>
                        <td className="p-4">
                          <CertStatusBadge status={c.status} />
                        </td>
                        <td className="p-4">
                          {isOverdue ? (
                            <div className="flex items-center gap-2">
                              <span className="text-red-700 font-semibold tabular-nums">{c.sla_age_days} {t('hari')}</span>
                              <span className="cms-badge cms-badge-danger">{t('Terlambat')}</span>
                            </div>
                          ) : (
                            <span className="text-slate-600 tabular-nums">{c.sla_age_days} {t('hari')}</span>
                          )}
                        </td>
                        <td className="p-4 text-slate-600">
                          <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[11px] font-semibold text-slate-600 shrink-0">
                            {initials}
                          </div>
                          <span>{c.trainings?.pic || '-'}</span>
                          </div>
                        </td>
                        <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <ActionMenu align="right" menuWidth="w-44" items={[
                            { label: t('Lihat Batch'), icon: 'visibility', onClick: () => router.push(`/trainings/${c.training_id}`) },
                            'divider',
                            { label: t('Hapus'), icon: 'delete', variant: 'danger', onClick: () => handleDeleteCert(c.id) },
                          ]} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        {!loading && (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={filteredCerts.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        )}
      </div>
      </div>
      <ConfirmationModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmLabel={confirmConfig.confirmLabel}
        type={confirmConfig.type}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </DashboardLayout>
  );
}

export default function CertificatesPage() {
  return (
    <Suspense fallback={<AppShellSkeleton />}>
      <CertificatesContent />
    </Suspense>
  );
}
