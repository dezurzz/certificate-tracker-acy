'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { DB, Lead, LeadActivity } from '@/lib/db';
import { WATemplates, createWhatsAppUrl } from '@/lib/whatsapp';
import ConfirmationModal from '@/components/ConfirmationModal';
import { useAuth } from '@/context/AuthContext';

export default function FollowUpsPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter tab
  const [activeTab, setActiveTab] = useState<'overdue' | 'today' | 'link_sent' | 'all'>('overdue');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal note follow-up
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [actionNote, setActionNote] = useState('');
  const [actionNextDate, setActionNextDate] = useState('');

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
      const all = await DB.getLeads();
      // Exclude finished / cancelled
      const activeLeads = all.filter(l => l.status !== 'Selesai Training' && l.status !== 'Batal');
      setLeads(activeLeads);
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

  const todayStr = new Date().toISOString().split('T')[0];

  // Filtering tabs
  const overdueList = leads.filter(l => l.next_follow_up_date && l.next_follow_up_date < todayStr);
  const todayList = leads.filter(l => l.next_follow_up_date === todayStr);
  const linkSentList = leads.filter(l => l.status === 'Link Terkirim');

  let currentList = leads;
  if (activeTab === 'overdue') currentList = overdueList;
  else if (activeTab === 'today') currentList = todayList;
  else if (activeTab === 'link_sent') currentList = linkSentList;

  // Search filter
  const filtered = currentList.filter(l => {
    const text = `${l.contact_name} ${l.company_name} ${l.program_name} ${l.contact_phone} ${l.pic_staff_name}`.toLowerCase();
    return !searchTerm || text.includes(searchTerm.toLowerCase());
  });

  // Action: Postpone to tomorrow (1-click)
  const handlePostponeTomorrow = async (lead: Lead) => {
    const tomorrowStr = new Date(Date.now() + 24 * 3600 * 1000).toISOString().split('T')[0];
    try {
      await DB.updateLead(lead.id, { next_follow_up_date: tomorrowStr });
      await DB.insertLeadActivity({
        lead_id: lead.id,
        action_type: 'follow_up',
        note: `Target follow-up digeser ke besok (${tomorrowStr}).`,
        actor: user?.name || 'System Admin',
        previous_status: lead.status,
        new_status: lead.status
      });
      loadData();
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  // Action: Open Record Modal
  const openFollowUpModal = (lead: Lead) => {
    setSelectedLead(lead);
    const nextDate = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().split('T')[0];
    setActionNextDate(nextDate);
    setActionNote('');
    setIsFollowUpModalOpen(true);
  };

  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;

    try {
      await DB.updateLead(selectedLead.id, {
        next_follow_up_date: actionNextDate
      });

      await DB.insertLeadActivity({
        lead_id: selectedLead.id,
        action_type: 'follow_up',
        note: actionNote.trim() || 'Follow-up harian berhasil dilakukan.',
        actor: user?.name || 'System Admin',
        previous_status: selectedLead.status,
        new_status: selectedLead.status
      });

      alert('Follow-up berhasil dicatat!');
      setIsFollowUpModalOpen(false);
      loadData();
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  const handleOpenWA = (lead: Lead) => {
    const text = WATemplates.followUpReminder({
      contactName: lead.contact_name,
      companyName: lead.company_name,
      programName: lead.program_name,
      picName: user?.name || 'Tim BKI Academy'
    });
    const waUrl = createWhatsAppUrl(lead.contact_phone, text);
    window.open(waUrl, '_blank');
  };

  return (
    <DashboardLayout pageTitle="Tugas & Antrean Follow-up Harian">
      <div className="space-y-6">
        {/* Banner Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600 text-2xl">notification_important</span>
              Antrean Pekerjaan Follow-up Staf
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Fokus pada tugas yang jatuh tempo hari ini dan yang terlambat agar tidak ada calon peserta yang terlewatkan.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 font-mono">
            <span className="material-symbols-outlined text-base text-blue-600">today</span>
            Hari Ini: <b>{todayStr}</b>
          </div>
        </div>

        {/* Tab Badges */}
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => setActiveTab('overdue')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'overdue'
                ? 'bg-red-600 text-white shadow-md'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span className="material-symbols-outlined text-base">warning</span>
            Terlambat / Overdue ({overdueList.length})
          </button>

          <button
            onClick={() => setActiveTab('today')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'today'
                ? 'bg-amber-500 text-white shadow-md'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span className="material-symbols-outlined text-base">calendar_today</span>
            Jatuh Tempo Hari Ini ({todayList.length})
          </button>

          <button
            onClick={() => setActiveTab('link_sent')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'link_sent'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span className="material-symbols-outlined text-base">link</span>
            Link Terkirim Belum Terdaftar ({linkSentList.length})
          </button>

          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'all'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span className="material-symbols-outlined text-base">list</span>
            Semua Tugas Terbuka ({leads.length})
          </button>
        </div>

        {/* Search */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Cari kontak atau perusahaan pada antrean ini..."
              className="w-full h-9 !pl-10 pr-3 rounded-lg border border-slate-200 bg-slate-50 text-xs focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 transition-all text-slate-800"
            />
          </div>
        </div>

        {/* Task Cards / Table */}
        <div className="space-y-3">
          {loading ? (
            <div className="bg-white p-12 text-center text-slate-400 rounded-xl border border-slate-200">
              Memuat antrean tugas...
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white p-12 text-center text-slate-400 rounded-xl border border-slate-200">
              <span className="material-symbols-outlined text-4xl text-emerald-500 mb-1">task_alt</span>
              <p className="font-bold text-slate-700 text-sm">Bagus! Tidak ada antrean tugas pada kategori ini.</p>
              <p className="text-xs text-slate-400 mt-1">Seluruh tindak lanjut calon peserta telah tertangani dengan baik.</p>
            </div>
          ) : (
            filtered.map(lead => {
              const isOverdueTask = lead.next_follow_up_date < todayStr;
              const isTodayTask = lead.next_follow_up_date === todayStr;

              return (
                <div
                  key={lead.id}
                  className={`bg-white border rounded-xl p-4 shadow-sm transition hover:shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
                    isOverdueTask
                      ? 'border-l-4 border-l-red-500 border-slate-200'
                      : isTodayTask
                      ? 'border-l-4 border-l-amber-500 border-slate-200'
                      : 'border-slate-200'
                  }`}
                >
                  {/* Left Info */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{lead.contact_name}</span>
                      <span className="text-[11px] text-slate-500 font-medium">({lead.company_name})</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {lead.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                      <span className="font-medium text-blue-700">{lead.program_name}</span>
                      <span>•</span>
                      <span>Kebutuhan: <b>{lead.estimated_seats} Pax</b></span>
                      <span>•</span>
                      <span className="font-mono text-slate-500">{lead.contact_phone}</span>
                      <span>•</span>
                      <span>PIC: <b>{lead.pic_staff_name}</b></span>
                    </div>

                    {lead.notes && (
                      <p className="text-[11px] text-slate-500 italic mt-1 bg-slate-50 p-2 rounded border border-slate-100">
                        "{lead.notes}"
                      </p>
                    )}
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    <div className="text-right mr-2 hidden md:block">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Jatuh Tempo</span>
                      <p className={`font-bold text-xs ${isOverdueTask ? 'text-red-600' : isTodayTask ? 'text-amber-600' : 'text-slate-800'}`}>
                        {lead.next_follow_up_date}
                      </p>
                    </div>

                    {/* WhatsApp */}
                    <button
                      onClick={() => handleOpenWA(lead)}
                      title="Hubungi via WhatsApp"
                      className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-2 transition"
                    >
                      <span className="material-symbols-outlined text-[15px] shrink-0 leading-none">chat</span>
                      <span className="leading-none whitespace-nowrap">WA Pengingat</span>
                    </button>

                    {/* Quick Postpone to Tomorrow */}
                    <button
                      onClick={() => handlePostponeTomorrow(lead)}
                      title="Tunda follow-up ke besok"
                      className="px-3.5 py-2 bg-slate-50 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-2 transition"
                    >
                      <span className="material-symbols-outlined text-[15px] shrink-0 leading-none">snooze</span>
                      <span className="leading-none whitespace-nowrap">Besok</span>
                    </button>

                    {/* Record Follow-up */}
                    <button
                      onClick={() => openFollowUpModal(lead)}
                      className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition shadow-xs"
                    >
                      <span className="material-symbols-outlined text-[15px] shrink-0 leading-none">check</span>
                      <span className="leading-none whitespace-nowrap">Selesai Follow-up</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal: Catat Hasil Follow-up */}
        {isFollowUpModalOpen && selectedLead && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600">event_repeat</span>
                  Catat Hasil Follow-up
                </h3>
                <button onClick={() => setIsFollowUpModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>

              <form onSubmit={handleRecordSubmit} className="p-5 space-y-3.5 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <p className="font-semibold text-slate-800">{selectedLead.contact_name} ({selectedLead.company_name})</p>
                  <p className="text-slate-500 text-[11px]">{selectedLead.program_name}</p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Catatan Respon Calon Peserta / PIC <span className="text-red-500 font-semibold">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Contoh: Sudah ditelepon/chat WA, PIC mengonfirmasi akan mengirimkan form pendaftaran siang ini..."
                    value={actionNote}
                    onChange={e => setActionNote(e.target.value)}
                    className="cms-input text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Jadwal Follow-up / Pengecekan Berikutnya <span className="text-red-500 font-semibold">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={actionNextDate}
                    onChange={e => setActionNextDate(e.target.value)}
                    className="cms-input text-xs"
                  />
                </div>

                <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsFollowUpModalOpen(false)}
                    className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="cms-btn-primary bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-xs"
                  >
                    Simpan & Jadwalkan
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
