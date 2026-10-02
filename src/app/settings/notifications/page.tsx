'use client';

import React, { useState, useEffect } from 'react';
import { notify } from '@/lib/notify';
import { useT } from '@/i18n/LanguageContext';

export default function NotificationsSettingsPage() {
  const t = useT();
  const [digest, setDigest] = useState(true);
  const [breaches, setBreaches] = useState(true);
  const [reports, setReports] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDigest(localStorage.getItem('notif_digest') !== 'false');
      setBreaches(localStorage.getItem('notif_breaches') !== 'false');
      setReports(localStorage.getItem('notif_reports') === 'true');
    }
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== 'undefined') {
      localStorage.setItem('notif_digest', String(digest));
      localStorage.setItem('notif_breaches', String(breaches));
      localStorage.setItem('notif_reports', String(reports));
      notify.success(t('Preferensi notifikasi diperbarui'));
    }
  };

  const handleDiscard = () => {
    if (typeof window !== 'undefined') {
      setDigest(localStorage.getItem('notif_digest') !== 'false');
      setBreaches(localStorage.getItem('notif_breaches') !== 'false');
      setReports(localStorage.getItem('notif_reports') === 'true');
      notify.info(t('Perubahan dibatalkan.'));
    }
  };

  return (
    <div className="cms-card w-full !p-6">
      <section id="notifications">
        {/* Header */}
        <div className="border-b border-slate-200 pb-4 mb-6">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            {t('Preferensi Notifikasi')}</h2>
          <p className="text-xs text-slate-500 mt-1">{t('Atur bagaimana dan kapan Anda menerima ringkasan sistem dan peringatan.')}</p>
        </div>

        {/* Preferences Form */}
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800" role="note">
          <span className="material-symbols-outlined text-[16px] mt-px" aria-hidden="true">info</span>
          <span>{t('Preferensi hanya disimpan di browser ini. Pengiriman email otomatis belum aktif, jadi belum ada email yang dikirim.')}</span>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            {/* Toggle Item 1 */}
            <div className="flex items-start justify-between p-4 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
              <div className="flex flex-col gap-1 pr-6 text-left">
                <span className="text-sm font-medium text-slate-900">{t('Ringkasan email')}</span>
                <span className="text-xs text-slate-500">{t('Terima ringkasan harian penyelesaian batch dan alur kerja PIC.')}</span>
              </div>
              <input
                id="notif-digest"
                checked={digest}
                onChange={(e) => setDigest(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer h-4 w-4"
                type="checkbox"
              />
            </div>

            {/* Toggle Item 2 */}
            <div className="flex items-start justify-between p-4 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
              <div className="flex flex-col gap-1 pr-6 text-left">
                <span className="text-sm font-medium text-slate-900">{t('Notifikasi peringatan SLA')}</span>
                <span className="text-xs text-slate-500">{t('Dapatkan peringatan segera saat usia proses sertifikat melebihi 7 hari.')}</span>
              </div>
              <input
                id="notif-breaches"
                checked={breaches}
                onChange={(e) => setBreaches(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer h-4 w-4"
                type="checkbox"
              />
            </div>

            {/* Toggle Item 3 */}
            <div className="flex items-start justify-between p-4 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
              <div className="flex flex-col gap-1 pr-6 text-left">
                <span className="text-sm font-medium text-slate-900">{t('Laporan analitik sistem')}</span>
                <span className="text-xs text-slate-500">{t('Terima grafik kinerja bulanan dan penilaian kepatuhan PIC di inbox Anda.')}</span>
              </div>
              <input
                id="notif-reports"
                checked={reports}
                onChange={(e) => setReports(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer h-4 w-4"
                type="checkbox"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button type="button" onClick={handleDiscard} className="cms-btn-secondary">{t('Batalkan Perubahan')}</button>
            <button type="submit" className="cms-btn-primary">{t('Simpan Preferensi')}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
