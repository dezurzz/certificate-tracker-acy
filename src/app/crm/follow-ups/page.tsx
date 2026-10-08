'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { DB, Lead } from '@/lib/db';
import { WATemplates, createWhatsAppUrl } from '@/lib/whatsapp';
import ConfirmationModal from '@/components/ConfirmationModal';
import Modal from '@/components/Modal';
import PageHeader from '@/components/PageHeader';
import LoadError from '@/components/LoadError';
import Tabs from '@/components/Tabs';
import { useAuth, useCan } from '@/context/AuthContext';
import { notify } from '@/lib/notify';
import { useT } from '@/i18n/LanguageContext';
import SortSelect from '@/components/SortSelect';
import FilterBar, { FilterSearch, FilterSelect } from '@/components/FilterBar';
import { cmpText, cmpDate, cmpDateDesc, cmpNumberDesc } from '@/lib/sort';
import { CardListSkeleton } from '@/components/Skeleton';
import { getErrorMessage } from '@/lib/errors';

export default function FollowUpsPage() {
  const t = useT();
  const { user } = useAuth();
  const canWrite = useCan()('data.write');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filter tab
  const [activeTab, setActiveTab] = useState<'overdue' | 'today' | 'link_sent' | 'all'>('overdue');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [picFilter, setPicFilter] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [sortKey, setSortKey] = useState<'due_asc' | 'due_desc' | 'name_asc' | 'name_desc' | 'company_asc' | 'seats_desc' | 'newest'>('due_asc');

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
    setLoadError(null);
    try {
      const all = await DB.getLeads();
      // Exclude finished / cancelled
      const activeLeads = all.filter(l => l.status !== 'Selesai Training' && l.status !== 'Batal');
      setLeads(activeLeads);
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
    if (searchTerm && !text.includes(searchTerm.toLowerCase())) return false;
    if (statusFilter && l.status !== statusFilter) return false;
    if (picFilter && l.pic_staff_name !== picFilter) return false;
    if (programFilter && l.program_name !== programFilter) return false;
    return true;
  }).sort((a, b) => {
    switch (sortKey) {
      case 'due_desc': return cmpDateDesc(a.next_follow_up_date, b.next_follow_up_date);
      case 'name_asc': return cmpText(a.contact_name, b.contact_name);
      case 'name_desc': return cmpText(b.contact_name, a.contact_name);
      case 'company_asc': return cmpText(a.company_name, b.company_name);
      case 'seats_desc': return cmpNumberDesc(a.estimated_seats, b.estimated_seats);
      case 'newest': return cmpDateDesc(a.created_at, b.created_at);
      default: return cmpDate(a.next_follow_up_date, b.next_follow_up_date);
    }
  });

  const uniquePics = Array.from(new Set(leads.map(l => l.pic_staff_name).filter(Boolean))).sort(cmpText);
  const uniquePrograms = Array.from(new Set(leads.map(l => l.program_name).filter(Boolean))).sort(cmpText);
  const hasFilters = Boolean(searchTerm || statusFilter || picFilter || programFilter);

  // Action: Postpone to tomorrow (1-click)
  const handlePostponeTomorrow = async (lead: Lead) => {
    const tomorrowStr = new Date(Date.now() + 24 * 3600 * 1000).toISOString().split('T')[0];
    try {
      await DB.updateLead(lead.id, { next_follow_up_date: tomorrowStr });
      await DB.insertLeadActivity({
        lead_id: lead.id,
        action_type: 'follow_up',
        note: t('Target follow-up digeser ke besok ({tomorrowStr}).', { tomorrowStr }),
        actor: user?.name || 'System Admin',
        previous_status: lead.status,
        new_status: lead.status
      });
      loadData();
    } catch (e) {
      notify.error(t('Terjadi kesalahan'), getErrorMessage(e));
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

      notify.success(t('Follow-up berhasil dicatat'));
      setIsFollowUpModalOpen(false);
      loadData();
    } catch (e) {
      notify.error(t('Terjadi kesalahan'), getErrorMessage(e));
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
        <PageHeader
          title={t('Tugas Follow-up')}
          description={t('Fokus pada tugas yang jatuh tempo hari ini dan yang terlambat agar tidak ada calon peserta yang terlewatkan.')}
          actions={
            <span className="inline-flex items-center gap-1.5 text-sm text-slate-500">
              <span className="material-symbols-outlined text-[18px] text-slate-400" aria-hidden="true">today</span>
              {t('Hari ini')} <span className="font-medium text-slate-900 tabular-nums">{todayStr}</span>
            </span>
          }
        />

        {loadError && <LoadError message={loadError} onRetry={loadData} />}

        <Tabs
          value={activeTab}
          onChange={setActiveTab}
          items={[
            { id: 'overdue', label: t('Terlambat'), icon: 'warning', count: overdueList.length, countTone: 'danger' },
            { id: 'today', label: t('Hari ini'), icon: 'calendar_today', count: todayList.length, countTone: 'warning' },
            { id: 'link_sent', label: t('Link Terkirim'), icon: 'link', count: linkSentList.length },
            { id: 'all', label: t('Semua Tugas'), icon: 'list', count: leads.length },
          ]}
        />

        <FilterBar
          summary={t('Menampilkan {shown} dari {total} tugas', { shown: filtered.length, total: currentList.length })}
          hasActive={hasFilters}
          onReset={() => { setSearchTerm(''); setStatusFilter(''); setPicFilter(''); setProgramFilter(''); }}
          sort={
            <SortSelect
              value={sortKey}
              onChange={setSortKey}
              options={[
                { value: 'due_asc', label: t('Paling terlambat dulu') },
                { value: 'due_desc', label: t('Jatuh tempo terjauh') },
                { value: 'newest', label: t('Terbaru masuk') },
                { value: 'seats_desc', label: t('Estimasi kursi terbanyak') },
                { value: 'name_asc', label: t('Nama kontak A–Z') },
                { value: 'name_desc', label: t('Nama kontak Z–A') },
                { value: 'company_asc', label: t('Perusahaan A–Z') },
              ]}
            />
          }
        >
          <FilterSearch value={searchTerm} onChange={setSearchTerm} placeholder={t('Cari kontak atau perusahaan pada antrean ini...')} label={t('Cari antrean follow-up')} />
          <FilterSelect value={statusFilter} onChange={setStatusFilter} label={t('Filter berdasarkan status')}>
            <option value="">{t('Semua Status')}</option>
            <option value="Baru">{t('Baru')}</option>
            <option value="Waiting List">{t('Waiting List')}</option>
            <option value="Jadwal Ditawarkan">{t('Ditawarkan')}</option>
            <option value="Link Terkirim">{t('Link Terkirim')}</option>
            <option value="Terdaftar">{t('Terdaftar')}</option>
          </FilterSelect>
          <FilterSelect value={picFilter} onChange={setPicFilter} label={t('Filter berdasarkan PIC')}>
            <option value="">{t('Semua PIC')}</option>
            {uniquePics.map(pic => <option key={pic} value={pic}>{pic}</option>)}
          </FilterSelect>
          <FilterSelect value={programFilter} onChange={setProgramFilter} label={t('Filter berdasarkan program')}>
            <option value="">{t('Semua Program Training')}</option>
            {uniquePrograms.map(p => <option key={p} value={p}>{p}</option>)}
          </FilterSelect>
        </FilterBar>

        {/* Task Cards / Table */}
        <div className="space-y-3">
          {loading ? (
            <CardListSkeleton label={t('Memuat antrean tugas...')} />
          ) : filtered.length === 0 ? (
            <div className="bg-card p-12 text-center text-slate-500 rounded-xl border border-slate-200">
              <span className="material-symbols-outlined text-4xl text-emerald-600 mb-2" aria-hidden="true">task_alt</span>
              <p className="font-semibold text-slate-900 text-sm">{t('Bagus! Tidak ada antrean tugas pada kategori ini.')}</p>
              <p className="text-xs text-slate-500 mt-1">{t('Seluruh tindak lanjut calon peserta telah tertangani dengan baik.')}</p>
            </div>
          ) : (
            filtered.map(lead => {
              const isOverdueTask = lead.next_follow_up_date < todayStr;
              const isTodayTask = lead.next_follow_up_date === todayStr;

              return (
                <div
                  key={lead.id}
                  className="bg-card border border-slate-200 rounded-xl p-4 shadow-[0_1px_2px_rgb(15_23_42/0.04)] transition-colors hover:border-slate-300 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                >
                  {/* Left Info */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 text-sm">{lead.contact_name}</span>
                      <span className="text-[11px] text-slate-500 font-medium">({lead.company_name})</span>
                      <span className="cms-badge cms-badge-neutral">
                        {lead.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                      <span className="font-medium text-slate-900">{lead.program_name}</span>
                      <span>{t('Kebutuhan:')} <b>{lead.estimated_seats} {t('Pax')}</b></span>
                      <span className="font-mono text-slate-500">{lead.contact_phone}</span>
                      <span>{t('PIC:')} <b>{lead.pic_staff_name}</b></span>
                    </div>

                    {lead.notes && (
                      <p className="text-xs text-slate-500 italic mt-1">
                        &ldquo;{lead.notes}&rdquo;
                      </p>
                    )}
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    <div className="text-right mr-2 hidden md:block">
                      <span className="text-[11px] text-slate-500 font-semibold">{t('Jatuh Tempo')}</span>
                      <p className={`font-semibold text-xs tabular-nums ${isOverdueTask ? 'text-red-700' : isTodayTask ? 'text-amber-700' : 'text-slate-900'}`}>
                        {lead.next_follow_up_date}
                      </p>
                    </div>

                    {/* WhatsApp */}
                    <button
                      onClick={() => handleOpenWA(lead)}
                      title={t('Hubungi via WhatsApp')}
                      className="cms-btn-secondary !h-8 !px-3 !text-xs"
                    >
                      <span className="material-symbols-outlined text-[15px] shrink-0 leading-none">chat</span>
                      <span className="leading-none whitespace-nowrap">{t('WA Pengingat')}</span>
                    </button>

                    {canWrite && (<>
                    {/* Quick Postpone to Tomorrow */}
                    <button
                      onClick={() => handlePostponeTomorrow(lead)}
                      title={t('Tunda follow-up ke besok')}
                      className="cms-btn-secondary !h-8 !px-3 !text-xs"
                    >
                      <span className="material-symbols-outlined text-[15px] shrink-0 leading-none">snooze</span>
                      <span className="leading-none whitespace-nowrap">{t('Besok')}</span>
                    </button>

                    {/* Record Follow-up */}
                    <button
                      onClick={() => openFollowUpModal(lead)}
                      className="cms-btn-primary !h-8 !px-3 !text-xs"
                    >
                      <span className="material-symbols-outlined text-[15px] shrink-0 leading-none">check</span>
                      <span className="leading-none whitespace-nowrap">{t('Selesai Follow-up')}</span>
                    </button>
                    </>)}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal: Catat Hasil Follow-up */}
        {isFollowUpModalOpen && selectedLead && (
          <Modal isOpen={true} onClose={() => setIsFollowUpModalOpen(false)} title={t('Catat Hasil Follow-up')} icon="event_repeat" onSubmit={handleRecordSubmit} cancelLabel={t('Batal')} submitLabel={t('Simpan & Jadwalkan')}>
<div className="space-y-3.5 text-xs">
<div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <p className="font-semibold text-slate-800">{selectedLead.contact_name} ({selectedLead.company_name})</p>
                  <p className="text-slate-500 text-[11px]">{selectedLead.program_name}</p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {t('Catatan Respon Calon Peserta / PIC')} <span className="text-red-500 font-semibold">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder={t('Contoh: Sudah ditelepon/chat WA, PIC mengonfirmasi akan mengirimkan form pendaftaran siang ini...')}
                    value={actionNote}
                    onChange={e => setActionNote(e.target.value)}
                    className="cms-input text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {t('Jadwal Follow-up / Pengecekan Berikutnya')} <span className="text-red-500 font-semibold">*</span>
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
