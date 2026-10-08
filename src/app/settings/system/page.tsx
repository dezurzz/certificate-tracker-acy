'use client';

import React, { useState, useEffect } from 'react';
import ConfirmationModal from '@/components/ConfirmationModal';
import ExecutiveTargetsCard from '@/components/ExecutiveTargetsCard';
import { notify } from '@/lib/notify';
import { useT, useLanguage } from '@/i18n/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { isSupabaseEnvConfigured } from '@/lib/supabase/config';
import { fetchSlaSetting, saveSlaDays, isValidSlaDays, SLA_DEFAULT_DAYS, SLA_MIN_DAYS, SLA_MAX_DAYS, type SlaSetting } from '@/lib/settings';

export default function SystemSettingsPage() {
  const t = useT();
  const { locale } = useLanguage();
  const { user } = useAuth();
  const [sla, setSla] = useState(String(SLA_DEFAULT_DAYS));
  const [slaInfo, setSlaInfo] = useState<SlaSetting | null>(null);
  const [saving, setSaving] = useState(false);
  const [dbUrl, setDbUrl] = useState('');
  const [dbKey, setDbKey] = useState('');

  // User Provisioning fields
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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDbUrl(localStorage.getItem('supabase_url') || '');
      setDbKey(localStorage.getItem('supabase_key') || '');
    }
    // SLA comes from the central setting (Supabase), not from this browser
    fetchSlaSetting().then(info => {
      setSla(String(info.days));
      setSlaInfo(info);
    });
  }, []);

  const reportSlaError = (err: unknown) => {
    const e = err as Error & { tableMissing?: boolean };
    notify.error(
      t('Gagal menyimpan SLA'),
      e.tableMissing ? t('Tabel app_settings belum ada. Jalankan supabase_schema_settings.sql di Supabase.') : e.message
    );
  };

  const handleApplyConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const days = Number(sla);
    if (!isValidSlaDays(days)) {
      notify.warning(t('SLA harus bilangan bulat {min} sampai {max} hari', { min: SLA_MIN_DAYS, max: SLA_MAX_DAYS }));
      return;
    }
    // The connection must be saved first: the SLA write goes through it
    localStorage.setItem('supabase_url', dbUrl.trim());
    localStorage.setItem('supabase_key', dbKey.trim());
    setSaving(true);
    try {
      const { shared } = await saveSlaDays(days, user?.name || user?.email);
      setSlaInfo(await fetchSlaSetting());
      if (shared) notify.success(t('Konfigurasi sistem diterapkan'), t('SLA {days} hari berlaku untuk semua admin.', { days }));
      else notify.success(t('Konfigurasi sistem diterapkan'), t('Supabase belum terhubung: SLA hanya tersimpan di browser ini.'));
    } catch (err) {
      reportSlaError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefaults = () => {
    setConfirmConfig({
      isOpen: true,
      title: t('Reset Konfigurasi'),
      message: t('Reset semua konfigurasi ke nilai standar (SLA 4 hari)? Ini akan menimpa parameter aktif.'),
      confirmLabel: t('Kembalikan ke Default'),
      type: 'warning',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        try {
          // Reset the shared SLA first, while the Supabase connection still exists
          await saveSlaDays(SLA_DEFAULT_DAYS, user?.name || user?.email);
        } catch (err) {
          reportSlaError(err);
          return;
        }
        setSla(String(SLA_DEFAULT_DAYS));
        setDbUrl('');
        setDbKey('');
        localStorage.setItem('supabase_url', '');
        localStorage.setItem('supabase_key', '');
        setSlaInfo(await fetchSlaSetting());
        notify.success(t('Konfigurasi dikembalikan ke default sistem.'));
      }
    });
  };

  return (
    <div className="flex-1 cms-card w-full !p-6">
      <section id="system">
        {/* Header */}
        <div className="border-b border-slate-200 pb-4 mb-6">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            {t('Konfigurasi Sistem')}</h2>
          <p className="text-xs text-slate-500 mt-1">{t('Atur Service Level Agreement (SLA) global dan parameter pemrosesan.')}</p>
        </div>

        {/* Configuration Form */}
        <form onSubmit={handleApplyConfig} className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* SLA setting */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-4 text-left">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-700">{t('SLA Pemrosesan Standar (Hari)')}</label>
                <span className="cms-badge cms-badge-neutral">{t('Metrik Kritis')}</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  id="sys-sla"
                  value={sla}
                  onChange={(e) => setSla(e.target.value)}
                  className="cms-input w-24 text-center font-semibold"
                  type="number"
                  min={SLA_MIN_DAYS}
                  max={SLA_MAX_DAYS}
                  step={1}
                  required
                />
                <span className="text-xs text-slate-500 font-medium">{t('hari sejak selesai')}</span>
              </div>
              <p className="text-[11px] text-slate-500">{t('Batas sebelum permintaan sertifikat ditandai terlambat.')}</p>
              {slaInfo && (
                slaInfo.source === 'server' ? (
                  <p className="flex items-start gap-1.5 text-[11px] text-emerald-700" role="status">
                    <span className="material-symbols-outlined text-[14px]" aria-hidden="true">cloud_done</span>
                    <span>
                      {t('Tersimpan terpusat di Supabase dan berlaku untuk semua admin.')}
                      {slaInfo.updatedAt && (
                        <> {t('Terakhir diubah {by} pada {date}.', { by: slaInfo.updatedBy || '-', date: new Date(slaInfo.updatedAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }) })}</>
                      )}
                    </span>
                  </p>
                ) : (
                  <p className="flex items-start gap-1.5 text-[11px] text-amber-700" role="status">
                    <span className="material-symbols-outlined text-[14px]" aria-hidden="true">cloud_off</span>
                    <span>
                      {slaInfo.unavailableReason === 'table-missing'
                        ? t('Hanya tersimpan di browser ini. Jalankan supabase_schema_settings.sql di Supabase agar berlaku untuk semua admin.')
                        : slaInfo.unavailableReason === 'error'
                        ? t('Tidak dapat membaca pengaturan dari Supabase. Menampilkan nilai di browser ini.')
                        : t('Supabase belum terhubung: SLA hanya tersimpan di browser ini.')}
                    </span>
                  </p>
                )
              )}
            </div>

            {/* Supabase setting */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-4 md:col-span-2 text-left">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-700">{t('Pengaturan Koneksi Supabase')}</label>
                <span className="cms-badge cms-badge-neutral">{t('Sinkronisasi Database')}</span>
              </div>
              {isSupabaseEnvConfigured && (
                <p className="flex items-start gap-1.5 text-[11px] text-blue-700" role="note">
                  <span className="material-symbols-outlined text-[14px]" aria-hidden="true">lock</span>
                  <span>{t('Koneksi Supabase diatur di environment server (NEXT_PUBLIC_SUPABASE_URL dan ANON_KEY). Isian di bawah diabaikan.')}</span>
                </p>
              )}
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[13px] font-medium text-slate-700">{t('URL Proyek')}</label>
                  <input
                    id="sys-supabase-url"
                    disabled={isSupabaseEnvConfigured}
                    value={dbUrl}
                    onChange={(e) => setDbUrl(e.target.value)}
                    className="cms-input font-mono text-xs"
                    placeholder={t('https://xxxxxx.supabase.co')}
                    type="url"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[13px] font-medium text-slate-700">{t('Anon API Key')}</label>
                  <input
                    id="sys-supabase-key"
                    disabled={isSupabaseEnvConfigured}
                    value={dbKey}
                    onChange={(e) => setDbKey(e.target.value)}
                    className="cms-input font-mono text-xs"
                    placeholder={t('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...')}
                    type="password"
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                {t('Isi URL Supabase dan Anon API key untuk sinkronisasi data training, peserta, dan sertifikat secara real-time. Kosongkan untuk berjalan lokal dengan data mock di localStorage.')}</p>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button type="button" onClick={handleResetToDefaults} className="cms-btn-secondary">{t('Reset ke Default')}</button>
            <button type="submit" disabled={saving} className="cms-btn-primary disabled:opacity-50">{saving ? t('Menyimpan...') : t('Terapkan Konfigurasi')}</button>
          </div>
        </form>
      </section>

      <ExecutiveTargetsCard />
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
