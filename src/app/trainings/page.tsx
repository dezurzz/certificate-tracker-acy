'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { DB, Training, Certificate } from '@/lib/db';
import { normalizeAgendaCSVWithReport, CSVBatch } from '@/lib/csv';
import FileDropzone, { DropOverlay, useWindowFileDrop } from '@/components/FileDropzone';
import { trainingSchema, sanitizeString } from '@/lib/safety';
import ConfirmationModal from '@/components/ConfirmationModal';
import Modal from '@/components/Modal';
import ActionMenu from '@/components/ActionMenu';
import { useCan } from '@/context/AuthContext';
import Button from '@/components/Button';
import Pagination, { usePagination } from '@/components/Pagination';
import PageHeader from '@/components/PageHeader';
import LoadError from '@/components/LoadError';
import { notify } from '@/lib/notify';
import { useT, useLanguage } from '@/i18n/LanguageContext';
import SortSelect from '@/components/SortSelect';
import FilterBar, { FilterSearch, FilterSelect, FilterDate } from '@/components/FilterBar';
import { cmpText, cmpDate, cmpDateDesc } from '@/lib/sort';
import { formatRelativeTime } from '@/lib/relativeTime';
import { TableSkeletonRows, AppShellSkeleton, type SkeletonColumn } from '@/components/Skeleton';
import { getErrorMessage } from '@/lib/errors';

const TRAINING_SKELETON_COLUMNS: SkeletonColumn[] = [
  { w: '', kind: 'check' },
  'w-56',
  'w-24',
  'w-28',
  { w: 'w-6', align: 'right' },
  { w: 'w-32', kind: 'twoLine' },
  { w: 'w-16', kind: 'avatar' },
  { w: '', kind: 'action' },
];

function TrainingsContent() {
  const t = useT();
  const can = useCan();
  const canWrite = can('data.write');
  const { locale } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Data State
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  // Deleting a batch also deletes its certificates, so it needs the right to delete every one of them
  // (admins always; staff only when they created the batch and all of its certificates).
  const canDeleteTraining = (tr: Training) =>
    can('delete.training', { ownerId: tr.created_by }) &&
    certificates.filter(c => c.training_id === tr.id).every(c => can('delete.certificate', { ownerId: c.created_by }));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [spinnerMsg, setSpinnerMsg] = useState('');

  // Filtering States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [picFilter, setPicFilter] = useState('');
  const [locFilter, setLocFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [sortKey, setSortKey] = useState<'created' | 'start_desc' | 'start_asc' | 'name_asc' | 'name_desc' | 'batch_asc' | 'end_asc'>('created');

  // Selection States (Bulk Actions)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Modal States
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingTraining, setEditingTraining] = useState<Training | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [parsedBatches, setParsedBatches] = useState<CSVBatch[]>([]);
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

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formBatch, setFormBatch] = useState('');
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');
  const [formPic, setFormPic] = useState('');

  // Dropdown states per row (action menus)

  // Load Data
  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const trainList = await DB.getTrainings();
      const certList = await DB.getCertificates();
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

    // Check query params to open modal
    if (searchParams.get('openModal') === 'true' && canWrite) {
      openAddModal();
    }
  }, [searchParams, canWrite]);

  // Time ago helper
  const getTimeAgo = (dateStr?: string) => (dateStr ? formatRelativeTime(new Date(dateStr), t, locale, { short: true }) : '');

  // CRUD actions
  const openAddModal = () => {
    setEditingTraining(null);
    setFormName('');
    setFormBatch('');
    setFormStart('');
    setFormEnd('');
    setFormPic('');
    setFormModalOpen(true);
  };

  const openEditModal = (t: Training) => {
    setEditingTraining(t);
    setFormName(t.program_name);
    setFormBatch(t.batch_code);
    setFormStart(t.start_date);
    setFormEnd(t.end_date);
    const picVal = t.pic || '';
    setFormPic(picVal);
    setFormModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Safety sanitization
    const cleanName = sanitizeString(formName);
    const cleanBatch = sanitizeString(formBatch);
    const cleanPic = sanitizeString(formPic);

    // Validate inputs using safety schemas
    const validation = trainingSchema.safeParse({
      program_name: cleanName,
      batch_code: cleanBatch,
      start_date: formStart,
      end_date: formEnd,
      pic: cleanPic,
      status: editingTraining ? editingTraining.status : 'Processing'
    });

    if (!validation.success) {
      notify.warning(t('Periksa kembali isian training'), validation.error.issues.map((err) => err.message).join(', '));
      return;
    }

    setSpinnerMsg(editingTraining ? "Saving changes..." : "Creating training...");
    try {
      if (editingTraining) {
        await DB.updateTraining(editingTraining.id, {
          program_name: cleanName,
          batch_code: cleanBatch,
          start_date: formStart,
          end_date: formEnd,
          location: editingTraining.location,
          status: editingTraining.status,
          pic: cleanPic
        });
        notify.success(t('Batch training diperbarui'));
      } else {
        await DB.insertTraining({
          program_name: cleanName,
          batch_code: cleanBatch,
          start_date: formStart,
          end_date: formEnd,
          location: 'Jakarta Training Center',
          status: 'Processing',
          pic: cleanPic
        });
        notify.success(t('Batch training baru dibuat'));
      }
      setFormModalOpen(false);
      loadData();
    } catch (err) {
      console.error(err);
      notify.error(t('Tindakan gagal'), getErrorMessage(err));
    } finally {
      setSpinnerMsg('');
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmConfig({
      isOpen: true,
      title: t('Hapus Batch Training'),
      message: t('Yakin ingin menghapus batch training ini beserta semua sertifikat terkait? Tindakan ini permanen dan tidak dapat dibatalkan.'),
      confirmLabel: t('Hapus'),
      type: 'danger',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        setSpinnerMsg("Deleting batch...");
        try {
          await DB.deleteTraining(id);
          notify.success(t('Batch training dihapus.'));
          loadData();
        } catch (err) {
          console.error(err);
          notify.error(t('Gagal menghapus batch training'), getErrorMessage(err));
        } finally {
          setSpinnerMsg('');
        }
      }
    });
  };

  const handleBulkDelete = async () => {
    const deletableIds = selectedIds.filter(id => {
      const tr = trainings.find(x => x.id === id);
      return tr ? canDeleteTraining(tr) : false;
    });
    if (deletableIds.length === 0) return;

    setConfirmConfig({
      isOpen: true,
      title: t('Hapus Batch Sekaligus'),
      message: t('Yakin ingin menghapus {length} batch training terpilih beserta semua sertifikat terkait? Tindakan ini permanen dan tidak dapat dibatalkan.', { length: deletableIds.length }),
      confirmLabel: t('Hapus Semua'),
      type: 'danger',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        setSpinnerMsg(t('Menghapus {length} batch...', { length: deletableIds.length }));
        try {
          for (const id of deletableIds) {
            await DB.deleteTraining(id);
          }
          notify.success(t('Batch terpilih dihapus.'));
          setSelectedIds([]);
          loadData();
        } catch (err) {
          console.error(err);
          notify.error(t('Gagal menghapus batch terpilih'), getErrorMessage(err));
        } finally {
          setSpinnerMsg('');
        }
      }
    });
  };

  // CSV Import actions
  const CSV_TYPES = useMemo(() => ['.csv'], []);
  const processCSVFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const { batches, repairedRows } = normalizeAgendaCSVWithReport(text);
      if (batches && batches.length > 0) {
        setParsedBatches(batches);
        if (repairedRows > 0) {
          notify.info(t('{n} baris peserta kehilangan kolom kosong di awal dan sudah disejajarkan otomatis. Periksa hasilnya sebelum disinkronkan.', { n: repairedRows }));
        }
        setImportModalOpen(false);
        setPreviewModalOpen(true);
      } else {
        notify.warning(t('Tidak ada data training yang dapat dibaca. Pastikan header sesuai template CSV BKI.'));
      }
    };
    reader.onerror = () => notify.error(t('File tidak bisa dibaca'), file.name);
    reader.readAsText(file);
  };

  // Drop a CSV anywhere on the page: it goes straight to the review step (not while a review is already open)
  const dragging = useWindowFileDrop({
    onFile: processCSVFile,
    enabled: canWrite && !previewModalOpen,
    onBlocked: () => notify.warning(canWrite ? t('Selesaikan tinjauan yang sedang terbuka lebih dulu') : t('Peran Anda hanya bisa melihat data')),
    extensions: CSV_TYPES,
  });

  const handleSyncCSVToDB = async () => {
    setSpinnerMsg("Syncing to database...");
    try {
      const existingTrainings = await DB.getTrainings();
      
      for (const batch of parsedBatches) {
        // Safe check for duplicates
        let training = existingTrainings.find(t => 
          t.program_name.toLowerCase().trim() === batch.program_name.toLowerCase().trim() && 
          t.batch_code === batch.batch_code
        );

        if (!training) {
          training = await DB.insertTraining({
            program_name: batch.program_name,
            batch_code: batch.batch_code,
            service_type: batch.service_type,
            learning_method: batch.learning_method,
            start_date: batch.start_date,
            end_date: batch.end_date,
            location: batch.location,
            status: 'Completed'
          });
        }

        for (const p of batch.participants) {
          // Upsert participant
          const participant = await DB.upsertParticipant({
            name: p.name,
            company: p.company,
            registration_number: p.registration_number
          });

          // Insert certificates if present in CSV row
          if (p.cert_kehadiran) {
            await DB.insertCertificate({
              training_id: training.id,
              participant_id: participant.id,
              certificate_type: 'Attendance',
              certificate_number: p.cert_kehadiran,
              status: 'Pending',
              evaluation_result: p.evaluasi
            });
          }

          if (p.cert_kualifikasi) {
            await DB.insertCertificate({
              training_id: training.id,
              participant_id: participant.id,
              certificate_type: 'Qualification',
              certificate_number: p.cert_kualifikasi,
              status: 'Pending',
              evaluation_result: p.evaluasi
            });
          }
        }
      }
      
      notify.success(t('Semua batch dinormalisasi dan disinkronkan ke database'));
      setPreviewModalOpen(false);
      loadData();
    } catch (err) {
      console.error(err);
      notify.error(t('Sinkronisasi gagal'), getErrorMessage(err));
    } finally {
      setSpinnerMsg('');
    }
  };

  const downloadCSVTemplate = () => {
    const headers = "No Urut Proyek,Jenis Layanan,Metode Belajar Menghajar,Tanggal Sesuai Jadwal,Pemohon,Obyek/Nama Pelatihan,No Registrasi Peserta,Nama,Perusahaan,No Sertifikat Kehadiran,Hasil Evaluasi,No Sertifikat Kualifikasi\n";
    // Batch columns are filled on the first row only; the other rows keep their (empty) cells so every row has 12 columns.
    // Names that contain a comma (titles) must be wrapped in double quotes.
    const row1 = "1,IN HOUSE TRAINING,OFFLINE,21 - 25 SEPTEMBER,PT CONTOH PELAYARAN,MARINE SURVEYOR,0001,AHMAD SHAFWAN,PT CONTOH PELAYARAN,0001-02-S1-ACY/001/A13-L12/P8/2026,Lulus,0001-02-S2-ACY/001/A13-L12/P8/2026\n";
    const row2 = ",,,,,MARINE SURVEYOR,0002,\"CAPT. BUDI, S.SI.T, M.M.TR\",PT CONTOH PELAYARAN,0002-02-S1-ACY/001/A13-L12/P8/2026,Lulus,0002-02-S2-ACY/001/A13-L12/P8/2026\n";
    const row3 = "2,PUBLIC TRAINING,OFFLINE,02-06 FEBRUARI,PRIBADI,INTERNAL AUDITOR ISM CODE,0003,SITI RAHMA,PRIBADI,0003-01-S1-ACY/002/A01-L12/P8/2026,Lulus,0003-01-S2-ACY/002/A01-L12/P8/2026\n";

    const blob = new Blob([headers + row1 + row2 + row3], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "bki-import-template.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle selection checkboxes
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(prev => Array.from(new Set([...prev, ...pageItems.filter(canDeleteTraining).map(t => t.id)])));
    } else {
      const pageIds = new Set(pageItems.map(t => t.id));
      setSelectedIds(prev => prev.filter(id => !pageIds.has(id)));
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(item => item !== id));
    }
  };

  // Filter options come from the data itself (no hardcoded names)
  const unique = (values: (string | undefined)[]) =>
    Array.from(new Set(values.map(v => (v || '').trim()).filter(Boolean))).sort((x, y) => x.localeCompare(y));
  const picOptions = unique(trainings.map(t => t.pic));
  const locationOptions = unique(trainings.map(t => t.location));
  const statusOptions = unique(trainings.map(t => t.status));
  const serviceOptions = unique(trainings.map(t => t.service_type));
  const methodOptions = unique(trainings.map(t => t.learning_method));

  // Filter computation
  const filteredTrainings = trainings.filter(t => {
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch = !term ||
      t.program_name.toLowerCase().includes(term) ||
      t.batch_code.toLowerCase().includes(term);

    const matchesStatus = !statusFilter || t.status === statusFilter;
    const matchesPic = !picFilter || (t.pic || '') === picFilter;
    const matchesLoc = !locFilter || (t.location || '') === locFilter;

    // Batch is "on" the chosen date when the date falls inside its start-end range
    const matchesDate = !dateFilter || (t.start_date <= dateFilter && dateFilter <= t.end_date);

    const matchesService = !serviceFilter || (t.service_type || '') === serviceFilter;
    const matchesMethod = !methodFilter || (t.learning_method || '') === methodFilter;

    return matchesSearch && matchesStatus && matchesPic && matchesLoc && matchesDate && matchesService && matchesMethod;
  }).sort((a, b) => {
    switch (sortKey) {
      case 'start_desc': return cmpDateDesc(a.start_date, b.start_date);
      case 'start_asc': return cmpDate(a.start_date, b.start_date);
      case 'end_asc': return cmpDate(a.end_date, b.end_date);
      case 'name_asc': return cmpText(a.program_name, b.program_name);
      case 'name_desc': return cmpText(b.program_name, a.program_name);
      case 'batch_asc': return cmpText(a.batch_code, b.batch_code);
      default: return cmpDateDesc(a.created_at, b.created_at);
    }
  });

  const { page, setPage, pageSize, setPageSize, pageItems } = usePagination(
    filteredTrainings,
    [searchTerm, statusFilter, picFilter, locFilter, dateFilter, serviceFilter, methodFilter, sortKey].join('|')
  );

  const hasActiveFilters = Boolean(searchTerm || statusFilter || picFilter || locFilter || dateFilter || serviceFilter || methodFilter);
  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setPicFilter('');
    setLocFilter('');
    setDateFilter('');
    setServiceFilter('');
    setMethodFilter('');
  };

  return (
    <DashboardLayout pageTitle="Training List">
      <div className="space-y-6">
      <PageHeader
        title={t('Batch Training')}
        description={t('Kelola dan pantau semua program training.')}
        actions={
          <>
            <Button variant="secondary" icon="upload_file" onClick={() => setImportModalOpen(true)} disabled={!canWrite} title={canWrite ? undefined : t('Peran Anda hanya bisa melihat data')}>{t('Impor Agenda CSV')}</Button>
            <Button variant="primary" icon="add" onClick={openAddModal} disabled={!canWrite} title={canWrite ? undefined : t('Peran Anda hanya bisa melihat data')}>{t('Tambah Training')}</Button>
          </>
        }
      />

      {loadError && <LoadError message={loadError} onRetry={loadData} />}

      {/* Filters, search and sorting */}
      <FilterBar
        summary={t('Menampilkan {shown} dari {total} batch', { shown: filteredTrainings.length, total: trainings.length })}
        hasActive={hasActiveFilters}
        onReset={clearFilters}
        sort={
          <SortSelect
            value={sortKey}
            onChange={setSortKey}
            options={[
              { value: 'created', label: t('Terbaru ditambahkan') },
              { value: 'start_desc', label: t('Tanggal mulai terbaru') },
              { value: 'start_asc', label: t('Tanggal mulai terlama') },
              { value: 'end_asc', label: t('Tanggal selesai terdekat') },
              { value: 'name_asc', label: t('Nama training A–Z') },
              { value: 'name_desc', label: t('Nama training Z–A') },
              { value: 'batch_asc', label: t('Kode batch A–Z') },
            ]}
          />
        }
      >
        <FilterSearch value={searchTerm} onChange={setSearchTerm} placeholder={t('Cari training...')} label={t('Cari training')} />
        <FilterSelect value={statusFilter} onChange={setStatusFilter} label={t('Filter berdasarkan status')}>
          <option value="">{t('Semua Status Training')}</option>
          {statusOptions.map(v => <option key={v} value={v}>{v}</option>)}
        </FilterSelect>
        <FilterSelect value={picFilter} onChange={setPicFilter} label={t('Filter berdasarkan PIC')}>
          <option value="">{t('Semua PIC')}</option>
          {picOptions.map(v => <option key={v} value={v}>{v}</option>)}
        </FilterSelect>
        <FilterSelect value={locFilter} onChange={setLocFilter} label={t('Filter berdasarkan lokasi')}>
          <option value="">{t('Semua Lokasi')}</option>
          {locationOptions.map(v => <option key={v} value={v}>{v}</option>)}
        </FilterSelect>
        <FilterSelect value={serviceFilter} onChange={setServiceFilter} label={t('Filter berdasarkan jenis layanan')}>
          <option value="">{t('Semua Jenis Layanan')}</option>
          {serviceOptions.map(v => <option key={v} value={v}>{v}</option>)}
        </FilterSelect>
        <FilterSelect value={methodFilter} onChange={setMethodFilter} label={t('Filter berdasarkan metode belajar')}>
          <option value="">{t('Semua Metode')}</option>
          {methodOptions.map(v => <option key={v} value={v}>{v}</option>)}
        </FilterSelect>
        <FilterDate value={dateFilter} onChange={setDateFilter} label={t('Berjalan pada')} />
      </FilterBar>

      {/* Data Table */}
      <div className="bg-card rounded-xl border border-slate-200 shadow-[0_1px_2px_rgb(15_23_42/0.04)] overflow-hidden flex flex-col">
          <div className="table-scroll overflow-x-auto w-full">
            <table className="cms-table w-full text-left border-collapse bg-card">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 w-12 text-center">
                    {pageItems.some(canDeleteTraining) && (
                    <input
                      type="checkbox"
                      aria-label={t('Pilih semua batch yang bisa dihapus')}
                      checked={pageItems.filter(canDeleteTraining).every(t => selectedIds.includes(t.id))}
                      onChange={handleSelectAll}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/15 cursor-pointer"
                    />
                    )}
                  </th>
                  <th className="text-[11px] font-semibold text-slate-500 px-4 py-3 whitespace-nowrap">{t('Nama Training')}</th>
                  <th className="text-[11px] font-semibold text-slate-500 px-4 py-3 whitespace-nowrap">{t('Batch')}</th>
                  <th className="text-[11px] font-semibold text-slate-500 px-4 py-3 whitespace-nowrap">{t('Tanggal')}</th>
                  <th className="text-[11px] font-semibold text-slate-500 px-4 py-3 whitespace-nowrap text-right">{t('Peserta')}</th>
                  <th className="text-[11px] font-semibold text-slate-500 px-4 py-3 whitespace-nowrap">{t('Progres Sertifikat')}</th>
                  <th className="text-[11px] font-semibold text-slate-500 px-4 py-3 whitespace-nowrap">{t('PIC')}</th>
                  <th className="text-[11px] font-semibold text-slate-500 px-4 py-3 whitespace-nowrap text-right">{t('Tindakan')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <TableSkeletonRows label={t('Memuat training')} columns={TRAINING_SKELETON_COLUMNS} />
                ) : filteredTrainings.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                      <p className="text-sm font-medium text-slate-900">{t('Batch training tidak ditemukan')}</p>
                      <p className="mt-1 text-xs">{t('Ubah filter atau tambahkan batch training baru.')}</p>
                    </td>
                  </tr>
                ) : (
                  pageItems.map(training => {
                    const initials = (training.pic || 'AD').substring(0, 2).toUpperCase();
                    const start = new Date(training.start_date);
                    const end = new Date(training.end_date);
                    const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
                    const dateText = start.toLocaleDateString(locale, { day: '2-digit' }) + '-' + end.toLocaleDateString(locale, options);

                    // Filter certificates and compute actual participants & progress
                    const batchCerts = certificates.filter(c => c.training_id === training.id);
                    const uniquePartIds = Array.from(new Set(batchCerts.map(c => c.participant_id)));
                    const participantCount = uniquePartIds.length;

                    // Helper to get progress weight based on status
                    const getProgressWeight = (status: string) => {
                      switch (status) {
                        case 'Pending': return 25;
                        case 'Processing': return 50;
                        case 'Printing': return 75;
                        case 'Completed': return 100;
                        default: return 0;
                      }
                    };

                    // Attendance stats
                    const attCerts = batchCerts.filter(c => c.certificate_type === 'Attendance');
                    const attProgressSum = attCerts.reduce((sum, c) => sum + getProgressWeight(c.status), 0);
                    const attPct = attCerts.length > 0 ? Math.round(attProgressSum / attCerts.length) : 0;

                    // Qualification stats
                    const qualCerts = batchCerts.filter(c => c.certificate_type === 'Qualification');
                    const qualProgressSum = qualCerts.reduce((sum, c) => sum + getProgressWeight(c.status), 0);
                    const qualPct = qualCerts.length > 0 ? Math.round(qualProgressSum / qualCerts.length) : 0;

                    // Last modifier info
                    const sortedCerts = [...batchCerts].filter(c => c.updated_at).sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime());
                    const latestCert = sortedCerts[0];
                    const lastModifier = latestCert ? (latestCert.updated_by || latestCert.printed_by || latestCert.sent_by || null) : null;
                    const lastModTime = latestCert ? latestCert.updated_at : null;

                    return (
                      <tr
                        key={training.id}
                        className="hover:bg-slate-50 transition-colors group h-14 cursor-pointer"
                        onClick={() => router.push(`/trainings/${training.id}`)}
                      >
                        <td className="px-4 py-3 w-12 text-center" onClick={(e) => e.stopPropagation()}>
                          {canDeleteTraining(training) && (
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(training.id)}
                            onChange={(e) => handleSelectRow(training.id, e.target.checked)}
                            className="training-select-checkbox rounded border-slate-200 text-blue-600 focus:ring-blue-500/15 cursor-pointer"
                          />
                          )}
                        </td>
                        <td className="px-4 py-3 min-w-[200px] max-w-[300px]">
                          <div className="text-[13px] font-medium text-slate-900 break-words">{training.program_name}</div>
                        </td>
                        <td className="px-4 py-3 max-w-[120px]">
                          <div className="text-xs font-mono text-slate-500 truncate" title={training.batch_code}>{training.batch_code}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-xs text-slate-500">{dateText}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <div className="text-[13px] text-slate-900 font-medium tabular-nums">{participantCount}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex flex-col gap-1 min-w-[130px] select-none">
                            {/* ATT Progress */}
                            <div className="flex items-center justify-between text-[11px] leading-none">
                              <span className="text-slate-500" title={t('Kehadiran')}>{t('HDR')}</span>
                              <span className="font-medium text-slate-700 tabular-nums">{attPct}%</span>
                            </div>
                            <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all duration-300 ${attPct === 100 ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${attPct}%` }}></div>
                            </div>
                            
                            {/* QUAL Progress */}
                            <div className="flex items-center justify-between text-[11px] leading-none mt-1">
                              <span className="text-slate-500" title={t('Kualifikasi')}>{t('KUAL')}</span>
                              <span className="font-medium text-slate-700 tabular-nums">{qualPct}%</span>
                            </div>
                            <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all duration-300 ${qualPct === 100 ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${qualPct}%` }}></div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-[11px] font-semibold text-slate-600 shrink-0">
                              {initials}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs text-slate-700 font-medium truncate">{training.pic || '-'}</span>
                              {lastModifier && lastModTime && (
                                <span className="text-[11px] text-slate-500 leading-tight">
                                  {t('oleh')} {lastModifier} {t('·')} {getTimeAgo(lastModTime)}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                          <ActionMenu align="right" menuWidth="w-44" items={[
                            { label: t('Lihat Detail'), icon: 'visibility', onClick: () => router.push(`/trainings/${training.id}`) },
                            ...(canWrite ? [{ label: t('Ubah Batch'), icon: 'edit', onClick: () => openEditModal(training) }] : []),
                            ...(canDeleteTraining(training) ? [
                              'divider' as const,
                              { label: t('Hapus'), icon: 'delete', variant: 'danger' as const, onClick: () => handleDelete(training.id) },
                            ] : []),
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
          total={filteredTrainings.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
        )}
      </div>

      </div>

      {dragging && !importModalOpen && <DropOverlay title={t('Lepaskan file CSV untuk mengimpor agenda')} hint={t('Anda akan meninjau hasilnya sebelum disimpan ke database.')} />}

      {/* CSV IMPORT MODAL */}
      {importModalOpen && (
        <Modal isOpen={true} onClose={() => setImportModalOpen(false)} title={t('Impor Agenda CSV')} dismissOnBackdrop footer={<>
<button className="cms-btn-secondary" onClick={() => setImportModalOpen(false)}>{t('Batal')}</button>
</>}>
<div className="flex flex-col gap-4">
              <FileDropzone
                onFile={processCSVFile}
                extensions={CSV_TYPES}
                title={t('Seret file CSV ke sini, atau klik untuk memilih')}
                hint={t('Menerima CSV berformat BKI (maks 5MB)')}
                inputId="csv-file-input"
              />
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 flex gap-2.5 items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400 text-sm">download</span>
                  <span className="text-xs font-semibold text-slate-700">{t('Template Agenda BKI')}</span>
                </div>
                <button onClick={downloadCSVTemplate} className="text-xs font-semibold text-blue-600 hover:underline">{t('Unduh CSV')}</button>
              </div>
            </div>
</Modal>
      )}

      {/* CSV NORMALIZATION PREVIEW MODAL */}
      {previewModalOpen && (
        <Modal isOpen={true} onClose={() => setPreviewModalOpen(false)} title={t('Tinjau & Pemetaan Normalisasi')} description={t('Tinjau dan ubah detail sebelum disinkronkan ke database.')} size="3xl" footer={<>
<span className="text-xs text-slate-500 font-semibold">{t('Terdeteksi')} {parsedBatches.length} {t('Batch (jumlah)')}</span>
              <div className="flex gap-3">
                <button className="cms-btn-secondary" onClick={() => setPreviewModalOpen(false)}>{t('Batal')}</button>
                <button onClick={handleSyncCSVToDB} className="cms-btn-primary">{t('Konfirmasi & Sinkronkan ke Database')}</button>
              </div>
</>}>
<div className="flex flex-col gap-6">
              {parsedBatches.map((batch, batchIndex) => (
                <div key={batchIndex} className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex flex-col gap-4">
                  <h4 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-600 text-lg">school</span>
                    {t('Detail Batch Program Training (#{n})', { n: batchIndex + 1 })}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-slate-600">{t('Nama Program')}</label>
                      <input
                        className="cms-input py-1.5 text-xs font-semibold"
                        value={batch.program_name}
                        onChange={(e) => {
                          const updated = [...parsedBatches];
                          updated[batchIndex].program_name = e.target.value;
                          setParsedBatches(updated);
                        }}
                        type="text"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-slate-600">{t('Tanggal Mulai')}</label>
                        <input
                          className="cms-input py-1.5 text-xs font-semibold"
                          value={batch.start_date}
                          onChange={(e) => {
                            const updated = [...parsedBatches];
                            updated[batchIndex].start_date = e.target.value;
                            setParsedBatches(updated);
                          }}
                          type="date"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-slate-600">{t('Tanggal Selesai')}</label>
                        <input
                          className="cms-input py-1.5 text-xs font-semibold"
                          value={batch.end_date}
                          onChange={(e) => {
                            const updated = [...parsedBatches];
                            updated[batchIndex].end_date = e.target.value;
                            setParsedBatches(updated);
                          }}
                          type="date"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 mb-2 block">{t('Daftar Peserta & Sertifikat')}</label>
                    <div className="overflow-x-auto max-h-48 border border-slate-200 rounded-lg table-scroll">
                      <table className="cms-table w-full text-left border-collapse text-xs bg-card">
                        <thead>
                          <tr className="bg-slate-100 border-b border-slate-200">
                            <th className="p-2 font-semibold text-slate-600">{t('Nama')}</th>
                            <th className="p-2 font-semibold text-slate-600">{t('Nama Perusahaan')}</th>
                            <th className="p-2 font-semibold text-slate-600">{t('Sert. Kehadiran')}</th>
                            <th className="p-2 font-semibold text-slate-600">{t('Sert. Kualifikasi')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {batch.participants.map((p, pIndex) => (
                            <tr key={pIndex}>
                              <td className="p-2 font-semibold text-slate-900">{p.name}</td>
                              <td className="p-2 text-slate-500">{p.company}</td>
                              <td className="p-2 font-mono text-[11px] text-slate-500">{p.cert_kehadiran || '-'}</td>
                              <td className="p-2 font-mono text-[11px] text-slate-500">{p.cert_kualifikasi || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ))}
            </div>
</Modal>
      )}

      {/* ADD / EDIT FORM MODAL */}
      {formModalOpen && (
        <Modal isOpen={true} onClose={() => setFormModalOpen(false)} title={editingTraining ? t('Ubah Batch Training') : t('Tambah Training Baru')} description={t('Isi detail untuk membuat atau mengubah batch training.')} size="lg" dismissOnBackdrop onSubmit={handleFormSubmit} footer={<>
<button className="cms-btn-secondary" type="button" onClick={() => setFormModalOpen(false)}>{t('Batal')}</button>
                <button className="cms-btn-primary" type="submit">
                  {editingTraining ? t('Simpan Perubahan') : t('Buat Training')}
                </button>
</>}>
<div className="flex flex-col">
<div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-slate-500" htmlFor="trainingName">{t('NAMA TRAINING')} <span className="text-red-500">*</span></label>
                  <input
                    className="cms-input"
                    id="trainingName"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder={t('mis. Advanced Structural Analysis')}
                    type="text"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-slate-500" htmlFor="batchNumber">{t('KODE BATCH')} <span className="text-red-500">*</span></label>
                  <input
                    className="cms-input font-mono"
                    id="batchNumber"
                    value={formBatch}
                    onChange={(e) => setFormBatch(e.target.value)}
                    placeholder={t('mis. BTH-2024-01')}
                    type="text"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-slate-500" htmlFor="startDate">{t('TANGGAL MULAI')} <span className="text-red-500">*</span></label>
                    <input
                      className="cms-input text-slate-700"
                      id="startDate"
                      value={formStart}
                      onChange={(e) => setFormStart(e.target.value)}
                      type="date"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-slate-500" htmlFor="endDate">{t('TANGGAL SELESAI')} <span className="text-red-500">*</span></label>
                    <input
                      className="cms-input text-slate-700"
                      id="endDate"
                      value={formEnd}
                      onChange={(e) => setFormEnd(e.target.value)}
                      type="date"
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-slate-500" htmlFor="picSelect">{t('PENANGGUNG JAWAB (PIC)')} <span className="text-red-500">*</span></label>
                  <input
                    className="cms-input"
                    id="picSelect"
                    value={formPic}
                    onChange={(e) => setFormPic(e.target.value)}
                    placeholder={t('mis. Ahmad Shafwan')}
                    type="text"
                    required
                  />
                </div>
              </div>
</div>
</Modal>
      )}

      {/* Floating Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="sidebar-fixed fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-3.5 rounded-full shadow-2xl flex items-center gap-4 z-50 transform translate-y-0 opacity-100 transition-all duration-300">
          <span className="text-xs font-semibold text-slate-300">{selectedIds.length} {t('batch dipilih')}</span>
          <div className="h-4 w-px bg-slate-700"></div>
          <button onClick={handleBulkDelete} className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 font-semibold cursor-pointer">
            <span className="material-symbols-outlined text-sm">delete</span> {t('Hapus yang Dipilih')}</button>
        </div>
      )}

      {/* Global Spinner Overlay */}
      {spinnerMsg && (
        <div role="status" aria-live="polite" className="fixed inset-0 bg-black/40 backdrop-blur-[1px] z-[60] flex items-center justify-center">
          <div className="bg-card px-4 py-3 rounded-xl shadow-lg border border-slate-200 flex items-center gap-3 animate-in zoom-in-95 duration-150">
            <span className="animate-spin inline-block w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full"></span>
            <span className="text-sm font-semibold text-slate-800">{spinnerMsg}</span>
          </div>
        </div>
      )}

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

export default function TrainingsPage() {
  return (
    <Suspense fallback={<AppShellSkeleton />}>
      <TrainingsContent />
    </Suspense>
  );
}
