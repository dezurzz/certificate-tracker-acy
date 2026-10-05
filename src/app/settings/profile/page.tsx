'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { notify } from '@/lib/notify';
import { useTheme, ThemePreference } from '@/context/ThemeContext';
import { useT, useLanguage, msg, type Language } from '@/i18n/LanguageContext';

const LANGUAGE_OPTIONS: { value: Language; label: string }[] = [
  { value: 'id', label: 'Bahasa Indonesia' },
  { value: 'en', label: 'English' },
];

const THEME_OPTIONS: { value: ThemePreference; label: string; hint: string; icon: string }[] = [
  { value: 'light', label: msg('Terang'), hint: msg('Selalu terang'), icon: 'light_mode' },
  { value: 'dark', label: msg('Gelap'), hint: msg('Lebih nyaman di mata'), icon: 'dark_mode' },
  { value: 'system', label: msg('Sistem'), hint: msg('Ikuti perangkat Anda'), icon: 'contrast' },
];

export default function ProfileSettingsPage() {
  const t = useT();
  const { user, updateProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const { preference, setPreference } = useTheme();
  const { language, setLanguage } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.name);
      setEmail(user.email);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const res = await updateProfile(fullName);
    if (res.success) {
      notify.success(t('Profil berhasil disimpan'));
    } else {
      notify.error(t('Gagal memperbarui profil'), res.error);
    }
    setIsSubmitting(false);
  };

  const handleDiscard = () => {
    if (user) {
      setFullName(user.name);
      setEmail(user.email);
    }
  };

  return (
    <div className="flex w-full flex-col gap-6">
    <div className="cms-card w-full !p-6">
      <section id="profile">
        {/* Header */}
        <div className="border-b border-slate-200 pb-4 mb-6">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            {t('Pengaturan Profil')}</h2>
          <p className="text-xs text-slate-500 mt-1">{t('Perbarui informasi akun pribadi Anda.')}</p>
        </div>

        {/* Profile Info Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Avatar Silhouette */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 text-slate-500 shrink-0 shadow-inner">
              <span className="material-symbols-outlined text-4xl">person</span>
            </div>
            <div className="flex flex-col">
              <label className="text-[13px] font-medium text-slate-700">{t('Foto Akun')}</label>
              <span className="text-xs text-slate-500 mt-0.5">{t('Foto profil dinonaktifkan.')}</span>
            </div>
          </div>

          {/* Input Group */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-slate-700" htmlFor="prof-name">{t('Nama Lengkap')}</label>
              <input
                className="cms-input"
                id="prof-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t('mis. Ahmad Shafwan')}
                type="text"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-slate-700" htmlFor="prof-email">{t('Alamat Email')}</label>
              <input
                className="cms-input !bg-slate-50 !text-slate-600 cursor-not-allowed"
                id="prof-email"
                value={email}
                readOnly
                placeholder={t('mis. ahmad.shafwan@bki.co.id')}
                type="email"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-slate-700" htmlFor="prof-role">{t('Peran Akun')}</label>
              <input
                className="cms-input !bg-slate-50 !text-slate-600 cursor-not-allowed"
                id="prof-role"
                value={user?.role || ''}
                type="text"
                readOnly
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-slate-700" htmlFor="prof-dept">{t('Departemen')}</label>
              <input
                className="cms-input !bg-slate-50 !text-slate-600 cursor-not-allowed"
                id="prof-dept"
                value="BKI Academy Training Center"
                type="text"
                readOnly
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button type="button" onClick={handleDiscard} className="cms-btn-secondary">{t('Batalkan Perubahan')}</button>
            <button type="submit" disabled={isSubmitting} className="cms-btn-primary disabled:opacity-50">
              {isSubmitting ? t('Menyimpan...') : t('Simpan Profil')}
            </button>
          </div>
        </form>
      </section>
    </div>

    <div className="cms-card w-full !p-6">
      <section id="appearance">
        <div className="border-b border-slate-200 pb-4 mb-6">
          <h2 className="text-base font-semibold text-slate-900">{t('Tampilan')}</h2>
          <p className="text-xs text-slate-500 mt-1">{t('Pilih tampilan BKI Academy di perangkat ini.')}</p>
        </div>
        <div role="radiogroup" aria-label={t('Tema')} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {THEME_OPTIONS.map(opt => {
            const active = preference === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setPreference(opt.value)}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                  active
                    ? 'border-blue-600 bg-blue-50 text-slate-900 ring-1 ring-blue-600'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className={`material-symbols-outlined text-[20px] ${active ? 'text-blue-600' : 'text-slate-400'}`} aria-hidden="true">
                  {opt.icon}
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-medium">{t(opt.label)}</span>
                  <span className="text-xs text-slate-500">{t(opt.hint)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>

    <div className="cms-card w-full !p-6">
      <section id="language">
        <div className="border-b border-slate-200 pb-4 mb-6">
          <h2 className="text-base font-semibold text-slate-900">{t('Bahasa')}</h2>
          <p className="text-xs text-slate-500 mt-1">{t('Pilih bahasa antarmuka. Halaman akan dimuat ulang.')}</p>
        </div>
        <div role="radiogroup" aria-label={t('Bahasa')} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {LANGUAGE_OPTIONS.map(opt => {
            const active = language === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setLanguage(opt.value)}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                  active
                    ? 'border-blue-600 bg-blue-50 text-slate-900 ring-1 ring-blue-600'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className={`material-symbols-outlined text-[20px] ${active ? 'text-blue-600' : 'text-slate-400'}`} aria-hidden="true">translate</span>
                <span className="text-sm font-medium">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
    </div>
  );
}
