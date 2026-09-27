'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { DB, Lead, LeadStatus, LeadSource, WaitingReason, TrainingProgram, Training, LeadActivity } from '@/lib/db';
import { WATemplates, createWhatsAppUrl } from '@/lib/whatsapp';
import ConfirmationModal from '@/components/ConfirmationModal';
import { useAuth } from '@/context/AuthContext';

export default function LeadsPage() {
  const { user } = useAuth();

  // Data states
  const [leads, setLeads] = useState<Lead[]>([]);
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [picFilter, setPicFilter] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [leadActivities, setLeadActivities] = useState<LeadActivity[]>([]);

  // Action modals
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  // Action fields
  const [actionBatchId, setActionBatchId] = useState('');
  const [actionConfirmedSeats, setActionConfirmedSeats] = useState<number>(1);
  const [actionNextDate, setActionNextDate] = useState('');
  const [actionNote, setActionNote] = useState('');
  const [actionReason, setActionReason] = useState<WaitingReason>('Reschedule');

  // New Lead Form State
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newProgramName, setNewProgramName] = useState('');
  const [newEstimatedSeats, setNewEstimatedSeats] = useState(1);
  const [newSource, setNewSource] = useState<LeadSource>('WA Bisnis');
  const [newNextFollowUp, setNewNextFollowUp] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Confirmation modal
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

  // Load all required data
  const loadData = async () => {
    setLoading(true);
    try {
      const [leadList, progList, trainList] = await Promise.all([
        DB.getLeads(),
        DB.getTrainingPrograms(),
        DB.getTrainings()
      ]);
      setLeads(leadList);
      setPrograms(progList);
      setTrainings(trainList);

      // If drawer is currently open on a lead, refresh it
      if (selectedLead) {
        const refreshed = leadList.find(l => l.id === selectedLead.id);
        if (refreshed) {
          setSelectedLead(refreshed);
          const acts = await DB.getLeadActivities(refreshed.id);
          setLeadActivities(acts);
        }
      }
    } catch (e) {
      console.error('Error loading CRM leads:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Default next follow-up to tomorrow
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString().split('T')[0];
    setNewNextFollowUp(tomorrow);
    setActionNextDate(tomorrow);

    const handleUpdate = () => loadData();
    window.addEventListener('bki-db-update', handleUpdate);
    return () => window.removeEventListener('bki-db-update', handleUpdate);
  }, []);

  // Quick Open Drawer
  const openLeadDetail = async (lead: Lead) => {
    setSelectedLead(lead);
    setIsDetailDrawerOpen(true);
    try {
      const acts = await DB.getLeadActivities(lead.id);
      setLeadActivities(acts);
    } catch (e) {
      console.error(e);
    }
  };

  // Helper date
  const todayStr = new Date().toISOString().split('T')[0];
  const isOverdue = (dateStr?: string) => {
    if (!dateStr) return false;
    return dateStr < todayStr;
  };

  // Stats calculation
  const totalLeads = leads.length;
  const baruCount = leads.filter(l => l.status === 'Baru').length;
  const waitingListCount = leads.filter(l => l.status === 'Waiting List').length;
  const linkSentCount = leads.filter(l => l.status === 'Link Terkirim').length;
  const registeredCount = leads.filter(l => l.status === 'Terdaftar').length;
  const overdueCount = leads.filter(l => l.status !== 'Selesai Training' && l.status !== 'Batal' && isOverdue(l.next_follow_up_date)).length;

  // Filter calculation
  const filteredLeads = leads.filter(l => {
    const textMatch = `${l.contact_name} ${l.company_name} ${l.contact_phone} ${l.program_name} ${l.pic_staff_name}`.toLowerCase();
    if (searchTerm && !textMatch.includes(searchTerm.toLowerCase())) return false;
    if (statusFilter && l.status !== statusFilter) return false;
    if (picFilter && l.pic_staff_name !== picFilter) return false;
    if (programFilter && l.program_name !== programFilter) return false;
    if (onlyOverdue && (!isOverdue(l.next_follow_up_date) || l.status === 'Selesai Training' || l.status === 'Batal')) return false;
    return true;
  });

  // Unique PICs for filter
  const uniquePics = Array.from(new Set(leads.map(l => l.pic_staff_name).filter(Boolean)));

  // Status Badge Styling
  const getStatusBadge = (status: LeadStatus) => {
    switch (status) {
      case 'Baru':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-700 border border-blue-200">Baru</span>;
      case 'Waiting List':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-200">Waiting List</span>;
      case 'Jadwal Ditawarkan':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-700 border border-purple-200">Jadwal Ditawarkan</span>;
      case 'Link Terkirim':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">Link Terkirim</span>;
      case 'Terdaftar':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">Terdaftar</span>;
      case 'Selesai Training':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800 border border-green-200">Selesai Training</span>;
      case 'Batal':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-500 border border-slate-200">Batal</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  // Actions
  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName.trim() || !newContactPhone.trim() || !newProgramName.trim()) {
      alert('Nama kontak, nomor WhatsApp/telepon, dan jenis training wajib diisi.');
      return;
    }

    try {
      await DB.insertLead({
        contact_name: newContactName.trim(),
        contact_phone: newContactPhone.trim(),
        contact_email: newContactEmail.trim() || undefined,
        company_name: newCompanyName.trim() || 'PRIBADI',
        program_name: newProgramName.trim(),
        estimated_seats: Number(newEstimatedSeats) || 1,
        status: 'Baru',
        source: newSource,
        pic_staff_name: user?.name || 'System Admin',
        next_follow_up_date: newNextFollowUp || todayStr,
        notes: newNotes.trim() || undefined
      });

      alert('Lead baru berhasil ditambahkan!');
      setIsAddModalOpen(false);

      // Reset form
      setNewContactName('');
      setNewContactPhone('');
      setNewContactEmail('');
      setNewCompanyName('');
      setNewProgramName('');
      setNewEstimatedSeats(1);
      setNewNotes('');
      loadData();
    } catch (err: any) {
      alert('Gagal menambahkan lead: ' + err.message);
    }
  };

  const handleMarkLinkSent = async (lead: Lead) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Tandai Link Terkirim',
      message: `Konfirmasi bahwa link formulir pendaftaran sudah dikirimkan ke ${lead.contact_name}? Status akan diubah menjadi "Link Terkirim".`,
      confirmLabel: 'Ya, Tandai Terkirim',
      type: 'info',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        try {
          // Set follow-up in 2 days by default
          const nextDate = new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString().split('T')[0];
          await DB.updateLeadStatus(lead.id, 'Link Terkirim', {
            note: 'Link formulir pendaftaran berhasil dikirim ke calon peserta/PIC.',
            nextFollowUp: nextDate,
            actor: user?.name || 'System Admin'
          });
          loadData();
        } catch (e: any) {
          alert('Error: ' + e.message);
        }
      }
    });
  };

  const openRegisterModal = (lead: Lead) => {
    setSelectedLead(lead);
    setActionConfirmedSeats(lead.estimated_seats || 1);
    // Find matching active trainings
    const matching = trainings.filter(t => t.program_name.toLowerCase().includes(lead.program_name.toLowerCase()));
    setActionBatchId(matching.length > 0 ? matching[0].id : '');
    setIsRegisterModalOpen(true);
  };

  const handleConfirmRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;

    const matchedBatch = trainings.find(t => t.id === actionBatchId);

    try {
      await DB.updateLeadStatus(selectedLead.id, 'Terdaftar', {
        batchId: matchedBatch?.id,
        batchCode: matchedBatch?.batch_code || 'Batch Terjadwal',
        confirmedSeats: Number(actionConfirmedSeats) || selectedLead.estimated_seats,
        note: actionNote.trim() || `Pendaftaran dikonfirmasi untuk ${actionConfirmedSeats} peserta.`,
        actor: user?.name || 'System Admin'
      });
      alert('Pendaftaran berhasil dikonfirmasi!');
      setIsRegisterModalOpen(false);
      setActionNote('');
      loadData();
    } catch (e: any) {
      alert('Gagal konfirmasi: ' + e.message);
    }
  };

  const openRescheduleModal = (lead: Lead) => {
    setSelectedLead(lead);
    setActionReason('Reschedule');
    setActionNote('');
    setIsRescheduleModalOpen(true);
  };

  const handleConfirmReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;

    try {
      await DB.updateLeadStatus(selectedLead.id, 'Waiting List', {
        reason: actionReason,
        note: actionNote.trim() || `Dialihkan ke Waiting List (${actionReason}).`,
        nextFollowUp: actionNextDate,
        actor: user?.name || 'System Admin'
      });
      alert('Peluang dipindahkan ke Waiting List.');
      setIsRescheduleModalOpen(false);
      setActionNote('');
      loadData();
    } catch (e: any) {
      alert('Gagal reschedule: ' + e.message);
    }
  };

  const openFollowUpModal = (lead: Lead) => {
    setSelectedLead(lead);
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString().split('T')[0];
    setActionNextDate(tomorrow);
    setActionNote('');
    setIsFollowUpModalOpen(true);
  };

  const handleRecordFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;

    try {
      await DB.updateLead(selectedLead.id, {
        next_follow_up_date: actionNextDate
      });

      await DB.insertLeadActivity({
        lead_id: selectedLead.id,
        action_type: 'follow_up',
        note: actionNote.trim() || 'Follow-up rutin telah dilakukan.',
        actor: user?.name || 'System Admin',
        previous_status: selectedLead.status,
        new_status: selectedLead.status
      });

      alert('Aktivitas follow-up tersimpan!');
      setIsFollowUpModalOpen(false);
      loadData();
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  const handleCompleteTraining = async (lead: Lead) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Konfirmasi Selesai Training',
      message: `Tandai bahwa kebutuhan training "${lead.program_name}" untuk ${lead.contact_name} (${lead.company_name}) telah selesai dilaksanakan?`,
      confirmLabel: 'Konfirmasi Selesai',
      type: 'info',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        try {
          await DB.updateLeadStatus(lead.id, 'Selesai Training', {
            note: 'Keikutsertaan peserta dan pelaksanaan batch pelatihan telah selesai dikonfirmasi PIC.',
            actor: user?.name || 'System Admin'
          });
          loadData();
        } catch (e: any) {
          alert('Error: ' + e.message);
        }
      }
    });
  };

  const openCancelModal = (lead: Lead) => {
    setSelectedLead(lead);
    setActionNote('');
    setIsCancelModalOpen(true);
  };

  const handleConfirmCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;

    try {
      await DB.updateLeadStatus(selectedLead.id, 'Batal', {
        cancelReason: actionNote.trim() || 'Dibatalkan oleh PIC / Peserta',
        actor: user?.name || 'System Admin'
      });
      alert('Peluang ditandai Batal.');
      setIsCancelModalOpen(false);
      loadData();
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  const handleDeleteLead = (id: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Hapus Lead',
      message: 'Apakah Anda yakin ingin menghapus data lead ini beserta seluruh riwayat aktivitasnya?',
      confirmLabel: 'Hapus Permanen',
      type: 'danger',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        try {
          await DB.deleteLead(id);
          alert('Lead berhasil dihapus.');
          setIsDetailDrawerOpen(false);
          loadData();
        } catch (e: any) {
          alert('Error: ' + e.message);
        }
      }
    });
  };

  // WhatsApp quick launch
  const handleOpenWA = (lead: Lead, templateType: 'offer' | 'link' | 'reminder' | 'confirmed') => {
    let text = '';
    const params = {
      contactName: lead.contact_name,
      companyName: lead.company_name,
      programName: lead.program_name,
      batchCode: lead.batch_code,
      picName: user?.name || 'Tim BKI Academy'
    };

    if (templateType === 'offer') {
      text = WATemplates.scheduleOffer(params);
    } else if (templateType === 'link') {
      text = WATemplates.registrationLink(params);
    } else if (templateType === 'reminder') {
      text = WATemplates.followUpReminder(params);
    } else if (templateType === 'confirmed') {
      text = WATemplates.registrationConfirmed(params);
    }

    const waUrl = createWhatsAppUrl(lead.contact_phone, text);
    window.open(waUrl, '_blank');
  };

  return (
    <DashboardLayout pageTitle="Leads & Waiting List Management">
      <div className="space-y-6">
        {/* Top Header Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600 text-2xl">person_search</span>
              Leads & Opportunity Pipeline
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Kelola prospek dari WhatsApp dan form pendaftaran, jadwalkan follow-up harian, dan pantau kebutuhan waiting list.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="cms-btn-primary bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs px-3.5 py-2.5 rounded-lg flex items-center gap-2 shadow-sm transition"
            >
              <span className="material-symbols-outlined text-base">add_circle</span>
              Input Lead Baru
            </button>
          </div>
        </div>

        {/* KPI Mini-Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div
            onClick={() => setStatusFilter('')}
            className={`bg-white border rounded-xl p-3.5 shadow-sm cursor-pointer transition hover:border-blue-400 ${
              statusFilter === '' ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200'
            }`}
          >
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Peluang</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{totalLeads}</p>
          </div>

          <div
            onClick={() => setStatusFilter('Baru')}
            className={`bg-white border rounded-xl p-3.5 shadow-sm cursor-pointer transition hover:border-blue-400 ${
              statusFilter === 'Baru' ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200'
            }`}
          >
            <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider">Lead Baru</p>
            <p className="text-xl font-bold text-blue-700 mt-1">{baruCount}</p>
          </div>

          <div
            onClick={() => setStatusFilter('Waiting List')}
            className={`bg-white border rounded-xl p-3.5 shadow-sm cursor-pointer transition hover:border-amber-400 ${
              statusFilter === 'Waiting List' ? 'border-amber-500 ring-2 ring-amber-100' : 'border-slate-200'
            }`}
          >
            <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider">Waiting List</p>
            <p className="text-xl font-bold text-amber-700 mt-1">{waitingListCount}</p>
          </div>

          <div
            onClick={() => setStatusFilter('Link Terkirim')}
            className={`bg-white border rounded-xl p-3.5 shadow-sm cursor-pointer transition hover:border-indigo-400 ${
              statusFilter === 'Link Terkirim' ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-slate-200'
            }`}
          >
            <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider">Link Terkirim</p>
            <p className="text-xl font-bold text-indigo-700 mt-1">{linkSentCount}</p>
          </div>

          <div
            onClick={() => setStatusFilter('Terdaftar')}
            className={`bg-white border rounded-xl p-3.5 shadow-sm cursor-pointer transition hover:border-emerald-400 ${
              statusFilter === 'Terdaftar' ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-slate-200'
            }`}
          >
            <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">Terdaftar</p>
            <p className="text-xl font-bold text-emerald-700 mt-1">{registeredCount}</p>
          </div>

          <div
            onClick={() => setOnlyOverdue(!onlyOverdue)}
            className={`bg-white border rounded-xl p-3.5 shadow-sm cursor-pointer transition hover:border-red-400 ${
              onlyOverdue ? 'border-red-500 ring-2 ring-red-100' : 'border-slate-200'
            }`}
          >
            <p className="text-[10px] font-semibold text-red-600 uppercase tracking-wider">Follow-up Overdue</p>
            <p className="text-xl font-bold text-red-700 mt-1">{overdueCount}</p>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">search</span>
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Cari kontak, PT, WA, program..."
                className="cms-input pl-9 text-xs"
              />
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="cms-input text-xs"
              >
                <option value="">Semua Status</option>
                <option value="Baru">Baru</option>
                <option value="Waiting List">Waiting List</option>
                <option value="Jadwal Ditawarkan">Jadwal Ditawarkan</option>
                <option value="Link Terkirim">Link Terkirim</option>
                <option value="Terdaftar">Terdaftar</option>
                <option value="Selesai Training">Selesai Training</option>
                <option value="Batal">Batal</option>
              </select>
            </div>

            {/* PIC Filter */}
            <div>
              <select
                value={picFilter}
                onChange={e => setPicFilter(e.target.value)}
                className="cms-input text-xs"
              >
                <option value="">Semua PIC Staf</option>
                {uniquePics.map(pic => (
                  <option key={pic} value={pic}>{pic}</option>
                ))}
              </select>
            </div>

            {/* Program Filter */}
            <div>
              <select
                value={programFilter}
                onChange={e => setProgramFilter(e.target.value)}
                className="cms-input text-xs"
              >
                <option value="">Semua Program Training</option>
                {programs.map(p => (
                  <option key={p.id} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          {(searchTerm || statusFilter || picFilter || programFilter || onlyOverdue) && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
              <span className="text-slate-500">
                Menampilkan <b>{filteredLeads.length}</b> dari {leads.length} leads
              </span>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('');
                  setPicFilter('');
                  setProgramFilter('');
                  setOnlyOverdue(false);
                }}
                className="text-blue-600 hover:underline font-medium"
              >
                Reset Filter
              </button>
            </div>
          )}
        </div>

        {/* Main Leads Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto table-scroll">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Kontak / Perusahaan</th>
                  <th className="py-3.5 px-4">Program & Kursi</th>
                  <th className="py-3.5 px-4">Status & Alasan</th>
                  <th className="py-3.5 px-4">Jadwal Follow-up</th>
                  <th className="py-3.5 px-4">PIC Staf</th>
                  <th className="py-3.5 px-4 text-center">Aksi Cepat</th>
                  <th className="py-3.5 px-4 text-right">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="flex justify-center items-center gap-2">
                        <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
                        <span>Memuat data leads...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <span className="material-symbols-outlined text-3xl mb-1 text-slate-300">inbox</span>
                      <p className="font-medium text-slate-600">Tidak ada lead yang cocok dengan filter</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Coba ubah filter pencarian atau input lead baru.</p>
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map(lead => {
                    const overdue = isOverdue(lead.next_follow_up_date) && lead.status !== 'Selesai Training' && lead.status !== 'Batal';
                    const isToday = lead.next_follow_up_date === todayStr;

                    return (
                      <tr key={lead.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Contact & Company */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                            {lead.contact_name}
                            <span className="text-[10px] text-slate-400 font-normal">({lead.source})</span>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate max-w-[200px]">{lead.company_name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-blue-600 font-mono">{lead.contact_phone}</span>
                            {lead.contact_email && (
                              <span className="text-[10px] text-slate-400 truncate max-w-[120px]">{lead.contact_email}</span>
                            )}
                          </div>
                        </td>

                        {/* Program & Seats */}
                        <td className="py-3.5 px-4">
                          <p className="font-medium text-slate-900">{lead.program_name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-semibold border border-blue-100">
                              Estimasi: {lead.estimated_seats} pax
                            </span>
                            {lead.confirmed_seats ? (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-100">
                                Pasti: {lead.confirmed_seats} pax
                              </span>
                            ) : null}
                          </div>
                          {lead.batch_code && (
                            <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Batch: {lead.batch_code}</p>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <div>{getStatusBadge(lead.status)}</div>
                          {lead.waiting_reason && (
                            <p className="text-[10px] text-amber-700 font-medium mt-1 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[12px]">info</span>
                              {lead.waiting_reason}
                            </p>
                          )}
                          {lead.cancel_reason && (
                            <p className="text-[10px] text-slate-400 mt-1 italic truncate max-w-[150px]">{lead.cancel_reason}</p>
                          )}
                        </td>

                        {/* Follow-up Date */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-semibold ${overdue ? 'text-red-600' : isToday ? 'text-amber-600 font-bold' : 'text-slate-700'}`}>
                              {lead.next_follow_up_date || '-'}
                            </span>
                          </div>
                          {overdue && (
                            <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded bg-red-100 text-red-700 font-semibold text-[9px] uppercase tracking-wide">
                              Terlambat
                            </span>
                          )}
                          {isToday && (
                            <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-semibold text-[9px] uppercase tracking-wide">
                              Hari Ini
                            </span>
                          )}
                        </td>

                        {/* PIC */}
                        <td className="py-3.5 px-4">
                          <p className="font-medium text-slate-800 text-xs">{lead.pic_staff_name}</p>
                        </td>

                        {/* Quick Actions (WA & Status Transitions) */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {/* WhatsApp Button with Template Menu */}
                            <div className="relative group">
                              <button
                                title="Buka WhatsApp"
                                onClick={() => handleOpenWA(lead, 'offer')}
                                className="w-7 h-7 rounded-lg bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-600 flex items-center justify-center border border-emerald-200 transition"
                              >
                                <span className="material-symbols-outlined text-base">chat</span>
                              </button>

                              {/* Dropdown Menu Template WA */}
                              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 hidden group-hover:flex flex-col bg-white border border-slate-200 rounded-lg shadow-xl p-1 w-48 z-30 text-left">
                                <p className="px-2 py-1 text-[9px] font-bold text-slate-400 uppercase border-b border-slate-100">
                                  Pilih Template WA:
                                </p>
                                <button
                                  onClick={() => handleOpenWA(lead, 'offer')}
                                  className="px-2 py-1.5 hover:bg-slate-50 text-slate-700 text-[11px] rounded text-left flex items-center gap-1.5"
                                >
                                  <span className="material-symbols-outlined text-xs text-blue-500">schedule</span>
                                  1. Tawarkan Jadwal
                                </button>
                                <button
                                  onClick={() => handleOpenWA(lead, 'link')}
                                  className="px-2 py-1.5 hover:bg-slate-50 text-slate-700 text-[11px] rounded text-left flex items-center gap-1.5"
                                >
                                  <span className="material-symbols-outlined text-xs text-indigo-500">link</span>
                                  2. Kirim Link Formulir
                                </button>
                                <button
                                  onClick={() => handleOpenWA(lead, 'reminder')}
                                  className="px-2 py-1.5 hover:bg-slate-50 text-slate-700 text-[11px] rounded text-left flex items-center gap-1.5"
                                >
                                  <span className="material-symbols-outlined text-xs text-amber-500">notifications</span>
                                  3. Pengingat Pendaftaran
                                </button>
                                <button
                                  onClick={() => handleOpenWA(lead, 'confirmed')}
                                  className="px-2 py-1.5 hover:bg-slate-50 text-slate-700 text-[11px] rounded text-left flex items-center gap-1.5"
                                >
                                  <span className="material-symbols-outlined text-xs text-emerald-500">check_circle</span>
                                  4. Konfirmasi Terdaftar
                                </button>
                              </div>
                            </div>

                            {/* Mark Link Sent */}
                            {lead.status === 'Baru' && (
                              <button
                                title="Tandai Link Terkirim"
                                onClick={() => handleMarkLinkSent(lead)}
                                className="px-2 py-1 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 border border-indigo-200 rounded text-[10px] font-semibold transition"
                              >
                                Link Terkirim
                              </button>
                            )}

                            {/* Confirm Registered */}
                            {(lead.status === 'Baru' || lead.status === 'Link Terkirim' || lead.status === 'Waiting List' || lead.status === 'Jadwal Ditawarkan') && (
                              <button
                                title="Konfirmasi Terdaftar"
                                onClick={() => openRegisterModal(lead)}
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 border border-emerald-200 rounded text-[10px] font-semibold transition"
                              >
                                Konfirmasi
                              </button>
                            )}

                            {/* Move to Waiting List / Reschedule */}
                            {lead.status !== 'Waiting List' && lead.status !== 'Selesai Training' && lead.status !== 'Batal' && (
                              <button
                                title="Reschedule / Waiting List"
                                onClick={() => openRescheduleModal(lead)}
                                className="w-7 h-7 rounded-lg bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-700 flex items-center justify-center border border-amber-200 transition"
                              >
                                <span className="material-symbols-outlined text-sm">schedule_send</span>
                              </button>
                            )}

                            {/* Mark Training Complete */}
                            {lead.status === 'Terdaftar' && (
                              <button
                                title="Selesai Training"
                                onClick={() => handleCompleteTraining(lead)}
                                className="px-2 py-1 bg-green-50 hover:bg-green-600 hover:text-white text-green-700 border border-green-200 rounded text-[10px] font-semibold transition"
                              >
                                Selesai
                              </button>
                            )}

                            {/* Routine Follow-up */}
                            {lead.status !== 'Selesai Training' && lead.status !== 'Batal' && (
                              <button
                                title="Catat Follow-up"
                                onClick={() => openFollowUpModal(lead)}
                                className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-slate-700 hover:text-white text-slate-600 flex items-center justify-center border border-slate-200 transition"
                              >
                                <span className="material-symbols-outlined text-sm">event_repeat</span>
                              </button>
                            )}
                          </div>
                        </td>

                        {/* View Details Drawer */}
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => openLeadDetail(lead)}
                            className="text-slate-400 hover:text-blue-600 p-1 rounded-md hover:bg-slate-100 transition"
                          >
                            <span className="material-symbols-outlined text-lg">chevron_right</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: Input Lead Baru */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600 text-lg">add_circle</span>
                  Input Lead / Peluang Training Baru
                </h3>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              <form onSubmit={handleCreateLead} className="p-5 space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nama Kontak PIC *</label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Budi Santoso"
                      value={newContactName}
                      onChange={e => setNewContactName(e.target.value)}
                      className="cms-input text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">No. WhatsApp / HP *</label>
                    <input
                      type="tel"
                      required
                      placeholder="Contoh: 08123456789"
                      value={newContactPhone}
                      onChange={e => setNewContactPhone(e.target.value)}
                      className="cms-input text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Perusahaan / Instansi</label>
                    <input
                      type="text"
                      placeholder="Contoh: PT Pertamina Shipping (atau Pribadi)"
                      value={newCompanyName}
                      onChange={e => setNewCompanyName(e.target.value)}
                      className="cms-input text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Email Kontak (Opsional)</label>
                    <input
                      type="email"
                      placeholder="budi@perusahaan.com"
                      value={newContactEmail}
                      onChange={e => setNewContactEmail(e.target.value)}
                      className="cms-input text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">Program Training Diminati *</label>
                    <input
                      type="text"
                      required
                      list="programSuggestions"
                      placeholder="Pilih atau ketik program..."
                      value={newProgramName}
                      onChange={e => setNewProgramName(e.target.value)}
                      className="cms-input text-xs"
                    />
                    <datalist id="programSuggestions">
                      {programs.map(p => (
                        <option key={p.id} value={p.name} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Estimasi Kursi</label>
                    <input
                      type="number"
                      min={1}
                      value={newEstimatedSeats}
                      onChange={e => setNewEstimatedSeats(Number(e.target.value))}
                      className="cms-input text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Sumber Lead</label>
                    <select
                      value={newSource}
                      onChange={e => setNewSource(e.target.value as LeadSource)}
                      className="cms-input text-xs"
                    >
                      <option value="WA Bisnis">WhatsApp Bisnis</option>
                      <option value="WA Pribadi">WhatsApp Pribadi Staf</option>
                      <option value="Website">Website BKI Academy</option>
                      <option value="Referral">Rekomendasi / Referral</option>
                      <option value="Event">Event / Seminar</option>
                      <option value="Lainnya">Lainnya</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Target Follow-up Berikutnya *</label>
                    <input
                      type="date"
                      required
                      value={newNextFollowUp}
                      onChange={e => setNewNextFollowUp(e.target.value)}
                      className="cms-input text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Catatan Kebutuhan / Preferensi Jadwal</label>
                  <textarea
                    rows={2}
                    placeholder="Contoh: Membutuhkan jadwal offline di Jakarta untuk 5 inspektur pada bulan Oktober..."
                    value={newNotes}
                    onChange={e => setNewNotes(e.target.value)}
                    className="cms-input text-xs"
                  />
                </div>

                <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-medium"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="cms-btn-primary bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-xs"
                  >
                    Simpan Lead
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Konfirmasi Terdaftar */}
        {isRegisterModalOpen && selectedLead && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-4 border-b border-slate-200 bg-emerald-50 text-emerald-900 flex justify-between items-center">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600">verified</span>
                  Konfirmasi Pendaftaran Peserta
                </h3>
                <button onClick={() => setIsRegisterModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>

              <form onSubmit={handleConfirmRegistration} className="p-5 space-y-3.5 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <p className="font-semibold text-slate-800">{selectedLead.contact_name}</p>
                  <p className="text-slate-500 text-[11px]">{selectedLead.company_name} — {selectedLead.program_name}</p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Pilih Batch Pelatihan yang Dituju</label>
                  <select
                    value={actionBatchId}
                    onChange={e => setActionBatchId(e.target.value)}
                    className="cms-input text-xs"
                  >
                    <option value="">-- Buat / Hubungkan Nanti --</option>
                    {trainings.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.program_name} — {t.batch_code} ({t.start_date})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jumlah Peserta Terkonfirmasi (Pax)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={actionConfirmedSeats}
                    onChange={e => setActionConfirmedSeats(Number(e.target.value))}
                    className="cms-input text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Catatan Konfirmasi PIC</label>
                  <textarea
                    rows={2}
                    placeholder="Contoh: Formulir sudah diperiksa, 3 nama peserta telah terdaftar resmi."
                    value={actionNote}
                    onChange={e => setActionNote(e.target.value)}
                    className="cms-input text-xs"
                  />
                </div>

                <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsRegisterModalOpen(false)}
                    className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="cms-btn-primary bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-lg text-xs"
                  >
                    Konfirmasi Terdaftar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Reschedule / Waiting List */}
        {isRescheduleModalOpen && selectedLead && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-4 border-b border-slate-200 bg-amber-50 text-amber-900 flex justify-between items-center">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-600">schedule_send</span>
                  Alihkan ke Waiting List / Reschedule
                </h3>
                <button onClick={() => setIsRescheduleModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>

              <form onSubmit={handleConfirmReschedule} className="p-5 space-y-3.5 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Alasan Masuk Waiting List</label>
                  <select
                    value={actionReason}
                    onChange={e => setActionReason(e.target.value as WaitingReason)}
                    className="cms-input text-xs"
                  >
                    <option value="Reschedule">Reschedule (Ganti Batch/Jadwal)</option>
                    <option value="Belum Ada Jadwal">Belum Ada Jadwal Cocok</option>
                    <option value="Menunggu Konfirmasi Internal">Menunggu Konfirmasi Internal Klien</option>
                    <option value="Budgeting">Menunggu Persetujuan Anggaran</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Pengecekan / Follow-up Berikutnya</label>
                  <input
                    type="date"
                    required
                    value={actionNextDate}
                    onChange={e => setActionNextDate(e.target.value)}
                    className="cms-input text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Catatan Tambahan</label>
                  <textarea
                    rows={2}
                    placeholder="Contoh: Peserta meminta digeser ke batch November karena bentrok jadwal dinas kapal..."
                    value={actionNote}
                    onChange={e => setActionNote(e.target.value)}
                    className="cms-input text-xs"
                  />
                </div>

                <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsRescheduleModalOpen(false)}
                    className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs"
                  >
                    Tutup
                  </button>
                  <button
                    type="submit"
                    className="cms-btn-primary bg-amber-600 hover:bg-amber-700 text-white font-medium px-4 py-2 rounded-lg text-xs"
                  >
                    Simpan ke Waiting List
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Catat Follow-up Rutin */}
        {isFollowUpModalOpen && selectedLead && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600">event_repeat</span>
                  Catat Aktivitas Follow-up
                </h3>
                <button onClick={() => setIsFollowUpModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>

              <form onSubmit={handleRecordFollowUp} className="p-5 space-y-3.5 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <p className="font-semibold text-slate-800">{selectedLead.contact_name} ({selectedLead.contact_phone})</p>
                  <p className="text-slate-500 text-[11px]">{selectedLead.program_name}</p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Hasil Follow-up / Catatan Respon</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Contoh: Sudah dihubungi via WA, PIC sedang mengumpulkan data KTP calon peserta..."
                    value={actionNote}
                    onChange={e => setActionNote(e.target.value)}
                    className="cms-input text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jadwal Tindak Lanjut Berikutnya</label>
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
                    Simpan Catatan
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Batalkan Peluang */}
        {isCancelModalOpen && selectedLead && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-4 border-b border-slate-200 bg-red-50 text-red-900 flex justify-between items-center">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-red-600">cancel</span>
                  Batalkan Peluang Training
                </h3>
                <button onClick={() => setIsCancelModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>

              <form onSubmit={handleConfirmCancel} className="p-5 space-y-3.5 text-xs">
                <p className="text-slate-600">
                  Anda akan menandai peluang untuk <b>{selectedLead.contact_name}</b> sebagai <b>Batal</b>.
                </p>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Alasan Pembatalan *</label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Contoh: Anggaran dibatalkan perusahaan / memilih provider lain..."
                    value={actionNote}
                    onChange={e => setActionNote(e.target.value)}
                    className="cms-input text-xs"
                  />
                </div>

                <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCancelModalOpen(false)}
                    className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="cms-btn-primary bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg text-xs"
                  >
                    Konfirmasi Batal
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Slide-over Drawer: Detail Lead & Riwayat Aktivitas */}
        {isDetailDrawerOpen && selectedLead && (
          <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end">
            <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
              {/* Drawer Header */}
              <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Detail Lead</span>
                  <h3 className="font-bold text-slate-900 text-sm leading-tight">{selectedLead.contact_name}</h3>
                </div>
                <button
                  onClick={() => setIsDetailDrawerOpen(false)}
                  className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs table-scroll">
                {/* Status Card */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Status Saat Ini</span>
                    <div className="mt-1">{getStatusBadge(selectedLead.status)}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Target Follow-up</span>
                    <p className={`font-bold mt-1 ${isOverdue(selectedLead.next_follow_up_date) ? 'text-red-600' : 'text-slate-800'}`}>
                      {selectedLead.next_follow_up_date}
                    </p>
                  </div>
                </div>

                {/* Info Fields */}
                <div className="space-y-3 bg-white p-3.5 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Perusahaan / Instansi</span>
                    <p className="font-semibold text-slate-900 mt-0.5">{selectedLead.company_name}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Program Training</span>
                    <p className="font-semibold text-slate-900 mt-0.5">{selectedLead.program_name}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Estimasi Kursi</span>
                      <p className="font-semibold text-slate-900 mt-0.5">{selectedLead.estimated_seats} Pax</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Terkonfirmasi</span>
                      <p className="font-semibold text-emerald-600 mt-0.5">{selectedLead.confirmed_seats || 0} Pax</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold">WhatsApp / Telepon</span>
                      <p className="font-mono text-slate-800 mt-0.5">{selectedLead.contact_phone}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold">PIC Staf Internal</span>
                      <p className="font-medium text-slate-800 mt-0.5">{selectedLead.pic_staff_name}</p>
                    </div>
                  </div>
                  {selectedLead.previous_batch_info && (
                    <div className="bg-amber-50 p-2 rounded border border-amber-100 text-[11px] text-amber-800">
                      <b>Riwayat Batch:</b> Reschedule dari {selectedLead.previous_batch_info}
                    </div>
                  )}
                  {selectedLead.notes && (
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Catatan Kebutuhan</span>
                      <p className="text-slate-700 bg-slate-50 p-2 rounded mt-0.5 leading-relaxed">{selectedLead.notes}</p>
                    </div>
                  )}
                </div>

                {/* Quick WhatsApp Actions in Drawer */}
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Aksi Cepat WhatsApp</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleOpenWA(selectedLead, 'offer')}
                      className="px-2.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg border border-emerald-200 flex items-center justify-center gap-1.5 transition text-[11px] font-medium"
                    >
                      <span className="material-symbols-outlined text-sm">schedule</span>
                      Kirim Jadwal
                    </button>
                    <button
                      onClick={() => handleOpenWA(selectedLead, 'link')}
                      className="px-2.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-lg border border-indigo-200 flex items-center justify-center gap-1.5 transition text-[11px] font-medium"
                    >
                      <span className="material-symbols-outlined text-sm">link</span>
                      Kirim Link Form
                    </button>
                    <button
                      onClick={() => handleOpenWA(selectedLead, 'reminder')}
                      className="px-2.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg border border-amber-200 flex items-center justify-center gap-1.5 transition text-[11px] font-medium"
                    >
                      <span className="material-symbols-outlined text-sm">notifications</span>
                      Follow-up Reminder
                    </button>
                    <button
                      onClick={() => handleOpenWA(selectedLead, 'confirmed')}
                      className="px-2.5 py-2 bg-green-50 hover:bg-green-100 text-green-800 rounded-lg border border-green-200 flex items-center justify-center gap-1.5 transition text-[11px] font-medium"
                    >
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      Konfirmasi Terdaftar
                    </button>
                  </div>
                </div>

                {/* Audit Trail / Activities Timeline */}
                <div>
                  <div className="flex justify-between items-center mb-2.5">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Riwayat Aktivitas & Catatan</p>
                    <button
                      onClick={() => openFollowUpModal(selectedLead)}
                      className="text-[11px] text-blue-600 hover:underline font-semibold flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">add</span> Catat Aktivitas
                    </button>
                  </div>

                  <div className="space-y-3 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                    {leadActivities.length === 0 ? (
                      <p className="text-slate-400 italic text-center py-4">Belum ada riwayat aktivitas.</p>
                    ) : (
                      leadActivities.map(act => (
                        <div key={act.id} className="relative flex items-start gap-3 pl-1">
                          <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 z-10 ring-4 ring-white shadow-xs">
                            <span className="material-symbols-outlined text-[10px]">edit_note</span>
                          </div>
                          <div className="flex-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                            <div className="flex justify-between items-center">
                              <span className="font-semibold text-slate-800 text-[11px]">{act.actor}</span>
                              <span className="text-[10px] text-slate-400">
                                {new Date(act.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-slate-600 mt-1 leading-snug">{act.note}</p>
                            {act.new_status && act.previous_status && act.new_status !== act.previous_status && (
                              <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                                <span className="text-slate-400">{act.previous_status}</span>
                                <span className="material-symbols-outlined text-[10px]">arrow_forward</span>
                                <span className="text-blue-700 font-semibold">{act.new_status}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Drawer Footer Actions */}
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
                <button
                  onClick={() => openCancelModal(selectedLead)}
                  className="text-red-600 hover:text-red-700 hover:underline text-xs font-semibold flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">cancel</span>
                  Tandai Batal
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDeleteLead(selectedLead.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded transition"
                    title="Hapus Data Lead"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                  <button
                    onClick={() => setIsDetailDrawerOpen(false)}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-medium"
                  >
                    Selesai
                  </button>
                </div>
              </div>
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
