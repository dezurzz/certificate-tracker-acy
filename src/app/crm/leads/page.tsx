'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import Button from '@/components/Button';
import DropdownButton from '@/components/DropdownButton';
import ActionMenu from '@/components/ActionMenu';
import PageHeader from '@/components/PageHeader';
import LoadError from '@/components/LoadError';
import StatCard from '@/components/StatCard';
import { DB, Lead, LeadStatus, LeadSource, WaitingReason, Training, LeadActivity, BKI_TRAINING_PROGRAMS } from '@/lib/db';
import { WATemplates, createWhatsAppUrl } from '@/lib/whatsapp';
import ConfirmationModal from '@/components/ConfirmationModal';
import Modal from '@/components/Modal';
import { useAuth, useCan } from '@/context/AuthContext';
import { notify } from '@/lib/notify';
import { useT, useLanguage } from '@/i18n/LanguageContext';
import SortSelect from '@/components/SortSelect';
import FilterBar, { FilterSearch, FilterSelect, FilterDateRange } from '@/components/FilterBar';
import { cmpText, cmpDate, cmpDateDesc, cmpNumberDesc } from '@/lib/sort';
import { TableSkeletonRows, type SkeletonColumn } from '@/components/Skeleton';
import { getErrorMessage } from '@/lib/errors';

const LEAD_SKELETON_COLUMNS: SkeletonColumn[] = [
  'w-4',
  { w: 'w-36', kind: 'twoLine' },
  { w: 'w-40', kind: 'twoLine' },
  { w: 'w-20', kind: 'badge' },
  'w-24',
  { w: 'w-16', kind: 'avatar' },
  { w: '', kind: 'action' },
];

type LeadSortKey = 'newest' | 'oldest' | 'name_asc' | 'name_desc' | 'company_asc' | 'followup_asc' | 'seats_desc' | 'updated';

const LEAD_SOURCES: LeadSource[] = ['WA Bisnis', 'WA Pribadi', 'Website', 'Referral', 'Event', 'Lainnya'];

export default function LeadsPage() {
  const t = useT();
  const { locale } = useLanguage();
  const { user } = useAuth();
  const can = useCan();
  const canWrite = can('data.write');
  const noWriteHint = t('Peran Anda hanya bisa melihat data');

  // Data states
  const [leads, setLeads] = useState<Lead[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [picFilter, setPicFilter] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [sortKey, setSortKey] = useState<LeadSortKey>('newest');
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

  // Bulk status update
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<LeadStatus>('Jadwal Ditawarkan');
  const [bulkReason, setBulkReason] = useState<WaitingReason>('Belum Ada Jadwal');
  const [bulkNextDate, setBulkNextDate] = useState('');
  const [bulkBatchId, setBulkBatchId] = useState('');
  const [bulkNote, setBulkNote] = useState('');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

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
    setLoadError(null);
    try {
      const [leadList, trainList] = await Promise.all([
        DB.getLeads(),
        DB.getTrainings()
      ]);
      setLeads(leadList);
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
      setLoadError(getErrorMessage(e));
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
    if (sourceFilter && l.source !== sourceFilter) return false;
    const created = (l.created_at || '').slice(0, 10);
    if (createdFrom && (!created || created < createdFrom)) return false;
    if (createdTo && (!created || created > createdTo)) return false;
    return true;
  }).sort((a, b) => {
    switch (sortKey) {
      case 'oldest': return cmpDate(a.created_at, b.created_at);
      case 'name_asc': return cmpText(a.contact_name, b.contact_name);
      case 'name_desc': return cmpText(b.contact_name, a.contact_name);
      case 'company_asc': return cmpText(a.company_name, b.company_name);
      case 'followup_asc': return cmpDate(a.next_follow_up_date, b.next_follow_up_date);
      case 'seats_desc': return cmpNumberDesc(a.estimated_seats, b.estimated_seats);
      case 'updated': return cmpDateDesc(a.updated_at, b.updated_at);
      default: return cmpDateDesc(a.created_at, b.created_at);
    }
  });

  // Unique PICs for filter
  const uniquePics = Array.from(new Set(leads.map(l => l.pic_staff_name).filter(Boolean)));

  // Status Badge Styling matching BKI Academy design system
  // Status badge: semantic tones only (info = in progress, warning = waiting,
  // success = registered, neutral = closed)
  const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
    'Baru': { label: t('Baru'), cls: 'cms-badge-info' },
    'Waiting List': { label: t('Waiting List'), cls: 'cms-badge-warning' },
    'Jadwal Ditawarkan': { label: t('Ditawarkan'), cls: 'cms-badge-info' },
    'Link Terkirim': { label: t('Link Terkirim'), cls: 'cms-badge-info' },
    'Terdaftar': { label: t('Terdaftar'), cls: 'cms-badge-success' },
    'Selesai Training': { label: t('Selesai'), cls: 'cms-badge-neutral' },
    'Batal': { label: t('Batal'), cls: 'cms-badge-neutral' },
  };

  const getStatusBadge = (status: LeadStatus) => {
    const cfg = STATUS_BADGE[status] ?? { label: status, cls: 'cms-badge-neutral' };
    return <span className={`cms-badge ${cfg.cls}`}>{cfg.label}</span>;
  };

  // ---- Bulk status update ----
  const BULK_TARGETS: { value: LeadStatus; label: string }[] = [
    { value: 'Jadwal Ditawarkan', label: t('Ditawarkan') },
    { value: 'Link Terkirim', label: t('Link Terkirim') },
    { value: 'Waiting List', label: t('Waiting List') },
    { value: 'Terdaftar', label: t('Terdaftar') },
    { value: 'Selesai Training', label: t('Selesai') },
    { value: 'Batal', label: t('Batal') },
  ];

  // Why a lead cannot move to `target` (null = eligible)
  const bulkSkipReason = (lead: Lead, target: LeadStatus): string | null => {
    if (lead.status === target) return t('Sudah berstatus ini');
    if (lead.status === 'Batal' || lead.status === 'Selesai Training') return t('Lead sudah ditutup');
    if (target === 'Selesai Training' && lead.status !== 'Terdaftar') return t('Hanya lead Terdaftar yang bisa diselesaikan');
    return null;
  };

  // Only rows currently visible count, so a filter change never hides a selected lead that still gets changed
  const selectedLeads = filteredLeads.filter(l => selectedIds.includes(l.id));
  const bulkEligible = selectedLeads.filter(l => !bulkSkipReason(l, bulkStatus));
  const bulkSkipped = selectedLeads.filter(l => bulkSkipReason(l, bulkStatus));
  const allVisibleSelected = filteredLeads.length > 0 && filteredLeads.every(l => selectedIds.includes(l.id));

  const toggleSelectAll = () =>
    setSelectedIds(allVisibleSelected ? [] : filteredLeads.map(l => l.id));
  const toggleSelectRow = (id: string) =>
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const openBulkModal = () => {
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString().split('T')[0];
    setBulkStatus('Jadwal Ditawarkan');
    setBulkReason('Belum Ada Jadwal');
    setBulkNextDate(tomorrow);
    setBulkBatchId('');
    setBulkNote('');
    setIsBulkOpen(true);
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bulkEligible.length === 0 || bulkSubmitting) return;
    if (bulkStatus === 'Batal' && !bulkNote.trim()) {
      notify.warning(t('Alasan pembatalan wajib diisi.'));
      return;
    }

    const batch = trainings.find(tr => tr.id === bulkBatchId);
    const note = bulkNote.trim() || undefined;
    const withDate = bulkStatus === 'Waiting List' || bulkStatus === 'Link Terkirim' || bulkStatus === 'Jadwal Ditawarkan';

    setBulkSubmitting(true);
    try {
      const { succeeded, failed } = await DB.bulkUpdateLeadStatus(
        bulkEligible.map(l => l.id),
        bulkStatus,
        {
          actor: user?.name || 'System Admin',
          note,
          ...(withDate && bulkNextDate ? { nextFollowUp: bulkNextDate } : {}),
          ...(bulkStatus === 'Waiting List' ? { reason: bulkReason } : {}),
          ...(bulkStatus === 'Batal' ? { cancelReason: bulkNote.trim() } : {}),
          ...(bulkStatus === 'Terdaftar' && batch ? { batchId: batch.id, batchCode: batch.batch_code } : {}),
        },
        // Terdaftar: each lead is confirmed for its own estimated seats
        bulkStatus === 'Terdaftar'
          ? id => ({ confirmedSeats: bulkEligible.find(l => l.id === id)?.estimated_seats })
          : undefined
      );

      if (failed.length === 0) {
        notify.success(t('{count} lead berhasil diubah statusnya.', { count: succeeded.length }));
      } else {
        notify.error(
          t('{ok} berhasil, {fail} gagal diubah.', { ok: succeeded.length, fail: failed.length }),
          failed.slice(0, 3).map(f => f.message).join('; ')
        );
      }
      setIsBulkOpen(false);
      // Keep only the ones that failed selected so they can be retried
      setSelectedIds(failed.map(f => f.id));
    } finally {
      setBulkSubmitting(false);
    }
  };

  // Actions
  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName.trim() || !newContactPhone.trim() || !newProgramName.trim()) {
      notify.warning(t('Nama kontak, nomor WhatsApp/telepon, dan jenis training wajib diisi.'));
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

      notify.success(t('Lead baru berhasil ditambahkan'));
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
    } catch (err) {
      notify.error(t('Gagal menambahkan lead'), getErrorMessage(err));
    }
  };

  const handleMarkLinkSent = async (lead: Lead) => {
    setConfirmConfig({
      isOpen: true,
      title: t('Tandai Link Terkirim'),
      message: t('Konfirmasi bahwa link formulir pendaftaran sudah dikirimkan ke {contact_name}? Status akan diubah menjadi "Link Terkirim".', { contact_name: lead.contact_name }),
      confirmLabel: t('Ya, Tandai Terkirim'),
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
        } catch (e) {
          notify.error(t('Terjadi kesalahan'), getErrorMessage(e));
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
        note: actionNote.trim() || t('Pendaftaran dikonfirmasi untuk {actionConfirmedSeats} peserta.', { actionConfirmedSeats }),
        actor: user?.name || 'System Admin'
      });
      notify.success(t('Pendaftaran berhasil dikonfirmasi'));
      setIsRegisterModalOpen(false);
      setActionNote('');
      loadData();
    } catch (e) {
      notify.error(t('Gagal konfirmasi'), getErrorMessage(e));
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
        note: actionNote.trim() || t('Dialihkan ke Waiting List ({actionReason}).', { actionReason }),
        nextFollowUp: actionNextDate,
        actor: user?.name || 'System Admin'
      });
      notify.success(t('Peluang dipindahkan ke Waiting List.'));
      setIsRescheduleModalOpen(false);
      setActionNote('');
      loadData();
    } catch (e) {
      notify.error(t('Gagal reschedule'), getErrorMessage(e));
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

      notify.success(t('Aktivitas follow-up tersimpan'));
      setIsFollowUpModalOpen(false);
      loadData();
    } catch (e) {
      notify.error(t('Terjadi kesalahan'), getErrorMessage(e));
    }
  };

  const handleCompleteTraining = async (lead: Lead) => {
    setConfirmConfig({
      isOpen: true,
      title: t('Konfirmasi Selesai Training'),
      message: t('Tandai bahwa kebutuhan training "{program_name}" untuk {contact_name} ({company_name}) telah selesai dilaksanakan?', { program_name: lead.program_name, contact_name: lead.contact_name, company_name: lead.company_name }),
      confirmLabel: t('Konfirmasi Selesai'),
      type: 'info',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        try {
          await DB.updateLeadStatus(lead.id, 'Selesai Training', {
            note: 'Keikutsertaan peserta dan pelaksanaan batch pelatihan telah selesai dikonfirmasi PIC.',
            actor: user?.name || 'System Admin'
          });
          loadData();
        } catch (e) {
          notify.error(t('Terjadi kesalahan'), getErrorMessage(e));
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
      notify.success(t('Peluang ditandai Batal.'));
      setIsCancelModalOpen(false);
      loadData();
    } catch (e) {
      notify.error(t('Terjadi kesalahan'), getErrorMessage(e));
    }
  };

  const handleDeleteLead = (id: string) => {
    setConfirmConfig({
      isOpen: true,
      title: t('Hapus Lead'),
      message: t('Apakah Anda yakin ingin menghapus data lead ini beserta seluruh riwayat aktivitasnya?'),
      confirmLabel: t('Hapus Permanen'),
      type: 'danger',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        try {
          await DB.deleteLead(id);
          notify.success(t('Lead berhasil dihapus.'));
          setIsDetailDrawerOpen(false);
          loadData();
        } catch (e) {
          notify.error(t('Terjadi kesalahan'), getErrorMessage(e));
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
        <PageHeader
          title={t('Leads & Waiting List')}
          description={t('Kelola prospek dari WhatsApp dan form pendaftaran, follow-up harian, dan pantau waiting list.')}
          actions={
            <Button variant="primary" icon="add" onClick={() => setIsAddModalOpen(true)} disabled={!canWrite} title={canWrite ? undefined : noWriteHint}>
              {t('Input Lead Baru')}</Button>
          }
        />

        {loadError && <LoadError message={loadError} onRetry={loadData} />}

        {/* KPI filters: click to filter the table */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatCard label={t('Total Peluang')} value={totalLeads} active={statusFilter === '' && !onlyOverdue} onClick={() => { setStatusFilter(''); setOnlyOverdue(false); }} />
          <StatCard label={t('Lead Baru')} value={baruCount} active={statusFilter === 'Baru'} onClick={() => setStatusFilter('Baru')} />
          <StatCard label={t('Waiting List')} value={waitingListCount} active={statusFilter === 'Waiting List'} onClick={() => setStatusFilter('Waiting List')} />
          <StatCard label={t('Link Terkirim')} value={linkSentCount} active={statusFilter === 'Link Terkirim'} onClick={() => setStatusFilter('Link Terkirim')} />
          <StatCard label={t('Terdaftar')} value={registeredCount} active={statusFilter === 'Terdaftar'} onClick={() => setStatusFilter('Terdaftar')} />
          <StatCard
            label={t('Follow-up Overdue')}
            value={overdueCount}
            tone={overdueCount > 0 ? 'danger' : 'default'}
            active={onlyOverdue}
            onClick={() => setOnlyOverdue(!onlyOverdue)}
          />
        </div>

        {/* Filters, search and sorting */}
        <FilterBar
          summary={t('Menampilkan {shown} dari {total} lead', { shown: filteredLeads.length, total: leads.length })}
          hasActive={Boolean(searchTerm || statusFilter || picFilter || programFilter || sourceFilter || createdFrom || createdTo || onlyOverdue)}
          onReset={() => {
            setSearchTerm('');
            setStatusFilter('');
            setPicFilter('');
            setProgramFilter('');
            setSourceFilter('');
            setCreatedFrom('');
            setCreatedTo('');
            setOnlyOverdue(false);
          }}
          sort={
            <SortSelect
              value={sortKey}
              onChange={setSortKey}
              options={[
                { value: 'newest', label: t('Terbaru masuk') },
                { value: 'oldest', label: t('Terlama masuk') },
                { value: 'updated', label: t('Terakhir diperbarui') },
                { value: 'name_asc', label: t('Nama kontak A–Z') },
                { value: 'name_desc', label: t('Nama kontak Z–A') },
                { value: 'company_asc', label: t('Perusahaan A–Z') },
                { value: 'followup_asc', label: t('Follow-up terdekat') },
                { value: 'seats_desc', label: t('Estimasi kursi terbanyak') },
              ]}
            />
          }
        >
          <FilterSearch value={searchTerm} onChange={setSearchTerm} placeholder={t('Cari kontak, PT, WA, program...')} />
          <FilterSelect value={statusFilter} onChange={setStatusFilter} label={t('Filter berdasarkan status')}>
            <option value="">{t('Semua Status')}</option>
            <option value="Baru">{t('Baru')}</option>
            <option value="Waiting List">{t('Waiting List')}</option>
            <option value="Jadwal Ditawarkan">{t('Ditawarkan')}</option>
            <option value="Link Terkirim">{t('Link Terkirim')}</option>
            <option value="Terdaftar">{t('Terdaftar')}</option>
            <option value="Selesai Training">{t('Selesai')}</option>
            <option value="Batal">{t('Batal')}</option>
          </FilterSelect>
          <FilterSelect value={picFilter} onChange={setPicFilter} label={t('Filter berdasarkan PIC')}>
            <option value="">{t('Semua PIC')}</option>
            {uniquePics.map(pic => (
              <option key={pic} value={pic}>{pic}</option>
            ))}
          </FilterSelect>
          <FilterSelect value={programFilter} onChange={setProgramFilter} label={t('Filter berdasarkan program')}>
            <option value="">{t('Semua Program Training')}</option>
            {BKI_TRAINING_PROGRAMS.map(progName => (
              <option key={progName} value={progName}>{progName}</option>
            ))}
          </FilterSelect>
          <FilterSelect value={sourceFilter} onChange={setSourceFilter} label={t('Filter berdasarkan sumber lead')}>
            <option value="">{t('Semua Sumber')}</option>
            {LEAD_SOURCES.map(src => (
              <option key={src} value={src}>{t(src)}</option>
            ))}
          </FilterSelect>
          <FilterDateRange
            from={createdFrom}
            to={createdTo}
            onFromChange={setCreatedFrom}
            onToChange={setCreatedTo}
            label={t('Masuk')}
            fromLabel={t('Tanggal masuk dari')}
            toLabel={t('Tanggal masuk sampai')}
          />
        </FilterBar>

        {/* Main Leads Table */}
        <div className={`bg-card border border-slate-200 rounded-xl shadow-sm overflow-hidden ${selectedLeads.length > 0 ? "mb-24" : "mb-8"}`}>
          <div className="overflow-x-auto table-scroll min-h-[160px]">
            <table className="cms-table w-full text-left border-collapse bg-card">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                  {canWrite && (
                    <th className="p-4 w-10">
                      <input
                        type="checkbox"
                        aria-label={t('Pilih semua lead yang tampil')}
                        checked={allVisibleSelected}
                        onChange={toggleSelectAll}
                        disabled={loading || filteredLeads.length === 0}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/15 cursor-pointer"
                      />
                    </th>
                  )}
                  <th className="p-4">{t('Kontak / Perusahaan')}</th>
                  <th className="p-4">{t('Program & Kursi')}</th>
                  <th className="p-4">{t('Status & Alasan')}</th>
                  <th className="p-4">{t('Jadwal Follow-up')}</th>
                  <th className="p-4">{t('PIC Staf')}</th>
                  <th className="p-4 text-right pr-6">{t('Tindakan')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loading ? (
                  <TableSkeletonRows label={t('Memuat data leads...')} columns={canWrite ? LEAD_SKELETON_COLUMNS : LEAD_SKELETON_COLUMNS.slice(1)} />
                ) : filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={canWrite ? 7 : 6} className="p-12 text-center text-slate-500">
                      <span className="material-symbols-outlined text-3xl mb-1 text-slate-300">inbox</span>
                      <p className="font-medium text-slate-600">{t('Tidak ada lead yang cocok dengan filter')}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{t('Coba ubah filter pencarian atau input lead baru.')}</p>
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map(lead => {
                    const overdue = isOverdue(lead.next_follow_up_date) && lead.status !== 'Selesai Training' && lead.status !== 'Batal';
                    const isToday = lead.next_follow_up_date === todayStr;

                    return (
                      <tr key={lead.id} className={`transition-colors ${selectedIds.includes(lead.id) ? 'bg-blue-50/60' : 'hover:bg-slate-50'}`}>
                        {/* Selection */}
                        {canWrite && (
                          <td className="p-4 w-10" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              aria-label={t('Pilih {name}', { name: lead.contact_name })}
                              checked={selectedIds.includes(lead.id)}
                              onChange={() => toggleSelectRow(lead.id)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/15 cursor-pointer"
                            />
                          </td>
                        )}
                        {/* Contact & Company */}
                        <td className="p-4">
                          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                            {lead.contact_name}
                            <span className="text-[11px] text-slate-500 font-normal">({lead.source})</span>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate max-w-[200px]">{lead.company_name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-slate-600 font-mono">{lead.contact_phone}</span>
                            {lead.contact_email && (
                              <span className="text-[11px] text-slate-500 truncate max-w-[120px]">{lead.contact_email}</span>
                            )}
                          </div>
                        </td>

                        {/* Program & Seats */}
                        <td className="p-4">
                          <p className="font-medium text-slate-900">{lead.program_name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[11px] text-slate-600">
                              {t('Estimasi:')} {lead.estimated_seats} {t('pax')}</span>
                            {lead.confirmed_seats ? (
                              <span className="text-[11px] font-medium text-emerald-700">
                                {t('Pasti:')} {lead.confirmed_seats} {t('pax')}</span>
                            ) : null}
                          </div>
                          {lead.batch_code && (
                            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">{t('Batch:')} {lead.batch_code}</p>
                          )}
                        </td>

                        {/* Status */}
                        <td className="p-4">
                          <div>{getStatusBadge(lead.status)}</div>
                          {lead.waiting_reason && (
                            <p className="text-[11px] text-amber-700 font-medium mt-1 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[12px]">info</span>
                              {lead.waiting_reason}
                            </p>
                          )}
                          {lead.cancel_reason && (
                            <p className="text-[11px] text-slate-500 mt-1 italic truncate max-w-[150px]">{lead.cancel_reason}</p>
                          )}
                        </td>

                        {/* Follow-up Date */}
                        <td className="p-4">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-semibold ${overdue ? 'text-red-600' : isToday ? 'text-amber-700' : 'text-slate-700'}`}>
                              {lead.next_follow_up_date || '-'}
                            </span>
                          </div>
                          {overdue && (
                            <span className="cms-badge cms-badge-danger mt-1">
                              {t('Terlambat')}</span>
                          )}
                          {isToday && (
                            <span className="cms-badge cms-badge-warning mt-1">
                              {t('Hari Ini')}</span>
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
                              headerTitle={t('Pesan WhatsApp')}
                              headerSubtitle={lead.contact_phone}
                              items={[
                                {
                                  label: t('1. Tawarkan Jadwal'),
                                  description: t('Info jadwal training'),
                                  icon: 'event_available',
                                  onClick: () => handleOpenWA(lead, 'offer'),
                                },
                                {
                                  label: t('2. Kirim Link Formulir'),
                                  description: t('Tautan form registrasi'),
                                  icon: 'link',
                                  onClick: () => handleOpenWA(lead, 'link'),
                                },
                                {
                                  label: t('3. Follow-up Reminder'),
                                  description: t('Pengingat isi formulir'),
                                  icon: 'notifications_active',
                                  onClick: () => handleOpenWA(lead, 'reminder'),
                                },
                                {
                                  label: t('4. Konfirmasi Terdaftar'),
                                  description: t('Notifikasi terdata resmi'),
                                  icon: 'check_circle',
                                  onClick: () => handleOpenWA(lead, 'confirmed'),
                                },
                              ]}
                            >
                              {t('WA')}</DropdownButton>

                            {/* 2. Primary Progression Button */}
                            {canWrite && lead.status === 'Baru' && (
                              <Button
                                size="sm"
                                variant="secondary"
                                icon="send"
                                onClick={() => handleMarkLinkSent(lead)}
                                title={t('Tandai Formulir Registrasi Telah Dikirim')}
                              >
                                {t('Kirim Link')}</Button>
                            )}

                            {canWrite && (lead.status === 'Link Terkirim' || lead.status === 'Waiting List' || lead.status === 'Jadwal Ditawarkan') && (
                              <Button
                                size="sm"
                                variant="primary"
                                icon="how_to_reg"
                                onClick={() => openRegisterModal(lead)}
                                title={t('Konfirmasi Pendaftaran ke Batch Training')}
                              >
                                {t('Konfirmasi')}</Button>
                            )}

                            {canWrite && lead.status === 'Terdaftar' && (
                              <Button
                                size="sm"
                                variant="success"
                                icon="school"
                                onClick={() => handleCompleteTraining(lead)}
                                title={t('Tandai Pelatihan Selesai & Lanjut ke Cetak Sertifikat')}
                              >
                                {t('Selesai')}</Button>
                            )}

                            {/* 3. Standardized ActionMenu (matches certificates more_vert) */}
                            <ActionMenu
                              align="right"
                              menuWidth="w-52"
                              items={[
                                ...(canWrite && lead.status !== 'Selesai Training' && lead.status !== 'Batal' ? [
                                  {
                                    label: t('Jadwalkan Follow-up'),
                                    icon: 'calendar_clock',
                                    onClick: () => openFollowUpModal(lead),
                                  },
                                ] : []),
                                ...(canWrite && lead.status !== 'Waiting List' && lead.status !== 'Selesai Training' && lead.status !== 'Batal' ? [
                                  {
                                    label: t('Pindah ke Waiting List'),
                                    icon: 'hourglass_top',
                                    onClick: () => openRescheduleModal(lead),
                                  },
                                ] : []),
                                {
                                  label: t('Lihat Detail Lengkap'),
                                  icon: 'visibility',
                                  onClick: () => openLeadDetail(lead),
                                },
                                ...(canWrite ? ['divider' as const] : []),
                                ...(canWrite && lead.status !== 'Selesai Training' && lead.status !== 'Batal' ? [
                                  {
                                    label: t('Tandai Batal'),
                                    icon: 'cancel',
                                    variant: 'danger' as const,
                                    onClick: () => openCancelModal(lead),
                                  },
                                ] : []),
                                ...(can('delete.lead', { ownerId: lead.created_by }) ? [
                                  {
                                    label: t('Hapus Lead'),
                                    icon: 'delete',
                                    variant: 'danger' as const,
                                    onClick: () => handleDeleteLead(lead.id),
                                  },
                                ] : []),
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
          <Modal isOpen={true} onClose={() => setIsAddModalOpen(false)} title={t('Input Lead / Peluang Training Baru')} icon="add_circle" size="lg" onSubmit={handleCreateLead} footer={<>
<Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAddModalOpen(false)}
                  >
                    {t('Batal')}</Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    icon="save"
                  >
                    {t('Simpan Lead')}</Button>
</>}>
<div className="space-y-3.5 text-xs">
<div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      {t('Nama Kontak PIC')} <span className="text-red-500 font-semibold">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={t('Contoh: Ahmad Shafwan')}
                      value={newContactName}
                      onChange={e => setNewContactName(e.target.value)}
                      className="cms-input text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      {t('No. WhatsApp / HP')} <span className="text-red-500 font-semibold">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder={t('Contoh: 08123456789')}
                      value={newContactPhone}
                      onChange={e => setNewContactPhone(e.target.value)}
                      className="cms-input text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      {t('Perusahaan / Instansi')} <span className="text-slate-500 font-normal text-xs">{t('(Opsional)')}</span>
                    </label>
                    <input
                      type="text"
                      placeholder={t('Contoh: PT Biro Klasifikasi Indonesia (atau Pribadi)')}
                      value={newCompanyName}
                      onChange={e => setNewCompanyName(e.target.value)}
                      className="cms-input text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      {t('Email Kontak')} <span className="text-slate-500 font-normal text-xs">{t('(Opsional)')}</span>
                    </label>
                    <input
                      type="email"
                      placeholder={t('ahmad.shafwan@perusahaan.com')}
                      value={newContactEmail}
                      onChange={e => setNewContactEmail(e.target.value)}
                      className="cms-input text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">
                      {t('Program Training Diminati')} <span className="text-red-500 font-semibold">*</span>
                    </label>
                    <select
                      required
                      value={newProgramName}
                      onChange={e => setNewProgramName(e.target.value)}
                      className="cms-input text-xs font-medium text-slate-800"
                    >
                      <option value="">{t('-- Pilih Program Training --')}</option>
                      {BKI_TRAINING_PROGRAMS.map((progName) => (
                        <option key={progName} value={progName}>
                          {progName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      {t('Estimasi Kursi')} <span className="text-slate-500 font-normal text-xs">{t('(Opsional)')}</span>
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
                      {t('Sumber Lead')} <span className="text-slate-500 font-normal text-xs">{t('(Opsional)')}</span>
                    </label>
                    <select
                      value={newSource}
                      onChange={e => setNewSource(e.target.value as LeadSource)}
                      className="cms-input text-xs"
                    >
                      <option value="WA Bisnis">{t('WhatsApp Bisnis')}</option>
                      <option value="WA Pribadi">{t('WhatsApp Pribadi Staf')}</option>
                      <option value="Website">{t('Website BKI Academy')}</option>
                      <option value="Referral">{t('Rekomendasi / Referral')}</option>
                      <option value="Event">{t('Event / Seminar')}</option>
                      <option value="Lainnya">{t('Lainnya')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      {t('Target Follow-up Berikutnya')} <span className="text-red-500 font-semibold">*</span>
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
                    {t('Catatan Kebutuhan / Preferensi Jadwal')} <span className="text-slate-500 font-normal text-xs">{t('(Opsional)')}</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder={t('Contoh: Membutuhkan jadwal offline di Jakarta untuk 5 inspektur pada bulan Oktober...')}
                    value={newNotes}
                    onChange={e => setNewNotes(e.target.value)}
                    className="cms-input text-xs"
                  />
                </div>
</div>
</Modal>
        )}

        {/* Modal: Konfirmasi Terdaftar */}
        {isRegisterModalOpen && selectedLead && (
          <Modal isOpen={true} onClose={() => setIsRegisterModalOpen(false)} title={t('Konfirmasi Pendaftaran Peserta')} icon="verified" onSubmit={handleConfirmRegistration} footer={<>
<Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsRegisterModalOpen(false)}
                  >
                    {t('Batal')}</Button>
                  <Button
                    type="submit"
                    variant="success"
                    size="sm"
                    icon="check"
                  >
                    {t('Konfirmasi Terdaftar')}</Button>
</>}>
<div className="space-y-3.5 text-xs">
<div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <p className="font-semibold text-slate-800">{selectedLead.contact_name}</p>
                  <p className="text-slate-500 text-[11px]">{selectedLead.company_name} - {selectedLead.program_name}</p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {t('Pilih Batch Pelatihan yang Dituju')} <span className="text-slate-500 font-normal text-xs">{t('(Opsional)')}</span>
                  </label>
                  <select
                    value={actionBatchId}
                    onChange={e => setActionBatchId(e.target.value)}
                    className="cms-input text-xs"
                  >
                    <option value="">{t('-- Buat / Hubungkan Nanti --')}</option>
                    {trainings.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.program_name} - {t.batch_code} ({t.start_date})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {t('Jumlah Peserta Terkonfirmasi (Pax)')} <span className="text-red-500 font-semibold">*</span>
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
                    {t('Catatan Konfirmasi PIC')} <span className="text-slate-500 font-normal text-xs">{t('(Opsional)')}</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder={t('Contoh: Formulir sudah diperiksa, 3 nama peserta telah terdaftar resmi.')}
                    value={actionNote}
                    onChange={e => setActionNote(e.target.value)}
                    className="cms-input text-xs"
                  />
                </div>
</div>
</Modal>
        )}

        {/* Modal: Reschedule / Waiting List */}
        {isRescheduleModalOpen && selectedLead && (
          <Modal isOpen={true} onClose={() => setIsRescheduleModalOpen(false)} title={t('Alihkan ke Waiting List / Reschedule')} icon="schedule_send" onSubmit={handleConfirmReschedule} footer={<>
<Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsRescheduleModalOpen(false)}
                  >
                    {t('Tutup')}</Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    icon="hourglass_top"
                    className="!bg-amber-700 hover:!bg-amber-800"
                  >
                    {t('Simpan ke Waiting List')}</Button>
</>}>
<div className="space-y-3.5 text-xs">
<div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {t('Alasan Masuk Waiting List')} <span className="text-red-500 font-semibold">*</span>
                  </label>
                  <select
                    value={actionReason}
                    onChange={e => setActionReason(e.target.value as WaitingReason)}
                    className="cms-input text-xs"
                  >
                    <option value="Reschedule">{t('Reschedule (Ganti Batch/Jadwal)')}</option>
                    <option value="Belum Ada Jadwal">{t('Belum Ada Jadwal Cocok')}</option>
                    <option value="Menunggu Konfirmasi Internal">{t('Menunggu Konfirmasi Internal Klien')}</option>
                    <option value="Budgeting">{t('Menunggu Persetujuan Anggaran')}</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {t('Target Pengecekan / Follow-up Berikutnya')} <span className="text-red-500 font-semibold">*</span>
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
                    {t('Catatan Tambahan')} <span className="text-slate-500 font-normal text-xs">{t('(Opsional)')}</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder={t('Contoh: Peserta meminta digeser ke batch November karena bentrok jadwal dinas kapal...')}
                    value={actionNote}
                    onChange={e => setActionNote(e.target.value)}
                    className="cms-input text-xs"
                  />
                </div>
</div>
</Modal>
        )}

        {/* Modal: Catat Follow-up Rutin */}
        {isFollowUpModalOpen && selectedLead && (
          <Modal isOpen={true} onClose={() => setIsFollowUpModalOpen(false)} title={t('Catat Aktivitas Follow-up')} icon="event_repeat" onSubmit={handleRecordFollowUp} footer={<>
<Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsFollowUpModalOpen(false)}
                  >
                    {t('Batal')}</Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    icon="check"
                  >
                    {t('Simpan Catatan')}</Button>
</>}>
<div className="space-y-3.5 text-xs">
<div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <p className="font-semibold text-slate-800">{selectedLead.contact_name} ({selectedLead.contact_phone})</p>
                  <p className="text-slate-500 text-[11px]">{selectedLead.program_name}</p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {t('Hasil Follow-up / Catatan Respon')} <span className="text-red-500 font-semibold">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder={t('Contoh: Sudah dihubungi via WA, PIC sedang mengumpulkan data KTP calon peserta...')}
                    value={actionNote}
                    onChange={e => setActionNote(e.target.value)}
                    className="cms-input text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {t('Jadwal Tindak Lanjut Berikutnya')} <span className="text-red-500 font-semibold">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={actionNextDate}
                    onChange={e => setActionNextDate(e.target.value)}
                    className="cms-input text-xs"
                  />
                </div>
</div>
</Modal>
        )}

        {/* Modal: Batalkan Peluang */}
        {isCancelModalOpen && selectedLead && (
          <Modal isOpen={true} onClose={() => setIsCancelModalOpen(false)} title={t('Batalkan Peluang Training')} icon="cancel" onSubmit={handleConfirmCancel} footer={<>
<Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsCancelModalOpen(false)}
                  >
                    {t('Batal')}</Button>
                  <Button
                    type="submit"
                    variant="danger"
                    size="sm"
                    icon="cancel"
                  >
                    {t('Konfirmasi Batal')}</Button>
</>}>
<div className="space-y-3.5 text-xs">
<p className="text-slate-600">
                  {t('Anda akan menandai peluang untuk')} <b>{selectedLead.contact_name}</b> {t('sebagai')} <b>{t('Batal')}</b>.
                </p>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {t('Alasan Pembatalan')} <span className="text-red-500 font-semibold">*</span>
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder={t('Contoh: Anggaran dibatalkan perusahaan / memilih provider lain...')}
                    value={actionNote}
                    onChange={e => setActionNote(e.target.value)}
                    className="cms-input text-xs"
                  />
                </div>
</div>
</Modal>
        )}

        {/* Slide-over Drawer: Detail Lead & Riwayat Aktivitas */}
        {isDetailDrawerOpen && selectedLead && (
          <Modal isOpen={true} onClose={() => setIsDetailDrawerOpen(false)} title={selectedLead.contact_name} description={t('Detail Lead: {company_name}', { company_name: selectedLead.company_name })} placement="right" footer={<div className="flex w-full items-center justify-between">
{canWrite ? (
<Button
                  variant="ghost"
                  size="sm"
                  icon="cancel"
                  onClick={() => openCancelModal(selectedLead)}
                  className="!text-red-600 hover:!bg-red-50"
                >
                  {t('Tandai Batal')}</Button>
) : <span />}

                <div className="flex items-center gap-2">
                  {can('delete.lead', { ownerId: selectedLead.created_by }) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="delete"
                    onClick={() => handleDeleteLead(selectedLead.id)}
                    className="!text-slate-500 hover:!text-red-600"
                    title={t('Hapus Data Lead')}
                  />
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsDetailDrawerOpen(false)}
                  >
                    {t('Selesai')}</Button>
                </div>
</div>}>
{/* Drawer Content */}
              <div className="space-y-5 text-xs">
                {/* Status Card */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-slate-500 font-semibold">{t('Status Saat Ini')}</span>
                    <div className="mt-1">{getStatusBadge(selectedLead.status)}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-slate-500 font-semibold">{t('Target Follow-up')}</span>
                    <p className={`font-semibold mt-1 ${isOverdue(selectedLead.next_follow_up_date) ? 'text-red-600' : 'text-slate-800'}`}>
                      {selectedLead.next_follow_up_date}
                    </p>
                  </div>
                </div>

                {/* Info Fields */}
                <div className="space-y-3 bg-card p-3.5 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-[11px] text-slate-500 font-semibold">{t('Perusahaan / Instansi')}</span>
                    <p className="font-semibold text-slate-900 mt-0.5">{selectedLead.company_name}</p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 font-semibold">{t('Program Training')}</span>
                    <p className="font-semibold text-slate-900 mt-0.5">{selectedLead.program_name}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[11px] text-slate-500 font-semibold">{t('Estimasi Kursi')}</span>
                      <p className="font-semibold text-slate-900 mt-0.5">{selectedLead.estimated_seats} {t('Pax')}</p>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 font-semibold">{t('Terkonfirmasi')}</span>
                      <p className="font-semibold text-emerald-600 mt-0.5">{selectedLead.confirmed_seats || 0} {t('Pax')}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[11px] text-slate-500 font-semibold">{t('WhatsApp / Telepon')}</span>
                      <p className="font-mono text-slate-800 mt-0.5">{selectedLead.contact_phone}</p>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 font-semibold">{t('PIC Staf Internal')}</span>
                      <p className="font-medium text-slate-800 mt-0.5">{selectedLead.pic_staff_name}</p>
                    </div>
                  </div>
                  {selectedLead.previous_batch_info && (
                    <div className="bg-amber-50 p-2 rounded border border-amber-100 text-[11px] text-amber-800">
                      <b>{t('Riwayat Batch:')}</b> {t('Reschedule dari')} {selectedLead.previous_batch_info}
                    </div>
                  )}
                  {selectedLead.notes && (
                    <div>
                      <span className="text-[11px] text-slate-500 font-semibold">{t('Catatan Kebutuhan')}</span>
                      <p className="text-slate-700 bg-slate-50 p-2 rounded mt-0.5 leading-relaxed">{selectedLead.notes}</p>
                    </div>
                  )}
                </div>

                {/* Quick WhatsApp Actions in Drawer */}
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-slate-500">{t('Aksi Cepat WhatsApp')}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="schedule"
                      onClick={() => handleOpenWA(selectedLead, 'offer')}
                      className="!w-full !justify-start"
                    >
                      {t('Kirim Jadwal')}</Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="link"
                      onClick={() => handleOpenWA(selectedLead, 'link')}
                      className="!w-full !justify-start"
                    >
                      {t('Kirim Link Form')}</Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="notifications"
                      onClick={() => handleOpenWA(selectedLead, 'reminder')}
                      className="!w-full !justify-start"
                    >
                      {t('Pengingat Follow-up')}</Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="check_circle"
                      onClick={() => handleOpenWA(selectedLead, 'confirmed')}
                      className="!w-full !justify-start"
                    >
                      {t('Konfirmasi Terdaftar')}</Button>
                  </div>
                </div>

                {/* Audit Trail / Activities Timeline */}
                <div>
                  <div className="flex justify-between items-center mb-2.5">
                    <p className="text-[11px] font-semibold text-slate-500">{t('Riwayat Aktivitas & Catatan')}</p>
                    {canWrite && (
                    <button
                      onClick={() => openFollowUpModal(selectedLead)}
                      className="text-[11px] text-blue-600 hover:underline font-semibold flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">add</span> {t('Catat Aktivitas')}</button>
                    )}
                  </div>

                  <div className="space-y-3 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                    {leadActivities.length === 0 ? (
                      <p className="text-slate-500 italic text-center py-4">{t('Belum ada riwayat aktivitas.')}</p>
                    ) : (
                      leadActivities.map(act => (
                        <div key={act.id} className="relative flex items-start gap-3 pl-1">
                          <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 z-10 ring-4 ring-card shadow-xs">
                            <span className="material-symbols-outlined text-[11px]">edit_note</span>
                          </div>
                          <div className="flex-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                            <div className="flex justify-between items-center">
                              <span className="font-semibold text-slate-800 text-[11px]">{act.actor}</span>
                              <span className="text-[11px] text-slate-500">
                                {new Date(act.created_at).toLocaleDateString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-slate-600 mt-1 leading-snug">{act.note}</p>
                            {act.new_status && act.previous_status && act.new_status !== act.previous_status && (
                              <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                                <span className="text-slate-500">{act.previous_status}</span>
                                <span className="material-symbols-outlined text-[11px]">arrow_forward</span>
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
</Modal>
        )}

        {/* Floating bulk action bar */}
        {selectedLeads.length > 0 && (
          <div
            role="region"
            aria-label={t('Aksi massal')}
            className="sidebar-fixed fixed bottom-6 left-1/2 z-40 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-full bg-slate-900 px-4 py-2.5 text-white shadow-2xl"
          >
            <span className="text-xs font-semibold text-slate-200">
              {t('{count} lead dipilih', { count: selectedLeads.length })}
            </span>
            <div className="h-4 w-px bg-slate-700" />
            <button
              type="button"
              onClick={openBulkModal}
              className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-blue-300 hover:text-blue-200"
            >
              <span className="material-symbols-outlined text-sm" aria-hidden="true">swap_horiz</span>
              {t('Ubah Status')}
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="cursor-pointer text-xs font-medium text-slate-400 hover:text-slate-200"
            >
              {t('Batal Pilih')}
            </button>
          </div>
        )}

        {/* Bulk status modal */}
        {isBulkOpen && (
          <Modal
            isOpen={true}
            onClose={() => !bulkSubmitting && setIsBulkOpen(false)}
            title={t('Ubah Status Massal')}
            description={t('{count} lead dipilih', { count: selectedLeads.length })}
            icon="swap_horiz"
            onSubmit={handleBulkSubmit}
            submitLabel={t('Ubah {count} Lead', { count: bulkEligible.length })}
            submitVariant={bulkStatus === 'Batal' ? 'danger' : 'primary'}
            submitDisabled={bulkEligible.length === 0}
            submitting={bulkSubmitting}
          >
            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('Status Baru')}</label>
                <select
                  value={bulkStatus}
                  onChange={e => setBulkStatus(e.target.value as LeadStatus)}
                  className="cms-input text-xs"
                >
                  {BULK_TARGETS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {bulkStatus === 'Waiting List' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('Alasan Masuk Waiting List')}</label>
                  <select
                    value={bulkReason}
                    onChange={e => setBulkReason(e.target.value as WaitingReason)}
                    className="cms-input text-xs"
                  >
                    <option value="Reschedule">{t('Reschedule (Ganti Batch/Jadwal)')}</option>
                    <option value="Belum Ada Jadwal">{t('Belum Ada Jadwal Cocok')}</option>
                    <option value="Menunggu Konfirmasi Internal">{t('Menunggu Konfirmasi Internal Klien')}</option>
                    <option value="Budgeting">{t('Menunggu Persetujuan Anggaran')}</option>
                  </select>
                </div>
              )}

              {bulkStatus === 'Terdaftar' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {t('Pilih Batch Pelatihan yang Dituju')} <span className="text-slate-500 font-normal">{t('(Opsional)')}</span>
                  </label>
                  <select
                    value={bulkBatchId}
                    onChange={e => setBulkBatchId(e.target.value)}
                    className="cms-input text-xs"
                  >
                    <option value="">{t('-- Buat / Hubungkan Nanti --')}</option>
                    {trainings.map(tr => (
                      <option key={tr.id} value={tr.id}>
                        {tr.program_name} - {tr.batch_code} ({tr.start_date})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {t('Jumlah peserta pasti mengikuti estimasi masing-masing lead.')}
                  </p>
                </div>
              )}

              {(bulkStatus === 'Waiting List' || bulkStatus === 'Link Terkirim' || bulkStatus === 'Jadwal Ditawarkan') && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {t('Target Pengecekan / Follow-up Berikutnya')} <span className="text-slate-500 font-normal">{t('(Opsional)')}</span>
                  </label>
                  <input
                    type="date"
                    value={bulkNextDate}
                    onChange={e => setBulkNextDate(e.target.value)}
                    className="cms-input text-xs"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {bulkStatus === 'Batal' ? t('Alasan Pembatalan') : t('Catatan')}{' '}
                  {bulkStatus === 'Batal'
                    ? <span className="text-red-500 font-semibold">*</span>
                    : <span className="text-slate-500 font-normal">{t('(Opsional)')}</span>}
                </label>
                <textarea
                  rows={2}
                  value={bulkNote}
                  onChange={e => setBulkNote(e.target.value)}
                  className="cms-input text-xs"
                />
              </div>

              {/* Preview: who changes, who is skipped and why */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="font-semibold text-slate-800">
                  {t('{count} lead akan diubah', { count: bulkEligible.length })}
                </p>
                {bulkSkipped.length > 0 && (
                  <div className="mt-2">
                    <p className="font-semibold text-amber-700">
                      {t('{count} lead dilewati', { count: bulkSkipped.length })}
                    </p>
                    <ul className="mt-1 max-h-24 space-y-0.5 overflow-y-auto text-[11px] text-slate-600">
                      {bulkSkipped.map(l => (
                        <li key={l.id}>
                          {l.contact_name}: {bulkSkipReason(l, bulkStatus)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
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
