'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { DB, Company } from '@/lib/db';

export default function CompaniesDirectoryPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [alias, setAlias] = useState('');
  const [industry, setIndustry] = useState('');
  const [address, setAddress] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await DB.getCompanies();
      setCompanies(list);
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
      alert('Perusahaan berhasil disimpan ke direktori master!');
      setIsAddModalOpen(false);
      setName('');
      setAlias('');
      setIndustry('');
      setAddress('');
      loadData();
    } catch (err: any) {
      alert('Gagal menyimpan: ' + err.message);
    }
  };

  const filtered = companies.filter(c => {
    const text = `${c.name} ${c.alias || ''} ${c.industry || ''}`.toLowerCase();
    return !searchTerm || text.includes(searchTerm.toLowerCase());
  });

  return (
    <DashboardLayout pageTitle="Direktori Perusahaan Rekanan">
      <div className="space-y-6">
        {/* Banner */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600 text-2xl">corporate_fare</span>
              Direktori Perusahaan & Klien B2B
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Data master perusahaan rekanan BKI Academy untuk mencegah duplikasi penulisan nama PT.
            </p>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="cms-btn-primary bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs px-3.5 py-2.5 rounded-lg flex items-center gap-2 shadow-sm transition"
          >
            <span className="material-symbols-outlined text-base">add_business</span>
            Tambah Perusahaan
          </button>
        </div>

        {/* Search */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">search</span>
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Cari nama perusahaan, alias, atau bidang industri..."
              className="cms-input pl-9 text-xs"
            />
          </div>
        </div>

        {/* Companies Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-3 bg-white p-12 text-center text-slate-400 rounded-xl border border-slate-200">
              Memuat data perusahaan...
            </div>
          ) : filtered.length === 0 ? (
            <div className="col-span-3 bg-white p-12 text-center text-slate-400 rounded-xl border border-slate-200">
              Tidak ada perusahaan yang cocok.
            </div>
          ) : (
            filtered.map(comp => (
              <div key={comp.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition space-y-2">
                <div className="flex items-start justify-between">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0">
                    <span className="material-symbols-outlined text-xl">business</span>
                  </div>
                  {comp.alias && (
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">
                      Alias: {comp.alias}
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="font-bold text-slate-900 text-sm leading-tight">{comp.name}</h3>
                  <p className="text-[11px] text-blue-600 font-medium mt-0.5">{comp.industry || 'Industri Maritim / Pelayaran'}</p>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600">add_business</span>
                  Tambah Perusahaan Master
                </h3>
                <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>

              <form onSubmit={handleAddCompany} className="p-5 space-y-3.5 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nama Perusahaan Resmi *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: PT Pelayaran Bahtera Samudra"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="cms-input text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nama Singkatan / Alias</label>
                  <input
                    type="text"
                    placeholder="Contoh: Bahtera Line"
                    value={alias}
                    onChange={e => setAlias(e.target.value)}
                    className="cms-input text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bidang Industri</label>
                  <input
                    type="text"
                    placeholder="Contoh: Shipping, Port, Oil & Gas"
                    value={industry}
                    onChange={e => setIndustry(e.target.value)}
                    className="cms-input text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Alamat Kantor</label>
                  <textarea
                    rows={2}
                    placeholder="Alamat kantor..."
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    className="cms-input text-xs"
                  />
                </div>

                <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="cms-btn-primary bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-xs"
                  >
                    Simpan Perusahaan
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
