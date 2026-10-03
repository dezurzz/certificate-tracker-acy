'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { DB, Company } from '@/lib/db';
import Button from '@/components/Button';
import PageHeader from '@/components/PageHeader';
import LoadError from '@/components/LoadError';
import { notify } from '@/lib/notify';
import Modal from '@/components/Modal';
import { useT } from '@/i18n/LanguageContext';
import SortSelect from '@/components/SortSelect';
import FilterBar, { FilterSearch, FilterSelect } from '@/components/FilterBar';
import { cmpText, cmpDate, cmpDateDesc } from '@/lib/sort';
import { CardGridSkeleton } from '@/components/Skeleton';
import { getErrorMessage } from '@/lib/errors';

export default function CompaniesDirectoryPage() {
  const t = useT();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  const [sortKey, setSortKey] = useState<'name_asc' | 'name_desc' | 'newest' | 'oldest' | 'industry_asc'>('name_asc');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [alias, setAlias] = useState('');
  const [industry, setIndustry] = useState('');
  const [address, setAddress] = useState('');

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
    setLoadError(null);
    try {
      const list = await DB.getCompanies();
      setCompanies(list);
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

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      await DB.upsertCompany({
        name: name.trim(),
        alias: alias.trim() || undefined,
        industry: industry.trim() || undefined,
        address: address.trim() || undefined
      });
      notify.success(t('Perusahaan berhasil disimpan ke direktori master'));
      setIsAddModalOpen(false);
      setName('');
      setAlias('');
      setIndustry('');
      setAddress('');
      loadData();
    } catch (err) {
      notify.error(t('Gagal menyimpan'), getErrorMessage(err));
    }
  };

  const filtered = companies.filter(c => {
    const text = `${c.name} ${c.alias || ''} ${c.industry || ''}`.toLowerCase();
    if (searchTerm && !text.includes(searchTerm.toLowerCase())) return false;
    if (industryFilter && (c.industry || '') !== industryFilter) return false;
    return true;
  }).sort((a, b) => {
    switch (sortKey) {
      case 'name_desc': return cmpText(b.name, a.name);
      case 'newest': return cmpDateDesc(a.created_at, b.created_at);
      case 'oldest': return cmpDate(a.created_at, b.created_at);
      case 'industry_asc': return cmpText(a.industry, b.industry) || cmpText(a.name, b.name);
      default: return cmpText(a.name, b.name);
    }
  });

  const industries = Array.from(new Set(companies.map(c => (c.industry || '').trim()).filter(Boolean))).sort(cmpText);

  return (
    <DashboardLayout pageTitle="Direktori Perusahaan Rekanan">
      <div className="space-y-6">
        <PageHeader
          title={t('Perusahaan')}
          description={t('Data master perusahaan rekanan BKI Academy untuk mencegah duplikasi penulisan nama PT.')}
          actions={
            <div className="flex items-center gap-2">
              <Button variant="secondary" icon="sync" loading={syncing} onClick={handleSyncFromLeads}>
                {t('Sinkronkan dari Leads')}</Button>
              <Button variant="primary" icon="add_business" onClick={() => setIsAddModalOpen(true)}>
              {t('Tambah Perusahaan')}</Button>
            </div>
          }
        />

        {loadError && <LoadError message={loadError} onRetry={loadData} />}

        <FilterBar
          summary={t('Menampilkan {shown} dari {total} perusahaan', { shown: filtered.length, total: companies.length })}
          hasActive={Boolean(searchTerm || industryFilter)}
          onReset={() => { setSearchTerm(''); setIndustryFilter(''); }}
          sort={
            <SortSelect
              value={sortKey}
              onChange={setSortKey}
              options={[
                { value: 'name_asc', label: t('Nama A–Z') },
                { value: 'name_desc', label: t('Nama Z–A') },
                { value: 'newest', label: t('Terbaru ditambahkan') },
                { value: 'oldest', label: t('Terlama ditambahkan') },
                { value: 'industry_asc', label: t('Industri A–Z') },
              ]}
            />
          }
        >
          <FilterSearch value={searchTerm} onChange={setSearchTerm} placeholder={t('Cari nama perusahaan, alias, atau bidang industri...')} label={t('Cari perusahaan')} />
          <FilterSelect value={industryFilter} onChange={setIndustryFilter} label={t('Filter berdasarkan industri')}>
            <option value="">{t('Semua Industri')}</option>
            {industries.map(v => <option key={v} value={v}>{v}</option>)}
          </FilterSelect>
        </FilterBar>

        {/* Companies Grid */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {loading ? (
            <div className="col-span-full">
              <CardGridSkeleton label={t('Memuat data perusahaan...')} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="col-span-full bg-card p-12 text-center text-slate-500 rounded-xl border border-dashed border-slate-300">
              <span className="material-symbols-outlined mb-2 text-3xl text-slate-400" aria-hidden="true">domain_disabled</span>
              <p className="text-sm font-medium text-slate-900">{t('Tidak ada perusahaan yang cocok')}</p>
              <p className="mt-1 text-xs">{t('Ubah kata kunci pencarian atau tambahkan perusahaan baru.')}</p>
            </div>
          ) : (
            filtered.map(comp => (
              <div key={comp.id} className="cms-card !p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-xl" aria-hidden="true">business</span>
                  </div>
                  {comp.alias && (
                    <span className="cms-badge cms-badge-neutral">
                      {t('Alias:')} {comp.alias}
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="font-semibold text-slate-900 text-sm leading-tight">{comp.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{comp.industry || t('Industri Maritim / Pelayaran')}</p>
                </div>

                {comp.address && (
                  <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">
                    {comp.address}
                  </p>
                )}
              </div>
            ))
          )}
        </div>

        {/* Modal: Tambah Perusahaan */}
        {isAddModalOpen && (
          <Modal isOpen={true} onClose={() => setIsAddModalOpen(false)} title={t('Tambah Perusahaan Master')} onSubmit={handleAddCompany} cancelLabel={t('Batal')} submitLabel={t('Simpan Perusahaan')}>
<div className="space-y-3.5 text-xs">
<div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('Nama Perusahaan Resmi *')}</label>
                  <input
                    type="text"
                    required
                    placeholder={t('Contoh: PT Pelayaran Bahtera Samudra')}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="cms-input text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('Nama Singkatan / Alias')}</label>
                  <input
                    type="text"
                    placeholder={t('Contoh: Bahtera Line')}
                    value={alias}
                    onChange={e => setAlias(e.target.value)}
                    className="cms-input text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('Bidang Industri')}</label>
                  <input
                    type="text"
                    placeholder={t('Contoh: Shipping, Port, Oil & Gas')}
                    value={industry}
                    onChange={e => setIndustry(e.target.value)}
                    className="cms-input text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('Alamat Kantor')}</label>
                  <textarea
                    rows={2}
                    placeholder={t('Alamat kantor...')}
                    value={address}
                    onChange={e => setAddress(e.target.value)}
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
