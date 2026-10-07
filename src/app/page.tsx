'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { notify } from '@/lib/notify';
import { DB } from '@/lib/db';
import { useT } from '@/i18n/LanguageContext';
import { AuthCardSkeleton } from '@/components/Skeleton';
import { safeNextPath } from '@/lib/supabase/config';

/** Where to go after login: the page the visitor originally asked for (set by proxy.ts), same-site only. */
function nextPath() {
  return safeNextPath(new URLSearchParams(window.location.search).get('next'));
}

export default function LoginPage() {
  const t = useT();
  const router = useRouter();
  const { user, loading, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    // Set by /auth/callback when an email link (password reset) is invalid or expired
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'auth_callback') {
      notify.error(t('Tautan tidak valid atau sudah kedaluwarsa'), t('Minta tautan baru lewat "Lupa password?".'));
    }
    if (params.get('reset') === 'done') {
      notify.success(t('Password berhasil diubah'), t('Silakan masuk dengan password baru.'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loading && user) {
      router.push(nextPath());
    }
  }, [user, loading, router]);

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      notify.warning(t('Isi email terlebih dahulu'), t('Tautan reset akan dikirim ke alamat tersebut.'));
      return;
    }
    setIsResetting(true);
    try {
      await DB.sendPasswordReset(email.trim(), `${window.location.origin}/auth/callback?next=/reset-password`);
      // Same message whether or not the account exists
      notify.success(t('Cek email Anda'), t('Jika email terdaftar, tautan reset password sudah dikirim.'));
    } catch (err) {
      notify.error(t('Gagal mengirim tautan reset'), err);
    } finally {
      setIsResetting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    const result = await signIn(email.trim(), password);
    if (result.success) {
      router.push(nextPath());
    } else {
      notify.error(t('Login gagal'), result.error || 'Authentication failed');
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <AuthCardSkeleton label={t('Memeriksa sesi...')} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div className="w-full max-w-md bg-card rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {/* Header / Logo Area */}
        <div className="pt-8 pb-6 px-6 flex flex-col items-center text-center border-b border-slate-100 bg-card">
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-white text-3xl fill" aria-hidden="true">school</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 mb-1">{t('BKI Academy')}</h1>
          <p className="text-sm text-slate-500">{t('Sistem Manajemen Sertifikat')}</p>
        </div>

        {/* Login Form */}
        <div className="p-6 flex-grow">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[13px] font-medium text-slate-700 mb-1.5" htmlFor="email">
                {t('Alamat Email')}</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-slate-400 text-lg">mail</span>
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('admin@bkiacademy.edu')}
                  required
                  className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg bg-card text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15 transition-all text-sm"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[13px] font-medium text-slate-700" htmlFor="password">
                  {t('Password')}</label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={isResetting}
                  className="text-xs text-blue-600 hover:text-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isResetting ? t('Mengirim...') : t('Lupa password?')}
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-slate-400 text-lg">lock</span>
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="block w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg bg-card text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15 transition-all text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? t('Sembunyikan password') : t('Tampilkan password')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-slate-500 hover:text-slate-700"
                >
                  <span className="material-symbols-outlined text-lg">
                    {showPassword ? 'visibility' : 'visibility_off'}
                  </span>
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center py-2.5 px-4 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors active:scale-[0.98] cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-card border-t-transparent rounded-full align-middle mr-2"></span>
                    {t('Sedang masuk...')}</>
                ) : (
                  t('Masuk')
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Footer / Support */}
        <div className="bg-slate-50 px-6 py-4 text-center border-t border-slate-100">
          <p className="text-xs text-slate-500">
            {t('Butuh bantuan?')} <a className="text-blue-600 hover:underline" href="#">{t('Hubungi Dukungan IT')}</a>
          </p>
        </div>
      </div>
    </div>
  );
}
