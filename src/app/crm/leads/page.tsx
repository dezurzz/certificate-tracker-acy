'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import Button from '@/components/Button';
import DropdownButton from '@/components/DropdownButton';
import ActionMenu from '@/components/ActionMenu';
import { DB, Lead, LeadStatus, LeadSource, WaitingReason, TrainingProgram, Training, LeadActivity, BKI_TRAINING_PROGRAMS } from '@/lib/db';
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

    return () => {
      window.removeEventListener('bki-db-update', handleUpdate);
    };
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

  // Status Badge Styling matching BKI Academy design system
  const getStatusBadge = (status: LeadStatus) => {
    switch (status) {
      case 'Baru':
        return (
          <span className="cms-badge bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5" />
            Baru
          </span>
        );
      case 'Waiting List':
        return (
          <span className="cms-badge cms-badge-processing">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" />
            Waiting List
          </span>
        );
      case 'Jadwal Ditawarkan':
        return (
          <span className="cms-badge bg-purple-50 text-purple-700 border border-purple-200">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mr-1.5" />
            Ditawarkan
          </span>
        );
      case 'Link Terkirim':
        return (
          <span className="cms-badge bg-indigo-50 text-indigo-700 border border-indigo-200">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-1.5" />
            Link Terkirim
          </span>
        );
      case 'Terdaftar':
        return (
          <span className="cms-badge cms-badge-completed">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
            Terdaftar
          </span>
        );
      case 'Selesai Training':
        return (
          <span className="cms-badge cms-badge-completed">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5" />
            Selesai
          </span>
        );
      case 'Batal':
        return (
          <span className="cms-badge cms-badge-pending">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5" />
            Batal
          </span>
        );
      default:
        return (
          <span className="cms-badge cms-badge-pending">
            {status}
          </span>
        );
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
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6">
          <div>
            <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Leads & Waiting List</h2>
            <p className="text-sm text-slate-500 mt-1">
              Kelola prospek dari WhatsApp dan form pendaftaran, follow-up harian, dan pantau waiting list.
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="primary"
              icon="add"
              onClick={() => setIsAddModalOpen(true)}
            >
              Input Lead Baru
            </Button>
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

        {/* Filters with Search Integrated */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex gap-3 items-center flex-wrap">
          <div className="flex items-center gap-2 text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
            <span className="material-symbols-outlined text-[18px]">filter_list</span>
            Filters:
          </div>

          {/* Search bar */}
          <div className="relative w-full md:w-64">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Cari kontak, PT, WA, program..."
              className="w-full h-9 !pl-10 pr-3 rounded-lg border border-slate-200 bg-slate-50 text-xs focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 transition-all text-slate-800"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="cms-select-filter h-9 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 pl-3 pr-8 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 cursor-pointer min-w-[130px]"
          >
            <option value="">Semua Status</option>
            <option value="Baru">Baru</option>
            <option value="Waiting List">Waiting List</option>
            <option value="Jadwal Ditawarkan">Ditawarkan</option>
            <option value="Link Terkirim">Link Terkirim</option>
            <option value="Terdaftar">Terdaftar</option>
            <option value="Selesai Training">Selesai</option>
            <option value="Batal">Batal</option>
          </select>

          {/* PIC Filter */}
          <select
            value={picFilter}
            onChange={e => setPicFilter(e.target.value)}
            className="cms-select-filter h-9 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 pl-3 pr-8 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 cursor-pointer min-w-[130px]"
          >
            <option value="">Semua PIC</option>
            {uniquePics.map(pic => (
              <option key={pic} value={pic}>{pic}</option>
            ))}
          </select>

          {/* Program Filter */}
          <select
            value={programFilter}
            onChange={e => setProgramFilter(e.target.value)}
            className="cms-select-filter h-9 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 pl-3 pr-8 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 cursor-pointer max-w-[240px] truncate"
          >
            <option value="">Semua Program Training</option>
            {BKI_TRAINING_PROGRAMS.map(progName => (
              <option key={progName} value={progName}>{progName}</option>
            ))}
          </select>

          {/* Overdue Quick Toggle */}
          <button
            type="button"
            onClick={() => setOnlyOverdue(!onlyOverdue)}
            className={`h-9 px-3 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
              onlyOverdue
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">warning</span>
            Overdue
          </button>

          {(searchTerm || statusFilter || picFilter || programFilter || onlyOverdue) && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('');
                setPicFilter('');
                setProgramFilter('');
                setOnlyOverdue(false);
              }}
              className="ml-auto text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
            >
              Reset Filter
            </button>
          )}
        </div>

        {/* Main Leads Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-8">
          <div className="overflow-x-auto table-scroll min-h-[160px]">
            <table className="w-full text-left border-collapse bg-white">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="p-4">Kontak / Perusahaan</th>
                  <th className="p-4">Program & Kursi</th>
                  <th className="p-4">Status & Alasan</th>
                  <th className="p-4">Jadwal Follow-up</th>
                  <th className="p-4">PIC Staf</th>
                  <th className="p-4 text-right pr-6">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-slate-400">
                      <div className="flex justify-center items-center gap-2">
                        <span className="material-symbols-outlined animate-spin text-xl text-blue-600">progress_activity</span>
                        <span>Memuat data leads...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-slate-400">
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
                        <td className="p-4">
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
                        <td className="p-4">
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
                        <td className="p-4">
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
                        <td className="p-4">
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
                        <td className="p-4">
                          <p className="font-medium text-slate-800 text-xs">{lead.pic_staff_name}</p>
                        </td>

                        {/* Actions (WhatsApp Dropdown, Progression Button, and ActionMenu) */}
                        <td className="p-4 text-right pr-6" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            {/* 1. Standardized WhatsApp DropdownButton */}
                            <DropdownButton
                              variant="secondary"
                              size="sm"
                              menuWidth="w-64"
                              align="right"
                              icon={
                                <svg className="w-3.5 h-3.5 fill-emerald-600" viewBox="0 0 24 24">
                                  <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2ZM12.05 20.15C10.57 20.15 9.12 19.75 7.85 19L7.55 18.82L4.43 19.64L5.26 16.6L5.06 16.29C4.24 14.99 3.8 13.47 3.8 11.91C3.8 7.37 7.5 3.67 12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.05 20.15ZM16.57 14.39C16.32 14.27 15.1 13.67 14.88 13.58C14.65 13.5 14.49 13.46 14.32 13.7C14.16 13.95 13.69 14.51 13.54 14.67C13.4 14.83 13.25 14.85 13 14.73C12.75 14.61 11.72 14.27 10.5 13.18C9.55 12.33 8.91 11.28 8.78 11.03C8.66 10.79 8.77 10.65 8.89 10.53C9 10.42 9.14 10.24 9.26 10.1C9.38 9.96 9.42 9.86 9.5 9.7C9.58 9.53 9.54 9.39 9.48 9.27C9.42 9.14 8.93 7.94 8.73 7.44C8.53 6.96 8.33 7.02 8.18 7.01C8.04 7.01 7.87 7.01 7.71 7.01C7.54 7.01 7.28 7.07 7.05 7.32C6.82 7.57 6.18 8.17 6.18 9.39C6.18 10.61 7.07 11.79 7.19 11.95C7.32 12.12 8.95 14.62 11.43 15.69C12.02 15.95 12.48 16.1 12.84 16.21C13.43 16.4 13.97 16.37 14.4 16.31C14.87 16.24 15.85 15.71 16.06 15.14C16.26 14.57 16.26 14.08 16.2 13.98C16.14 13.88 15.99 13.82 15.74 13.7L16.57 14.39Z" />
                                </svg>
                              }
                              headerTitle="Pesan WhatsApp"
                              headerSubtitle={lead.contact_phone}
                              items={[
                                {
                                  label: '1. Tawarkan Jadwal',
                                  description: 'Info jadwal training',
                                  icon: 'event_available',
                                  onClick: () => handleOpenWA(lead, 'offer'),
                                },
                                {
                                  label: '2. Kirim Link Formulir',
                                  description: 'Tautan form registrasi',
                                  icon: 'link',
                                  onClick: () => handleOpenWA(lead, 'link'),
                                },
                                {
                                  label: '3. Follow-up Reminder',
                                  description: 'Pengingat isi formulir',
                                  icon: 'notifications_active',
                                  onClick: () => handleOpenWA(lead, 'reminder'),
                                },
                                {
                                  label: '4. Konfirmasi Terdaftar',
                                  description: 'Notifikasi terdata resmi',
                                  icon: 'check_circle',
                                  onClick: () => handleOpenWA(lead, 'confirmed'),
                                },
                              ]}
                            >
                              WA
                            </DropdownButton>

                            {/* 2. Primary Progression Button */}
                            {lead.status === 'Baru' && (
                              <Button
                                size="sm"
                                variant="secondary"
                                icon="send"
                                onClick={() => handleMarkLinkSent(lead)}
                                className="!text-indigo-600 !border-indigo-200 hover:!bg-indigo-50"
                                title="Tandai Formulir Registrasi Telah Dikirim"
                              >
                                Kirim Link
                              </Button>
                            )}

                            {(lead.status === 'Link Terkirim' || lead.status === 'Waiting List' || lead.status === 'Jadwal Ditawarkan') && (
                              <Button
                                size="sm"
                                variant="primary"
                                icon="how_to_reg"
                                onClick={() => openRegisterModal(lead)}
                                title="Konfirmasi Pendaftaran ke Batch Training"
                              >
                                Konfirmasi
                              </Button>
                            )}

                            {lead.status === 'Terdaftar' && (
                              <Button
                                size="sm"
                                variant="success"
                                icon="school"
                                onClick={() => handleCompleteTraining(lead)}
                                title="Tandai Pelatihan Selesai & Lanjut ke Cetak Sertifikat"
                              >
                                Selesai
                              </Button>
                            )}

                            {/* 3. Standardized ActionMenu (matches certificates more_vert) */}
                            <ActionMenu
                              align="right"
                              menuWidth="w-52"
                              items={[
                                ...(lead.status !== 'Selesai Training' && lead.status !== 'Batal' ? [
                                  {
                                    label: 'Jadwalkan Follow-up',
                                    icon: 'calendar_clock',
                                    onClick: () => openFollowUpModal(lead),
                                  },
                                ] : []),
                                ...(lead.status !== 'Waiting List' && lead.status !== 'Selesai Training' && lead.status !== 'Batal' ? [
                                  {
                                    label: 'Pindah ke Waiting List',
                                    icon: 'hourglass_top',
                                    onClick: () => openRescheduleModal(lead),
                                  },
                                ] : []),
                                {
                                  label: 'Lihat Detail Lengkap',
                                  icon: 'visibility',
                                  onClick: () => openLeadDetail(lead),
                                },
                                'divider',
                                ...(lead.status !== 'Selesai Training' && lead.status !== 'Batal' ? [
                                  {
                                    label: 'Tandai Batal',
                                    icon: 'cancel',
                                    variant: 'danger' as const,
                                    onClick: () => openCancelModal(lead),
                                  },
                                ] : []),
                                {
                                  label: 'Hapus Lead',
                                  icon: 'delete',
                                  variant: 'danger' as const,
                                  onClick: () => handleDeleteLead(lead.id),
                                },
                              ]}
                            />
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
                    <label className="block font-semibold text-slate-700 mb-1">
                      Nama Kontak PIC <span className="text-red-500 font-semibold">*</span>
                    </label>
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
                    <label className="block font-semibold text-slate-700 mb-1">
                      No. WhatsApp / HP <span className="text-red-500 font-semibold">*</span>
                    </label>
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
                    <label className="block font-semibold text-slate-700 mb-1">
                      Perusahaan / Instansi <span className="text-slate-400 font-normal text-xs">(Opsional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: PT Pertamina Shipping (atau Pribadi)"
                      value={newCompanyName}
                      onChange={e => setNewCompanyName(e.target.value)}
                      className="cms-input text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Email Kontak <span className="text-slate-400 font-normal text-xs">(Opsional)</span>
                    </label>
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
                    <label className="block font-semibold text-slate-700 mb-1">
                      Program Training Diminati <span className="text-red-500 font-semibold">*</span>
                    </label>
                    <select
                      required
                      value={newProgramName}
                      onChange={e => setNewProgramName(e.target.value)}
                      className="cms-input text-xs font-medium text-slate-800"
                    >
                      <option value="">-- Pilih Program Training --</option>
                      {BKI_TRAINING_PROGRAMS.map((progName) => (
                        <option key={progName} value={progName}>
                          {progName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Estimasi Kursi <span className="text-slate-400 font-normal text-xs">(Opsional)</span>
                    </label>
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
                    <label className="block font-semibold text-slate-700 mb-1">
                      Sumber Lead <span className="text-slate-400 font-normal text-xs">(Opsional)</span>
                    </label>
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
                    <label className="block font-semibold text-slate-700 mb-1">
                      Target Follow-up Berikutnya <span className="text-red-500 font-semibold">*</span>
                    </label>
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
                  <label className="block font-semibold text-slate-700 mb-1">
                    Catatan Kebutuhan / Preferensi Jadwal <span className="text-slate-400 font-normal text-xs">(Opsional)</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Contoh: Membutuhkan jadwal offline di Jakarta untuk 5 inspektur pada bulan Oktober..."
                    value={newNotes}
                    onChange={e => setNewNotes(e.target.value)}
                    className="cms-input text-xs"
                  />
                </div>

                <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAddModalOpen(false)}
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    icon="save"
                  >
                    Simpan Lead
                  </Button>
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
                  <label className="block font-semibold text-slate-700 mb-1">
                    Pilih Batch Pelatihan yang Dituju <span className="text-slate-400 font-normal text-xs">(Opsional)</span>
                  </label>
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
                  <label className="block font-semibold text-slate-700 mb-1">
                    Jumlah Peserta Terkonfirmasi (Pax) <span className="text-red-500 font-semibold">*</span>
                  </label>
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
                  <label className="block font-semibold text-slate-700 mb-1">
                    Catatan Konfirmasi PIC <span className="text-slate-400 font-normal text-xs">(Opsional)</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Contoh: Formulir sudah diperiksa, 3 nama peserta telah terdaftar resmi."
                    value={actionNote}
                    onChange={e => setActionNote(e.target.value)}
                    className="cms-input text-xs"
                  />
                </div>

                <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsRegisterModalOpen(false)}
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    variant="success"
                    size="sm"
                    icon="check"
                  >
                    Konfirmasi Terdaftar
                  </Button>
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
                  <label className="block font-semibold text-slate-700 mb-1">
                    Alasan Masuk Waiting List <span className="text-red-500 font-semibold">*</span>
                  </label>
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
                  <label className="block font-semibold text-slate-700 mb-1">
                    Target Pengecekan / Follow-up Berikutnya <span className="text-red-500 font-semibold">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={actionNextDate}
                    onChange={e => setActionNextDate(e.target.value)}
                    className="cms-input text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Catatan Tambahan <span className="text-slate-400 font-normal text-xs">(Opsional)</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Contoh: Peserta meminta digeser ke batch November karena bentrok jadwal dinas kapal..."
                    value={actionNote}
                    onChange={e => setActionNote(e.target.value)}
                    className="cms-input text-xs"
                  />
                </div>

                <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsRescheduleModalOpen(false)}
                  >
                    Tutup
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    icon="hourglass_top"
                    className="!bg-amber-600 hover:!bg-amber-700"
                  >
                    Simpan ke Waiting List
                  </Button>
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
                  <label className="block font-semibold text-slate-700 mb-1">
                    Hasil Follow-up / Catatan Respon <span className="text-red-500 font-semibold">*</span>
                  </label>
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
                  <label className="block font-semibold text-slate-700 mb-1">
                    Jadwal Tindak Lanjut Berikutnya <span className="text-red-500 font-semibold">*</span>
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsFollowUpModalOpen(false)}
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    icon="check"
                  >
                    Simpan Catatan
                  </Button>
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
                  <label className="block font-semibold text-slate-700 mb-1">
                    Alasan Pembatalan <span className="text-red-500 font-semibold">*</span>
                  </label>
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsCancelModalOpen(false)}
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    variant="danger"
                    size="sm"
                    icon="cancel"
                  >
                    Konfirmasi Batal
                  </Button>
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
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="schedule"
                      onClick={() => handleOpenWA(selectedLead, 'offer')}
                      className="!w-full !justify-start !text-emerald-800 !bg-emerald-50 hover:!bg-emerald-100 !border-emerald-200"
                    >
                      Kirim Jadwal
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="link"
                      onClick={() => handleOpenWA(selectedLead, 'link')}
                      className="!w-full !justify-start !text-indigo-800 !bg-indigo-50 hover:!bg-indigo-100 !border-indigo-200"
                    >
                      Kirim Link Form
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="notifications"
                      onClick={() => handleOpenWA(selectedLead, 'reminder')}
                      className="!w-full !justify-start !text-amber-800 !bg-amber-50 hover:!bg-amber-100 !border-amber-200"
                    >
                      Follow-up Reminder
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="check_circle"
                      onClick={() => handleOpenWA(selectedLead, 'confirmed')}
                      className="!w-full !justify-start !text-green-800 !bg-green-50 hover:!bg-green-100 !border-green-200"
                    >
                      Konfirmasi Terdaftar
                    </Button>
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
                <Button
                  variant="ghost"
                  size="sm"
                  icon="cancel"
                  onClick={() => openCancelModal(selectedLead)}
                  className="!text-red-600 hover:!bg-red-50"
                >
                  Tandai Batal
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="delete"
                    onClick={() => handleDeleteLead(selectedLead.id)}
                    className="!text-slate-400 hover:!text-red-600"
                    title="Hapus Data Lead"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsDetailDrawerOpen(false)}
                  >
                    Selesai
                  </Button>
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
