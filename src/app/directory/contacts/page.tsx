'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { DB, Contact, Company } from '@/lib/db';
import Button from '@/components/Button';
import PageHeader from '@/components/PageHeader';
import { createWhatsAppUrl } from '@/lib/whatsapp';
import { notify } from '@/lib/notify';
import Modal from '@/components/Modal';
import { useT } from '@/i18n/LanguageContext';
import SortSelect from '@/components/SortSelect';
import FilterBar, { FilterSearch, FilterSelect } from '@/components/FilterBar';
import { cmpText, cmpDate, cmpDateDesc } from '@/lib/sort';
import { TableSkeletonRows, type SkeletonColumn } from '@/components/Skeleton';
import { getErrorMessage } from '@/lib/errors';

const CONTACT_SKELETON_COLUMNS: SkeletonColumn[] = [
  'w-36',
  'w-44',
  'w-28',
  { w: 'w-32', kind: 'twoLine' },
  { w: '', kind: 'action', align: 'center' },
];

export default function ContactsDirectoryPage() {
  const t = useT();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [sortKey, setSortKey] = useState<'name_asc' | 'name_desc' | 'company_asc' | 'newest' | 'oldest'>('name_asc');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [position, setPosition] = useState('');

  const [syncing, setSyncing] = useState(false);
  const handleSyncFromLeads = async () => {
    setSyncing(true);
    try {
      const r = await DB.syncLeadsToDirectory();
      if (r.failed > 0) {
        notify.warning(t('Sinkronisasi selesai dengan {failed} kegagalan.', { failed: r.failed }));
      } else if (r.leadsLinked === 0 && r.newCompanies === 0 && r.newContacts === 0) {
        notify.info(t('Semua lead sudah tersinkron.'));
      } else {
        notify.success(
          t('Sinkronisasi selesai.'),
          t('{contacts} kontak dan {companies} perusahaan baru, {leads} lead terhubung.', { contacts: r.newContacts, companies: r.newCompanies, leads: r.leadsLinked })
        );
      }
    } catch (e) {
      notify.error(t('Gagal sinkronisasi'), getErrorMessage(e));
    } finally {
      setSyncing(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [cntList, compList] = await Promise.all([
        DB.getContacts(),
        DB.getCompanies()
      ]);
      setContacts(cntList);
      setCompanies(compList);
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

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    try {
      await DB.upsertContact({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        company_name: companyName.trim() || 'PRIBADI',
        position: position.trim() || undefined
      });
      notify.success(t('Kontak berhasil disimpan'));
      setIsAddModalOpen(false);
      setName('');
      setPhone('');
      setEmail('');
      setCompanyName('');
      setPosition('');
      loadData();
    } catch (err) {
      notify.error(t('Gagal menyimpan'), getErrorMessage(err));
    }
  };

  const filtered = contacts.filter(c => {
    const text = `${c.name} ${c.company_name || ''} ${c.phone} ${c.position || ''}`.toLowerCase();
    if (searchTerm && !text.includes(searchTerm.toLowerCase())) return false;
    if (companyFilter && (c.company_name || '') !== companyFilter) return false;
    if (positionFilter && (c.position || '') !== positionFilter) return false;
    return true;
  }).sort((a, b) => {
    switch (sortKey) {
      case 'name_desc': return cmpText(b.name, a.name);
      case 'company_asc': return cmpText(a.company_name, b.company_name) || cmpText(a.name, b.name);
      case 'newest': return cmpDateDesc(a.created_at, b.created_at);
      case 'oldest': return cmpDate(a.created_at, b.created_at);
      default: return cmpText(a.name, b.name);
    }
  });

  const companyOptions = Array.from(new Set(contacts.map(c => (c.company_name || '').trim()).filter(Boolean))).sort(cmpText);
  const positionOptions = Array.from(new Set(contacts.map(c => (c.position || '').trim()).filter(Boolean))).sort(cmpText);

  const handleOpenWA = (phoneStr: string, nameStr: string) => {
    const url = createWhatsAppUrl(phoneStr, `Halo Bpk/Ibu ${nameStr},\n\nSalam dari Tim BKI Academy.`);
    window.open(url, '_blank');
  };

  return (
    <DashboardLayout pageTitle="Direktori Kontak Pelanggan">
      <div className="space-y-6">
        <PageHeader
          title={t('Kontak')}
          description={t('Daftar terpusat kontak calon peserta dan perwakilan perusahaan untuk komunikasi dan follow-up.')}
          actions={
            <div className="flex items-center gap-2">
              <Button variant="secondary" icon="sync" loading={syncing} onClick={handleSyncFromLeads}>
                {t('Sinkronkan dari Leads')}</Button>
              <Button variant="primary" icon="person_add" onClick={() => setIsAddModalOpen(true)}>
              {t('Tambah Kontak')}</Button>
            </div>
          }
        />

        <FilterBar
          summary={t('Menampilkan {shown} dari {total} kontak', { shown: filtered.length, total: contacts.length })}
          hasActive={Boolean(searchTerm || companyFilter || positionFilter)}
          onReset={() => { setSearchTerm(''); setCompanyFilter(''); setPositionFilter(''); }}
          sort={
            <SortSelect
              value={sortKey}
              onChange={setSortKey}
              options={[
                { value: 'name_asc', label: t('Nama A–Z') },
                { value: 'name_desc', label: t('Nama Z–A') },
                { value: 'company_asc', label: t('Perusahaan A–Z') },
                { value: 'newest', label: t('Terbaru ditambahkan') },
                { value: 'oldest', label: t('Terlama ditambahkan') },
              ]}
            />
          }
        >
          <FilterSearch value={searchTerm} onChange={setSearchTerm} placeholder={t('Cari nama kontak, nomor telepon, atau perusahaan...')} label={t('Cari kontak')} />
          <FilterSelect value={companyFilter} onChange={setCompanyFilter} label={t('Filter berdasarkan perusahaan')}>
            <option value="">{t('Semua Perusahaan')}</option>
            {companyOptions.map(v => <option key={v} value={v}>{v}</option>)}
          </FilterSelect>
          <FilterSelect value={positionFilter} onChange={setPositionFilter} label={t('Filter berdasarkan jabatan')}>
            <option value="">{t('Semua Jabatan')}</option>
            {positionOptions.map(v => <option key={v} value={v}>{v}</option>)}
          </FilterSelect>
        </FilterBar>

        {/* Contacts Table */}
        <div className="bg-card border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto table-scroll">
            <table className="cms-table w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                  <th className="py-3.5 px-4">{t('Nama Lengkap')}</th>
                  <th className="py-3.5 px-4">{t('Perusahaan / Afiliasi')}</th>
                  <th className="py-3.5 px-4">{t('Jabatan')}</th>
                  <th className="py-3.5 px-4">{t('Kontak Telepon & Email')}</th>
                  <th className="py-3.5 px-4 text-center">{t('Aksi Cepat')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <TableSkeletonRows label={t('Memuat data kontak...')} columns={CONTACT_SKELETON_COLUMNS} />
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">
                      <p className="text-sm font-medium text-slate-900">{t('Tidak ada kontak yang cocok')}</p>
                      <p className="mt-1 text-xs">{t('Ubah kata kunci pencarian atau tambahkan kontak baru.')}</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map(cnt => (
                    <tr key={cnt.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-slate-900">{cnt.name}</td>
                      <td className="py-3.5 px-4 text-slate-700">{cnt.company_name || t('PRIBADI')}</td>
                      <td className="py-3.5 px-4 text-slate-500">{cnt.position || '-'}</td>
                      <td className="py-3.5 px-4">
                        <p className="font-mono text-slate-700">{cnt.phone}</p>
                        {cnt.email && <p className="text-[11px] text-slate-500">{cnt.email}</p>}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleOpenWA(cnt.phone, cnt.name)}
                          className="cms-btn-secondary !h-8 !px-3 !text-xs mx-auto"
                        >
                          <span className="material-symbols-outlined text-[15px] shrink-0 leading-none">chat</span>
                          <span className="leading-none whitespace-nowrap">{t('Chat WhatsApp')}</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: Tambah Kontak */}
        {isAddModalOpen && (
          <Modal isOpen={true} onClose={() => setIsAddModalOpen(false)} title={t('Tambah Kontak Baru')} onSubmit={handleAddContact} cancelLabel={t('Batal')} submitLabel={t('Simpan Kontak')}>
<div className="space-y-3.5 text-xs">
<div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('Nama Lengkap *')}</label>
                  <input
                    type="text"
                    required
                    placeholder={t('Contoh: Ahmad Shafwan')}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="cms-input text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">{t('No. WhatsApp / HP *')}</label>
                    <input
                      type="tel"
                      required
                      placeholder="08123456789"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="cms-input text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">{t('Email')}</label>
                    <input
                      type="email"
                      placeholder={t('ahmad.shafwan@company.com')}
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="cms-input text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('Perusahaan / Instansi')}</label>
                  <input
                    type="text"
                    list="companySuggestions"
                    placeholder={t('Pilih atau ketik nama perusahaan...')}
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    className="cms-input text-xs"
                  />
                  <datalist id="companySuggestions">
                    {companies.map(c => (
                      <option key={c.id} value={c.name} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('Jabatan / Posisi')}</label>
                  <input
                    type="text"
                    placeholder={t('Contoh: HR Manager / Crewing Staff')}
                    value={position}
                    onChange={e => setPosition(e.target.value)}
                    className="cms-input text-xs"
                  />
                </div>
</div>
</Modal>
        )}
      </div>
    </DashboardLayout>
  );
}
