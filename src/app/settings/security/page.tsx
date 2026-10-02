'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { DB } from '@/lib/db';
import ConfirmationModal from '@/components/ConfirmationModal';
import { notify } from '@/lib/notify';
import { useT } from '@/i18n/LanguageContext';

export default function SecuritySettingsPage() {
  const t = useT();
  const { user } = useAuth();
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSigningOutOthers, setIsSigningOutOthers] = useState(false);
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

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPass.length < 8) {
      notify.warning(t('Password baru minimal 8 karakter'));
      return;
    }
    if (newPass !== confirmPass) {
      notify.warning(t('Konfirmasi password tidak sama dengan password baru'));
      return;
    }

    setIsSubmitting(true);
    try {
      const valid = await DB.verifyUserPassword(user?.email || '', currentPass);
      if (!valid) {
        notify.error(t('Password saat ini salah'));
        return;
      }
      await DB.updateUserPassword(newPass);
      notify.success(t('Password berhasil diperbarui'));
      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');
    } catch (err) {
      console.error(err);
      notify.error(t('Gagal memperbarui password'), err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOutOthers = () => {
    setConfirmConfig({
      isOpen: true,
      title: t('Keluarkan perangkat lain'),
      message: t('Semua browser atau perangkat lain yang masuk ke akun ini akan langsung keluar. Perangkat ini tetap masuk.'),
      confirmLabel: t('Keluarkan yang lain'),
      type: 'danger',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        setIsSigningOutOthers(true);
        try {
          await DB.signOutOtherSessions();
          notify.success(t('Perangkat lain berhasil dikeluarkan'));
        } catch (err) {
          notify.error(t('Gagal mengeluarkan perangkat lain'), err);
        } finally {
          setIsSigningOutOthers(false);
        }
      }
    });
  };

  return (
    <div className="flex-grow flex flex-col gap-6 w-full max-w-3xl">
      {/* Card 1: Update Password */}
      <div className="cms-card w-full !p-6">
        <section id="security-password">
          <div className="border-b border-slate-200 pb-4 mb-6">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              {t('Perbarui Password')}</h2>
            <p className="text-xs text-slate-500 mt-1">{t('Ubah kredensial akses akun Anda.')}</p>
          </div>

          <form onSubmit={handlePasswordUpdate} className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-6">
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-[13px] font-medium text-slate-700" htmlFor="current-pass">{t('Password Saat Ini')}</label>
                <input
                  className="cms-input"
                  id="current-pass"
                  type="password"
                  value={currentPass}
                  onChange={(e) => setCurrentPass(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-1.5 text-left">
                  <label className="text-[13px] font-medium text-slate-700" htmlFor="new-pass">{t('Password Baru')}</label>
                  <input
                    className="cms-input"
                    id="new-pass"
                    type="password"
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    minLength={8}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5 text-left">
                  <label className="text-[13px] font-medium text-slate-700" htmlFor="confirm-pass">{t('Konfirmasi Password Baru')}</label>
                  <input
                    className="cms-input"
                    id="confirm-pass"
                    type="password"
                    value={confirmPass}
                    onChange={(e) => setConfirmPass(e.target.value)}
                    minLength={8}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button type="submit" disabled={isSubmitting} className="cms-btn-primary disabled:opacity-50">
                {isSubmitting ? t('Memperbarui...') : t('Perbarui Password')}
              </button>
            </div>
          </form>
        </section>
      </div>

      {/* Card 2: 2FA (not available yet) */}
      <div className="cms-card w-full !p-6">
        <section id="security-2fa">
          <div className="border-b border-slate-200 pb-4 mb-6 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">{t('Autentikasi Dua Faktor (2FA)')}</h2>
              <p className="text-xs text-slate-500 mt-1">{t('Amankan sistem dengan perangkat verifikasi tambahan.')}</p>
            </div>
            <span className="cms-badge cms-badge-neutral shrink-0">{t('Belum tersedia')}</span>
          </div>
          <p className="text-sm text-slate-600">
            {t('Autentikasi dua faktor belum diaktifkan di sistem ini. Akun Anda hanya dilindungi password, jadi gunakan password yang kuat dan unik.')}</p>
        </section>
      </div>

      {/* Card 3: Sessions */}
      <div className="cms-card w-full !p-6">
        <section id="security-sessions">
          <div className="border-b border-slate-200 pb-4 mb-6">
            <h2 className="text-base font-semibold text-slate-900">{t('Sesi Login Aktif')}</h2>
            <p className="text-xs text-slate-500 mt-1">{t('Masuk sebagai')} {user?.email || t('akun ini')} {t('di perangkat ini.')}</p>
          </div>
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-slate-600 max-w-md">
              {t('Kehilangan perangkat atau memakai komputer bersama? Keluar dari semua tempat lain. Anda tetap masuk di sini.')}</p>
            <button
              type="button"
              onClick={handleSignOutOthers}
              disabled={isSigningOutOthers}
              className="cms-btn-secondary shrink-0 disabled:opacity-50"
            >
              {isSigningOutOthers ? t('Sedang keluar...') : t('Keluarkan perangkat lain')}
            </button>
          </div>
        </section>
      </div>

      {/* Confirmation Modal */}
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
  );
}
