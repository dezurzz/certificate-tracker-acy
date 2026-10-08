'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { DB, Lead, Training, BKI_TRAINING_PROGRAMS } from '@/lib/db';
import { WATemplates, createWhatsAppUrl } from '@/lib/whatsapp';
import ConfirmationModal from '@/components/ConfirmationModal';
import Modal from '@/components/Modal';
import PageHeader from '@/components/PageHeader';
import LoadError from '@/components/LoadError';
import StatCard from '@/components/StatCard';
import { useAuth, useCan } from '@/context/AuthContext';
import { notify } from '@/lib/notify';
import SortSelect from '@/components/SortSelect';
import FilterBar, { FilterSearch, FilterSelect } from '@/components/FilterBar';
import { cmpText, cmpDate, cmpDateDesc, cmpNumberDesc } from '@/lib/sort';
import { useT } from '@/i18n/LanguageContext';
import { TableSkeletonRows, type SkeletonColumn } from '@/components/Skeleton';
import { getErrorMessage } from '@/lib/errors';

const WAITING_SKELETON_COLUMNS: SkeletonColumn[] = [
  { w: 'w-36', kind: 'twoLine' },
  { w: 'w-44', kind: 'twoLine' },
  { w: 'w-24', kind: 'badge' },
  { w: 'w-32', kind: 'twoLine' },
  'w-20',
  { w: '', kind: 'action', align: 'center' },
];

export default function WaitingListPage() {
  const t = useT();
  const { user } = useAuth();
  const canWrite = useCan()('data.write');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [reasonFilter, setReasonFilter] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [picFilter, setPicFilter] = useState('');
  const [sortKey, setSortKey] = useState<'waiting_longest' | 'waiting_newest' | 'name_asc' | 'name_desc' | 'company_asc' | 'seats_desc' | 'followup_asc'>('waiting_longest');

  // Modals
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isAssignBatchModalOpen, setIsAssignBatchModalOpen] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [confirmedSeats, setConfirmedSeats] = useState(1);
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
    setLoadError(null);
    try {
      const [allLeads, allTrainings] = await Promise.all([
        DB.getLeads(),
        DB.getTrainings()
      ]);
      // Filter only waiting list
      setLeads(allLeads.filter(l => l.status === 'Waiting List'));
      setTrainings(allTrainings);
    } catch (e) {
      setLoadError(getErrorMessage(e));
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

  // Filtered leads
  const filtered = leads.filter(l => {
    const text = `${l.contact_name} ${l.company_name} ${l.program_name} ${l.notes}`.toLowerCase();
    if (searchTerm && !text.includes(searchTerm.toLowerCase())) return false;
    if (reasonFilter && l.waiting_reason !== reasonFilter) return false;
    if (programFilter && l.program_name !== programFilter) return false;
    if (picFilter && l.pic_staff_name !== picFilter) return false;
    return true;
  }).sort((a, b) => {
    switch (sortKey) {
      case 'waiting_newest': return cmpDateDesc(a.updated_at, b.updated_at);
      case 'name_asc': return cmpText(a.contact_name, b.contact_name);
      case 'name_desc': return cmpText(b.contact_name, a.contact_name);
      case 'company_asc': return cmpText(a.company_name, b.company_name);
      case 'seats_desc': return cmpNumberDesc(a.estimated_seats, b.estimated_seats);
      case 'followup_asc': return cmpDate(a.next_follow_up_date, b.next_follow_up_date);
      default: return cmpDate(a.updated_at, b.updated_at);
    }
  });

  const uniquePics = Array.from(new Set(leads.map(l => l.pic_staff_name).filter(Boolean))).sort(cmpText);

  // Calculate stats
  const totalWaitingLeads = leads.length;
  const totalWaitingSeats = leads.reduce((acc, l) => acc + (l.estimated_seats || 1), 0);
  const rescheduleCount = leads.filter(l => l.waiting_reason === 'Reschedule').length;
  const noScheduleCount = leads.filter(l => l.waiting_reason === 'Belum Ada Jadwal').length;

  // Group demand by program
  const demandByProgram: Record<string, { seats: number; leadsCount: number }> = {};
  leads.forEach(l => {
    if (!demandByProgram[l.program_name]) {
      demandByProgram[l.program_name] = { seats: 0, leadsCount: 0 };
    }
    demandByProgram[l.program_name].seats += (l.estimated_seats || 1);
    demandByProgram[l.program_name].leadsCount += 1;
  });

  // Batch matching for a lead
  const getMatchingBatches = (programName: string) => {
    return trainings.filter(t => 
      t.program_name.toLowerCase().includes(programName.toLowerCase()) ||
      programName.toLowerCase().includes(t.program_name.toLowerCase())
    );
  };

  // WhatsApp quick launch
  const handleOpenWA = (lead: Lead, templateType: 'offer' | 'reminder') => {
    const text = templateType === 'offer'
      ? WATemplates.scheduleOffer({
          contactName: lead.contact_name,
          companyName: lead.company_name,
          programName: lead.program_name,
          picName: user?.name || 'Tim BKI Academy'
        })
      : WATemplates.followUpReminder({
          contactName: lead.contact_name,
          programName: lead.program_name,
          picName: user?.name || 'Tim BKI Academy'
        });

    const waUrl = createWhatsAppUrl(lead.contact_phone, text);
    window.open(waUrl, '_blank');
  };

  const openAssignBatchModal = (lead: Lead) => {
    setSelectedLead(lead);
    setConfirmedSeats(lead.estimated_seats || 1);
    const matches = getMatchingBatches(lead.program_name);
    setSelectedBatchId(matches.length > 0 ? matches[0].id : '');
    setIsAssignBatchModalOpen(true);
  };

  const handleAssignBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;

    const matched = trainings.find(t => t.id === selectedBatchId);

    try {
      await DB.updateLeadStatus(selectedLead.id, 'Terdaftar', {
        batchId: matched?.id,
        batchCode: matched?.batch_code || 'Batch Ditetapkan',
        confirmedSeats: Number(confirmedSeats) || selectedLead.estimated_seats,
        note: t('Dialihkan dari Waiting List ke Terdaftar pada {program_name} ({batch_code}).', { program_name: matched?.program_name, batch_code: matched?.batch_code }),
        actor: user?.name || 'System Admin'
      });
      notify.success(t('Peluang Waiting List berhasil dialokasikan ke Batch Pelatihan'));
      setIsAssignBatchModalOpen(false);
      loadData();
    } catch (e) {
      notify.error(t('Terjadi kesalahan'), getErrorMessage(e));
    }
  };

  const handleOfferSchedule = async (lead: Lead) => {
    setConfirmConfig({
      isOpen: true,
      title: t('Tawarkan Jadwal'),
      message: t('Ubah status {contact_name} menjadi "Jadwal Ditawarkan"? Ini menandakan staf sudah menginfokan opsi jadwal via WA.', { contact_name: lead.contact_name }),
      confirmLabel: t('Ya, Tandai Ditawarkan'),
      type: 'info',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        try {
          await DB.updateLeadStatus(lead.id, 'Jadwal Ditawarkan', {
            note: 'Opsi jadwal pelatihan telah ditawarkan kepada calon peserta/PIC.',
            actor: user?.name || 'System Admin'
          });
          loadData();
        } catch (e) {
          notify.error(t('Terjadi kesalahan'), getErrorMessage(e));
        }
      }
    });
  };

  return (
    <DashboardLayout pageTitle="Waiting List & Batch Matching">
      <div className="space-y-6">
        <PageHeader
          title={t('Waiting List')}
          description={t('Pantau calon peserta yang menunggu jadwal dibuka atau melakukan reschedule, lalu pasangkan langsung dengan batch aktif.')}
        />

        {loadError && <LoadError message={loadError} onRetry={loadData} />}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label={t('Total waiting list')} value={totalWaitingLeads} hint={t('peluang')} />
          <StatCard label={t('Total kebutuhan kursi')} value={totalWaitingSeats} hint={t('pax calon peserta')} />
          <StatCard label={t('Kasus reschedule')} value={rescheduleCount} hint={t('peluang')} />
          <StatCard label={t('Belum ada jadwal')} value={noScheduleCount} hint={t('peluang')} tone={noScheduleCount > 0 ? 'warning' : 'default'} />
        </div>

        {/* Program Demand Summary (Waiting List Barometer) */}
        <div className="bg-card border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{t('Barometer minat per program')}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{t('Dasar keputusan membuka batch baru.')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            {Object.keys(demandByProgram).length === 0 ? (
              <p className="text-xs text-slate-500 italic">{t('Belum ada permintaan di antrean waiting list.')}</p>
            ) : (
              Object.entries(demandByProgram).map(([progName, data]) => {
                const matches = getMatchingBatches(progName);
                const hasActiveBatch = matches.some(m => m.status !== 'Completed');

                return (
                  <div key={progName} className="p-3 rounded-lg border border-slate-200 space-y-1.5">
                    <div className="flex justify-between items-start gap-2">
                      <p className="font-medium text-slate-900 text-xs">{progName}</p>
                      <span className="shrink-0 text-[11px] font-medium text-slate-600 tabular-nums">
                        {t('{seats} Pax ({leads} lead)', { seats: data.seats, leads: data.leadsCount })}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px]">
                      {hasActiveBatch ? (
                        <span className="text-emerald-700 font-semibold flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">check_circle</span>
                          {t('Tersedia')} {matches.length} {t('Batch Aktif')}</span>
                      ) : (
                        <span className="text-amber-700 font-semibold flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">warning</span>
                          {t('Belum Ada Batch Aktif (Rekomendasi Buka)')}</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Filters, search and sorting */}
        <FilterBar
          summary={t('Menampilkan {shown} dari {total} lead', { shown: filtered.length, total: leads.length })}
          hasActive={Boolean(searchTerm || reasonFilter || programFilter || picFilter)}
          onReset={() => { setSearchTerm(''); setReasonFilter(''); setProgramFilter(''); setPicFilter(''); }}
          sort={
            <SortSelect
              value={sortKey}
              onChange={setSortKey}
              options={[
                { value: 'waiting_longest', label: t('Paling lama menunggu') },
                { value: 'waiting_newest', label: t('Terbaru masuk waiting list') },
                { value: 'followup_asc', label: t('Follow-up terdekat') },
                { value: 'seats_desc', label: t('Estimasi kursi terbanyak') },
                { value: 'name_asc', label: t('Nama kontak A–Z') },
                { value: 'name_desc', label: t('Nama kontak Z–A') },
                { value: 'company_asc', label: t('Perusahaan A–Z') },
              ]}
            />
          }
        >
          <FilterSearch value={searchTerm} onChange={setSearchTerm} placeholder={t('Cari kontak, perusahaan, atau catatan...')} />
          <FilterSelect value={reasonFilter} onChange={setReasonFilter} label={t('Filter berdasarkan alasan')}>
            <option value="">{t('Semua Alasan Waiting List')}</option>
            <option value="Reschedule">{t('Reschedule')}</option>
            <option value="Belum Ada Jadwal">{t('Belum Ada Jadwal')}</option>
            <option value="Menunggu Konfirmasi Internal">{t('Menunggu Konfirmasi Internal')}</option>
            <option value="Budgeting">{t('Budgeting')}</option>
            <option value="Lainnya">{t('Lainnya')}</option>
          </FilterSelect>
          <FilterSelect value={picFilter} onChange={setPicFilter} label={t('Filter berdasarkan PIC')}>
            <option value="">{t('Semua PIC')}</option>
            {uniquePics.map(pic => <option key={pic} value={pic}>{pic}</option>)}
          </FilterSelect>
          <FilterSelect value={programFilter} onChange={setProgramFilter} label={t('Filter berdasarkan program')}>
            <option value="">{t('Semua Program Training')}</option>
            {BKI_TRAINING_PROGRAMS.map(progName => <option key={progName} value={progName}>{progName}</option>)}
          </FilterSelect>
        </FilterBar>

        {/* Waiting List Table */}
        <div className="bg-card border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto table-scroll">
            <table className="cms-table w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                  <th className="py-3.5 px-4">{t('Kontak / Perusahaan')}</th>
                  <th className="py-3.5 px-4">{t('Program & Kebutuhan')}</th>
                  <th className="py-3.5 px-4">{t('Alasan & Riwayat Batch')}</th>
                  <th className="py-3.5 px-4">{t('Rekomendasi Batch Aktif')}</th>
                  <th className="py-3.5 px-4">{t('Target Cek')}</th>
                  <th className="py-3.5 px-4 text-center">{t('Aksi Cepat')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <TableSkeletonRows label={t('Memuat data waiting list...')} columns={WAITING_SKELETON_COLUMNS} />
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      <span className="material-symbols-outlined text-3xl text-slate-300 mb-1">hourglass_disabled</span>
                      <p className="font-semibold text-slate-600">{t('Tidak ada antrean waiting list yang cocok')}</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map(lead => {
                    const matches = getMatchingBatches(lead.program_name);

                    return (
                      <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-slate-900">{lead.contact_name}</p>
                          <p className="text-[11px] text-slate-500">{lead.company_name}</p>
                          <p className="text-[11px] text-slate-600 font-mono mt-0.5">{lead.contact_phone}</p>
                        </td>

                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-slate-900">{lead.program_name}</p>
                          <span className="inline-block mt-1 text-[11px] text-slate-600">
                            {lead.estimated_seats} {t('pax')}</span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="cms-badge cms-badge-warning">
                            {lead.waiting_reason || t('Waiting List')}
                          </span>
                          {lead.previous_batch_info && (
                            <p className="text-[11px] text-slate-500 mt-1">
                              {t('Reschedule dr:')} <b>{lead.previous_batch_info}</b>
                            </p>
                          )}
                          {lead.notes && (
                            <p className="text-[11px] text-slate-600 mt-1 italic line-clamp-2 max-w-[220px]">
                              &ldquo;{lead.notes}&rdquo;
                            </p>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {matches.length > 0 ? (
                            <div className="space-y-1">
                              <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs">event_available</span>
                                {matches[0].batch_code} ({matches[0].start_date})
                              </span>
                              <p className="text-[11px] text-slate-500">{matches[0].location}</p>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-500 italic">{t('Belum ada batch dibuka')}</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 font-semibold text-slate-700">
                          {lead.next_follow_up_date || '-'}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* WhatsApp Offer Button */}
                            <button
                              title={t('Kirim Penawaran Jadwal via WhatsApp')}
                              onClick={() => handleOpenWA(lead, 'offer')}
                              aria-label={t('Kirim penawaran jadwal via WhatsApp')}
                              className="cms-btn-secondary !h-8 !w-8 !p-0 justify-center"
                            >
                              <span className="material-symbols-outlined text-base" aria-hidden="true">chat</span>
                            </button>

                            {canWrite && (<>
                            {/* Mark Schedule Offered */}
                            <button
                              title={t('Tandai Jadwal Ditawarkan')}
                              onClick={() => handleOfferSchedule(lead)}
                              className="cms-btn-secondary !h-8 !px-3 !text-xs"
                            >
                              {t('Tawarkan')}</button>

                            {/* Assign to Batch */}
                            <button
                              title={t('Alokasikan ke Batch')}
                              onClick={() => openAssignBatchModal(lead)}
                              className="cms-btn-primary !h-8 !px-3 !text-xs"
                            >
                              {t('Pilih Batch')}</button>
                            </>)}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: Alokasikan ke Batch */}
        {isAssignBatchModalOpen && selectedLead && (
          <Modal isOpen={true} onClose={() => setIsAssignBatchModalOpen(false)} title={t('Alokasikan Waiting List ke Batch Aktif')} icon="how_to_reg" onSubmit={handleAssignBatchSubmit} cancelLabel={t('Batal')} submitLabel={t('Alokasikan & Daftarkan')}>
<div className="space-y-3.5 text-xs">
<div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <p className="font-semibold text-slate-800">{selectedLead.contact_name}</p>
                  <p className="text-slate-500 text-[11px]">{selectedLead.company_name} - {selectedLead.program_name}</p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {t('Pilih Batch Pelatihan yang Tersedia')} <span className="text-red-500 font-semibold">*</span>
                  </label>
                  <select
                    required
                    value={selectedBatchId}
                    onChange={e => setSelectedBatchId(e.target.value)}
                    className="cms-input text-xs"
                  >
                    <option value="">{t('-- Pilih Batch --')}</option>
                    {trainings.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.program_name} - {t.batch_code} ({t.start_date} s/d {t.end_date})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {t('Jumlah Kursi Terkonfirmasi')} <span className="text-red-500 font-semibold">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={confirmedSeats}
                    onChange={e => setConfirmedSeats(Number(e.target.value))}
                    className="cms-input text-xs"
                  />
                </div>
</div>
</Modal>
        )}

        {/* Global Confirmation Modal */}
        <ConfirmationModal
          isOpen={confirmConfig.isOpen}
          title={confirmConfig.title}
          message={confirmConfig.message}
          confirmLabel={confirmConfig.confirmLabel}
          type={confirmConfig.type}
          onConfirm={confirmConfig.onConfirm}
          onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
        />
      </div>
    </DashboardLayout>
  );
}
