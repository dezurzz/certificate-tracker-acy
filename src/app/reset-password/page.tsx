'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { DB } from '@/lib/db';
import { notify } from '@/lib/notify';
import { useT } from '@/i18n/LanguageContext';
import { AuthCardSkeleton } from '@/components/Skeleton';

/**
 * Where the "reset password" email link lands (via /auth/callback?next=/reset-password, which turns the
 * one-time code into a session). The user chooses a new password WITHOUT knowing the old one, then is
 * signed out everywhere and sent to the login page to sign in with it. This is deliberately separate
 * from Pengaturan > Keamanan, which is for changing a password you already know.
 */
export default function ResetPasswordPage() {
  const t = useT();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      notify.warning(t('Password baru minimal 8 karakter'));
      return;
    }
    if (password !== confirm) {
      notify.warning(t('Konfirmasi password tidak sama dengan password baru'));
      return;
    }
    setSubmitting(true);
    try {
      await DB.updateUserPassword(password);
      // The recovery link signed the user in; end every session so they sign in with the new password
      await signOut();
      router.replace('/?reset=done');
    } catch (err) {
      notify.error(t('Gagal mengatur password baru'), err);
      setSubmitting(false);
    }
  };

  if (loading || !user) {
    return <AuthCardSkeleton label={t('Memeriksa tautan...')} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div className="w-full max-w-md bg-card rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="pt-8 pb-6 px-6 flex flex-col items-center text-center border-b border-slate-100">
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-white text-3xl" aria-hidden="true">lock</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 mb-1">{t('Buat Password Baru')}</h1>
          <p className="text-sm text-slate-500">
            {t('Untuk akun {email}', { email: user.email })}
          </p>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-slate-700 mb-1.5" htmlFor="new-password">
              {t('Password Baru')}
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={show ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
                className="cms-input pr-10"
                data-autofocus
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                aria-label={show ? t('Sembunyikan password') : t('Tampilkan password')}
                className="absolute inset-y-0 right-0 flex cursor-pointer items-center pr-3 text-slate-500 hover:text-slate-700"
              >
                <span className="material-symbols-outlined text-lg" aria-hidden="true">{show ? 'visibility' : 'visibility_off'}</span>
              </button>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">{t('Minimal 8 karakter.')}</p>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-slate-700 mb-1.5" htmlFor="confirm-password">
              {t('Konfirmasi Password Baru')}
            </label>
            <input
              id="confirm-password"
              type={show ? 'text' : 'password'}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
              className="cms-input"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex justify-center py-2.5 px-4 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            {submitting ? t('Menyimpan...') : t('Simpan Password Baru')}
          </button>
          <p className="text-center text-[11px] text-slate-500">
            {t('Setelah disimpan, Anda akan keluar dari semua perangkat dan masuk lagi dengan password baru.')}
          </p>
        </form>
      </div>
    </div>
  );
}
