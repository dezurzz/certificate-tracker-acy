'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { DB, Contact, Company } from '@/lib/db';
import { createWhatsAppUrl } from '@/lib/whatsapp';

export default function ContactsDirectoryPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [position, setPosition] = useState('');

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
      alert('Kontak berhasil disimpan!');
      setIsAddModalOpen(false);
      setName('');
      setPhone('');
      setEmail('');
      setCompanyName('');
      setPosition('');
      loadData();
    } catch (err: any) {
      alert('Gagal menyimpan: ' + err.message);
    }
  };

  const filtered = contacts.filter(c => {
    const text = `${c.name} ${c.company_name || ''} ${c.phone} ${c.position || ''}`.toLowerCase();
    return !searchTerm || text.includes(searchTerm.toLowerCase());
  });

  const handleOpenWA = (phoneStr: string, nameStr: string) => {
    const url = createWhatsAppUrl(phoneStr, `Halo Bpk/Ibu ${nameStr},\n\nSalam dari Tim BKI Academy.`);
    window.open(url, '_blank');
  };

  return (
    <DashboardLayout pageTitle="Direktori Kontak Pelanggan">
      <div className="space-y-6">
        {/* Banner */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600 text-2xl">contacts</span>
              Direktori Kontak & PIC Pelanggan
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Daftar terpusat nomor kontak calon peserta dan perwakilan perusahaan untuk kemudahan komunikasi dan follow-up.
            </p>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="cms-btn-primary bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs px-3.5 py-2.5 rounded-lg flex items-center gap-2 shadow-sm transition"
          >
            <span className="material-symbols-outlined text-base">person_add</span>
            Tambah Kontak
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
              placeholder="Cari nama kontak, nomor telepon, atau perusahaan..."
              className="cms-input pl-9 text-xs"
            />
          </div>
        </div>

        {/* Contacts Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto table-scroll">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Nama Lengkap</th>
                  <th className="py-3.5 px-4">Perusahaan / Afiliasi</th>
                  <th className="py-3.5 px-4">Jabatan</th>
                  <th className="py-3.5 px-4">Kontak Telepon & Email</th>
                  <th className="py-3.5 px-4 text-center">Aksi Cepat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">Memuat data kontak...</td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">Tidak ada kontak yang cocok.</td>
                  </tr>
                ) : (
                  filtered.map(cnt => (
                    <tr key={cnt.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{cnt.name}</td>
                      <td className="py-3.5 px-4 text-slate-700">{cnt.company_name || 'PRIBADI'}</td>
                      <td className="py-3.5 px-4 text-slate-500">{cnt.position || '-'}</td>
                      <td className="py-3.5 px-4">
                        <p className="font-mono text-blue-700 font-semibold">{cnt.phone}</p>
                        {cnt.email && <p className="text-[11px] text-slate-400">{cnt.email}</p>}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleOpenWA(cnt.phone, cnt.name)}
                          className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 mx-auto transition"
                        >
                          <span className="material-symbols-outlined text-sm">chat</span>
                          Chat WhatsApp
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600">person_add</span>
                  Tambah Kontak Baru
                </h3>
                <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>

              <form onSubmit={handleAddContact} className="p-5 space-y-3.5 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Rian Prasetya"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="cms-input text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">No. WhatsApp / HP *</label>
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
                    <label className="block font-semibold text-slate-700 mb-1">Email</label>
                    <input
                      type="email"
                      placeholder="rian@company.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="cms-input text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Perusahaan / Instansi</label>
                  <input
                    type="text"
                    list="companySuggestions"
                    placeholder="Pilih atau ketik nama perusahaan..."
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
                  <label className="block font-semibold text-slate-700 mb-1">Jabatan / Posisi</label>
                  <input
                    type="text"
                    placeholder="Contoh: HR Manager / Crewing Staff"
                    value={position}
                    onChange={e => setPosition(e.target.value)}
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
                    Simpan Kontak
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
