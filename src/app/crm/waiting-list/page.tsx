'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { DB, Lead, Training, TrainingProgram, BKI_TRAINING_PROGRAMS } from '@/lib/db';
import { WATemplates, createWhatsAppUrl } from '@/lib/whatsapp';
import ConfirmationModal from '@/components/ConfirmationModal';
import { useAuth } from '@/context/AuthContext';

export default function WaitingListPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [reasonFilter, setReasonFilter] = useState('');
  const [programFilter, setProgramFilter] = useState('');

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
    try {
      const [allLeads, allTrainings, allPrograms] = await Promise.all([
        DB.getLeads(),
        DB.getTrainings(),
        DB.getTrainingPrograms()
      ]);
      // Filter only waiting list
      setLeads(allLeads.filter(l => l.status === 'Waiting List'));
      setTrainings(allTrainings);
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

  // Filtered leads
  const filtered = leads.filter(l => {
    const text = `${l.contact_name} ${l.company_name} ${l.program_name} ${l.notes}`.toLowerCase();
    if (searchTerm && !text.includes(searchTerm.toLowerCase())) return false;
    if (reasonFilter && l.waiting_reason !== reasonFilter) return false;
    if (programFilter && l.program_name !== programFilter) return false;
    return true;
  });

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
        note: `Dialihkan dari Waiting List ke Terdaftar pada ${matched?.program_name} (${matched?.batch_code}).`,
        actor: user?.name || 'System Admin'
      });
      alert('Peluang Waiting List berhasil dialokasikan ke Batch Pelatihan!');
      setIsAssignBatchModalOpen(false);
      loadData();
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  const handleOfferSchedule = async (lead: Lead) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Tawarkan Jadwal',
      message: `Ubah status ${lead.contact_name} menjadi "Jadwal Ditawarkan"? Ini menandakan staf sudah menginfokan opsi jadwal via WA.`,
      confirmLabel: 'Ya, Tandai Ditawarkan',
      type: 'info',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        try {
          await DB.updateLeadStatus(lead.id, 'Jadwal Ditawarkan', {
            note: 'Opsi jadwal pelatihan telah ditawarkan kepada calon peserta/PIC.',
            actor: user?.name || 'System Admin'
          });
          loadData();
        } catch (e: any) {
          alert('Error: ' + e.message);
        }
      }
    });
  };

  return (
    <DashboardLayout pageTitle="Waiting List & Batch Matching">
      <div className="space-y-6">
        {/* Header Banner */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-600 text-2xl">hourglass_top</span>
              Waiting List & Permintaan Batch Pelatihan
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Pantau calon peserta yang menunggu jadwal dibuka atau melakukan reschedule, serta pasangkan langsung dengan batch aktif.
            </p>
          </div>
        </div>

        {/* Stats Bento */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Waiting List</span>
            <p className="text-2xl font-bold text-slate-900 mt-1">{totalWaitingLeads} <span className="text-xs font-normal text-slate-500">Peluang</span></p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider">Total Kebutuhan Kursi</span>
            <p className="text-2xl font-bold text-blue-700 mt-1">{totalWaitingSeats} <span className="text-xs font-normal text-slate-500">Pax Calon Peserta</span></p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider">Kasus Reschedule</span>
            <p className="text-2xl font-bold text-amber-700 mt-1">{rescheduleCount} <span className="text-xs font-normal text-slate-500">Peluang</span></p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <span className="text-[10px] font-semibold text-purple-600 uppercase tracking-wider">Belum Ada Jadwal</span>
            <p className="text-2xl font-bold text-purple-700 mt-1">{noScheduleCount} <span className="text-xs font-normal text-slate-500">Peluang</span></p>
          </div>
        </div>

        {/* Program Demand Summary (Waiting List Barometer) */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600 text-lg">bar_chart</span>
            Barometer Minat & Antrean Pelatihan (Dasar Buka Batch Baru)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            {Object.keys(demandByProgram).length === 0 ? (
              <p className="text-xs text-slate-400 italic">Belum ada permintaan di antrean waiting list.</p>
            ) : (
              Object.entries(demandByProgram).map(([progName, data]) => {
                const matches = getMatchingBatches(progName);
                const hasActiveBatch = matches.some(m => m.status !== 'Completed');

                return (
                  <div key={progName} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                    <div className="flex justify-between items-start gap-2">
                      <p className="font-bold text-slate-900 text-xs">{progName}</p>
                      <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold shrink-0">
                        {data.seats} Pax ({data.leadsCount} lead)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px]">
                      {hasActiveBatch ? (
                        <span className="text-emerald-700 font-semibold flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">check_circle</span>
                          Tersedia {matches.length} Batch Aktif
                        </span>
                      ) : (
                        <span className="text-amber-700 font-semibold flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">warning</span>
                          Belum Ada Batch Aktif (Rekomendasi Buka)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-3 items-center">
          <div className="flex-1 relative w-full">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Cari kontak, perusahaan, atau catatan..."
              className="w-full h-9 !pl-10 pr-3 rounded-lg border border-slate-200 bg-slate-50 text-xs focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 transition-all text-slate-800"
            />
          </div>

          <div className="w-full md:w-56">
            <select
              value={reasonFilter}
              onChange={e => setReasonFilter(e.target.value)}
              className="cms-select-filter w-full text-xs"
            >
              <option value="">Semua Alasan Waiting List</option>
              <option value="Reschedule">Reschedule</option>
              <option value="Belum Ada Jadwal">Belum Ada Jadwal</option>
              <option value="Menunggu Konfirmasi Internal">Menunggu Konfirmasi Internal</option>
            </select>
          </div>

          <div className="w-full md:w-56">
            <select
              value={programFilter}
              onChange={e => setProgramFilter(e.target.value)}
              className="cms-select-filter w-full text-xs"
            >
              <option value="">Semua Program Training</option>
              {BKI_TRAINING_PROGRAMS.map(progName => (
                <option key={progName} value={progName}>{progName}</option>
              ))}
            </select>
          </div>

          {(searchTerm || reasonFilter || programFilter) && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setReasonFilter('');
                setProgramFilter('');
              }}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline whitespace-nowrap cursor-pointer shrink-0"
            >
              Reset Filter
            </button>
          )}
        </div>

        {/* Waiting List Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto table-scroll">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Kontak / Perusahaan</th>
                  <th className="py-3.5 px-4">Program & Kebutuhan</th>
                  <th className="py-3.5 px-4">Alasan & Riwayat Batch</th>
                  <th className="py-3.5 px-4">Rekomendasi Batch Aktif</th>
                  <th className="py-3.5 px-4">Target Cek</th>
                  <th className="py-3.5 px-4 text-center">Aksi Cepat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      Memuat data waiting list...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <span className="material-symbols-outlined text-3xl text-slate-300 mb-1">hourglass_disabled</span>
                      <p className="font-semibold text-slate-600">Tidak ada antrean waiting list yang cocok</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map(lead => {
                    const matches = getMatchingBatches(lead.program_name);

                    return (
                      <tr key={lead.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-slate-900">{lead.contact_name}</p>
                          <p className="text-[11px] text-slate-500">{lead.company_name}</p>
                          <p className="text-[10px] text-blue-600 font-mono mt-0.5">{lead.contact_phone}</p>
                        </td>

                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-slate-900">{lead.program_name}</p>
                          <span className="inline-block mt-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-100">
                            {lead.estimated_seats} Pax
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-200">
                            {lead.waiting_reason || 'Waiting List'}
                          </span>
                          {lead.previous_batch_info && (
                            <p className="text-[10px] text-slate-500 mt-1">
                              Reschedule dr: <b>{lead.previous_batch_info}</b>
                            </p>
                          )}
                          {lead.notes && (
                            <p className="text-[10px] text-slate-600 mt-1 italic line-clamp-2 max-w-[220px]">
                              "{lead.notes}"
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
                              <p className="text-[10px] text-slate-400">{matches[0].location}</p>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Belum ada batch dibuka</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 font-semibold text-slate-700">
                          {lead.next_follow_up_date || '-'}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* WhatsApp Offer Button */}
                            <button
                              title="Kirim Penawaran Jadwal via WhatsApp"
                              onClick={() => handleOpenWA(lead, 'offer')}
                              className="w-7 h-7 rounded-lg bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-600 flex items-center justify-center border border-emerald-200 transition"
                            >
                              <span className="material-symbols-outlined text-base">chat</span>
                            </button>

                            {/* Mark Schedule Offered */}
                            <button
                              title="Tandai Jadwal Ditawarkan"
                              onClick={() => handleOfferSchedule(lead)}
                              className="px-2 py-1 bg-purple-50 hover:bg-purple-600 hover:text-white text-purple-700 border border-purple-200 rounded text-[10px] font-semibold transition"
                            >
                              Tawarkan
                            </button>

                            {/* Assign to Batch */}
                            <button
                              title="Alokasikan ke Batch"
                              onClick={() => openAssignBatchModal(lead)}
                              className="px-2 py-1 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 border border-blue-200 rounded text-[10px] font-semibold transition"
                            >
                              Pilih Batch
                            </button>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-4 border-b border-slate-200 bg-blue-50 text-blue-900 flex justify-between items-center">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600">how_to_reg</span>
                  Alokasikan Waiting List ke Batch Aktif
                </h3>
                <button onClick={() => setIsAssignBatchModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>

              <form onSubmit={handleAssignBatchSubmit} className="p-5 space-y-3.5 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <p className="font-semibold text-slate-800">{selectedLead.contact_name}</p>
                  <p className="text-slate-500 text-[11px]">{selectedLead.company_name} — {selectedLead.program_name}</p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Pilih Batch Pelatihan yang Tersedia <span className="text-red-500 font-semibold">*</span>
                  </label>
                  <select
                    required
                    value={selectedBatchId}
                    onChange={e => setSelectedBatchId(e.target.value)}
                    className="cms-input text-xs"
                  >
                    <option value="">-- Pilih Batch --</option>
                    {trainings.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.program_name} — {t.batch_code} ({t.start_date} s/d {t.end_date})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Jumlah Kursi Terkonfirmasi <span className="text-red-500 font-semibold">*</span>
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

                <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAssignBatchModalOpen(false)}
                    className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="cms-btn-primary bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-xs"
                  >
                    Alokasikan & Daftarkan
                  </button>
                </div>
              </form>
            </div>
          </div>
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
