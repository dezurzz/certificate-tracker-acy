'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { usePathname } from 'next/navigation';
import { DB } from '@/lib/db';
import { resolveBreadcrumb } from '@/lib/navigation';
import { useTheme } from '@/context/ThemeContext';
import Modal from '@/components/Modal';
import { useT, useLanguage } from '@/i18n/LanguageContext';
import { formatRelativeTime } from '@/lib/relativeTime';
import { rich } from '@/i18n/rich';
import { certStatusLabel } from '@/i18n/labels';
import { useSlaDays } from '@/lib/settings';

interface NotificationItem {
  type: string;
  icon: string;
  iconColor: string;
  message: React.ReactNode;
  time: Date;
}

interface HeaderProps {
  pageTitle: string;
  /** Opens the mobile sidebar drawer. */
  onMenuClick?: () => void;
  menuOpen?: boolean;
}

export default function Header({ pageTitle, onMenuClick, menuOpen = false }: HeaderProps) {
  const t = useT();
  const slaThreshold = useSlaDays();
  const { locale, language, setLanguage } = useLanguage();
  const { resolved, toggle } = useTheme();
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const crumb = resolveBreadcrumb(pathname);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [hasUnread, setHasUnread] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadNotifications() {
      try {
        const [trainings, certificates, histories] = await Promise.all([
          DB.getTrainings(),
          DB.getCertificates(),
          DB.getCertificateHistory()
        ]);

        const notifs: NotificationItem[] = [];

        // 1. SLA Overdue Alerts
        certificates.forEach(c => {
          if (c.status !== 'Completed' && c.sla_age_days > slaThreshold) {
            const name = c.participants ? c.participants.name : 'Unknown';
            const progName = c.trainings ? c.trainings.program_name : 'Training';
            const time = c.updated_at ? new Date(c.updated_at) : new Date(c.created_at || (Date.now() - 86400000));
            notifs.push({
              type: 'overdue',
              icon: 'warning',
              iconColor: 'text-red-600',
              message: rich(t, 'SLA Terlambat: {name} ({program}) terlambat {days} hari.', { name: <span className="font-semibold text-slate-900">{name}</span>, program: progName, days: c.sla_age_days }),
              time: time
            });
          }
        });

        // 2. Dynamic Status Update Notifications from CertificateHistory
        histories.forEach(h => {
          const cert = certificates.find(c => c.id === h.certificate_id);
          const name = cert?.participants ? cert.participants.name : 'Unknown';
          const progName = cert?.trainings ? cert.trainings.program_name : 'Training';

          let icon = 'info';
          let iconColor = 'text-slate-400';
          if (h.new_status === 'Completed') {
            icon = 'check_circle';
            iconColor = 'text-emerald-600';
          } else if (h.new_status === 'Printing') {
            icon = 'print';
            iconColor = 'text-amber-600';
          } else if (h.new_status === 'Pending') {
            icon = 'hourglass_empty';
            iconColor = 'text-slate-400';
          }

          notifs.push({
            type: 'status_update',
            icon: icon,
            iconColor: iconColor,
            message: rich(t, 'Pembaruan Sertifikat: {name} ({program}) dipindahkan ke {status} oleh {by}.', { name: <span className="font-semibold text-slate-900">{name}</span>, program: progName, status: certStatusLabel(t, h.new_status), by: h.changed_by }),
            time: new Date(h.created_at)
          });
        });

        // 3. New Training Batch
        trainings.forEach(training => {
          const time = training.created_at ? new Date(training.created_at) : new Date(training.start_date);
          notifs.push({
            type: 'new_batch',
            icon: 'add_circle',
            iconColor: 'text-blue-600',
            message: rich(t, 'Batch baru dibuat: {name} ({code}).', { name: <span className="font-semibold text-slate-900">{training.program_name}</span>, code: training.batch_code }),
            time: time
          });
        });

        // Sort by time descending
        notifs.sort((a, b) => b.time.getTime() - a.time.getTime());

        // Limit to 5
        const displayNotifs = notifs.slice(0, 5);
        setNotifications(displayNotifs);

        if (displayNotifs.length > 0) {
          const latestNotifTime = displayNotifs[0].time.getTime();
          const lastReadTime = parseInt(localStorage.getItem('bki_notif_read_timestamp') || '0');
          setHasUnread(latestNotifTime > lastReadTime);
        } else {
          setHasUnread(false);
        }
      } catch (err) {
        console.error('Error loading notifications:', err);
      }
    }

    loadNotifications();
    const handleDbUpdate = () => {
      loadNotifications();
    };
    window.addEventListener('bki-db-update', handleDbUpdate);
    const interval = setInterval(loadNotifications, 30000); // Check every 30s
    return () => {
      window.removeEventListener('bki-db-update', handleDbUpdate);
      clearInterval(interval);
    };
  }, [t, slaThreshold]);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAllRead = () => {
    localStorage.setItem('bki_notif_read_timestamp', Date.now().toString());
    setHasUnread(false);
  };

  const formatRelTime = (dateInput: Date) => formatRelativeTime(dateInput, t, locale);

  return (
    <>
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-2 border-b border-slate-200 bg-card/90 px-3 backdrop-blur sm:px-6 supports-[backdrop-filter]:bg-card/80">
        {/* Left Side: Breadcrumb (page H1 lives in the content area) */}
        <div className="flex min-w-0 items-center gap-1">
          <button
            type="button"
            onClick={onMenuClick}
            aria-label={t('Buka menu')}
            aria-controls="app-sidebar"
            aria-expanded={menuOpen}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 lg:hidden"
          >
            <span className="material-symbols-outlined text-[22px]" aria-hidden="true">menu</span>
          </button>
          <nav aria-label={t('Breadcrumb')} className="flex min-w-0 items-center gap-1.5 text-sm">
            {crumb.group && (
              <>
                <span className="hidden truncate text-slate-500 sm:inline">{t(crumb.group)}</span>
                <span className="hidden sm:inline-flex" aria-hidden="true">
                  <span className="material-symbols-outlined text-[16px] text-slate-300">chevron_right</span>
                </span>
              </>
            )}
            <span className="truncate font-medium text-slate-900" aria-current="page">{crumb.page ? t(crumb.page) : pageTitle}</span>
          </nav>
        </div>

        {/* Right Side: Actions */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {/* Language toggle */}
          <button
            type="button"
            onClick={() => setLanguage(language === 'id' ? 'en' : 'id')}
            aria-label={t('Ganti bahasa')}
            title={language === 'id' ? 'Switch to English' : 'Ganti ke Bahasa Indonesia'}
            className="flex h-9 items-center gap-1 rounded-lg px-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">translate</span>
            <span className="text-xs font-semibold">{language.toUpperCase()}</span>
          </button>

          {/* Theme toggle */}
          <button
            type="button"
            onClick={toggle}
            aria-label={resolved === 'dark' ? t('Aktifkan mode terang') : t('Aktifkan mode gelap')}
            title={resolved === 'dark' ? t('Mode terang') : t('Mode gelap')}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              {resolved === 'dark' ? 'light_mode' : 'dark_mode'}
            </span>
          </button>

          {/* Notification button */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => {
                setNotifOpen(!notifOpen);
                setProfileOpen(false);
              }}
              aria-label={t('Notifikasi')}
              aria-expanded={notifOpen}
              className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">notifications</span>
              {/* Red dot indicator */}
              {hasUnread && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 border-2 border-card rounded-full"></span>
              )}
            </button>
            
            {/* Dropdown content */}
            {notifOpen && (
              <div className="fixed inset-x-3 top-16 z-50 mt-2 overflow-hidden sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:w-80 rounded-xl border border-slate-200 bg-card text-left shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <span className="text-sm font-semibold text-slate-900">{t('Notifikasi')}</span>
                  <button onClick={markAllRead} className="text-xs font-medium text-blue-600 hover:text-blue-700">
                    {t('Tandai semua dibaca')}</button>
                </div>
                <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto table-scroll">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-xs text-slate-500">
                      <span className="material-symbols-outlined mb-1 block text-xl text-slate-400" aria-hidden="true">notifications_off</span>
                      {t('Belum ada notifikasi')}</div>
                  ) : (
                    notifications.map((n, index) => (
                      <div key={index} className="px-4 py-3 hover:bg-slate-50 flex gap-2">
                        <span className={`material-symbols-outlined ${n.iconColor} text-sm mt-0.5`}>{n.icon}</span>
                        <div>
                          <p className="text-xs text-slate-700">{n.message}</p>
                          <span className="mt-1 block text-[11px] text-slate-500">
                            {formatRelTime(n.time)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Help button */}
          <button
            onClick={() => setHelpOpen(true)}
            aria-label={t('Bantuan')}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">help_outline</span>
          </button>

          <div className="mx-1 hidden h-6 w-px bg-slate-200 sm:block"></div>

          {/* Profile Dropdown Button */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => {
                setProfileOpen(!profileOpen);
                setNotifOpen(false);
              }}
              aria-expanded={profileOpen}
              className={`flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors ${
                profileOpen ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
              </div>
              <span className="hidden text-[13px] font-medium text-slate-700 sm:inline">{user?.name || t('Admin')}</span>
              <svg
                className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${
                  profileOpen ? 'rotate-180 text-slate-600' : ''
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {/* Dropdown content */}
            {profileOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-card border border-slate-200 rounded-xl shadow-xl p-1.5 z-50 text-left animate-in fade-in zoom-in-95 duration-150">
                <Link
                  href="/settings/profile"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors group"
                >
                  <div className="w-6 h-6 rounded-md bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700 flex items-center justify-center shrink-0 transition-colors">
                    <span className="material-symbols-outlined text-[15px] leading-none">person</span>
                  </div>
                  <span>{t('Pengaturan Profil')}</span>
                </Link>
                <Link
                  href="/settings/system"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors group"
                >
                  <div className="w-6 h-6 rounded-md bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700 flex items-center justify-center shrink-0 transition-colors">
                    <span className="material-symbols-outlined text-[15px] leading-none">settings</span>
                  </div>
                  <span>{t('Konfigurasi')}</span>
                </Link>
                <div className="border-t border-slate-100 my-1"></div>
                <button
                  onClick={() => {
                    setProfileOpen(false);
                    signOut();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors group text-left"
                >
                  <div className="w-6 h-6 rounded-md bg-red-50 text-red-500 group-hover:bg-red-100 flex items-center justify-center shrink-0 transition-colors">
                    <span className="material-symbols-outlined text-[15px] leading-none">logout</span>
                  </div>
                  <span>{t('Keluar')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Support Center Help Modal */}
      {helpOpen && (
        <Modal isOpen={true} onClose={() => setHelpOpen(false)} title={t('Pusat Bantuan BKI Academy')} dismissOnBackdrop>
<div className="flex flex-col gap-4">
              <div>
                <h4 className="mb-2 text-sm font-semibold text-slate-900">{t('Pertanyaan yang Sering Diajukan')}</h4>
                <ul className="text-xs text-slate-600 flex flex-col gap-2 list-disc pl-4">
                  <li><strong>{t('Bagaimana mengubah status sertifikat?')}</strong> {t('Buka Detail Training → tab Sertifikat lalu klik kartu untuk melihat detail status alur kerja.')}</li>
                  <li><strong>{t('Bagaimana mengimpor peserta?')}</strong> {t('Buka Detail Training → tab Peserta lalu klik "Upload Participant List".')}</li>
                  <li><strong>{t('Di mana mengatur batas SLA?')}</strong> {t('Buka Pengaturan → Konfigurasi Sistem.')}</li>
                </ul>
              </div>
              <hr className="border-slate-100" />
              <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="material-symbols-outlined text-blue-600 text-2xl">mail</span>
                <div>
                  <p className="text-xs font-semibold text-slate-800">{t('Butuh Dukungan IT?')}</p>
                  <a href="mailto:support@bkiacademy.com" className="text-[11px] text-blue-600 hover:underline">
                    {t('support@bkiacademy.com')}</a>
                </div>
              </div>
            </div>
</Modal>
      )}
    </>
  );
}
