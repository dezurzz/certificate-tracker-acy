'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import PageHeader from '@/components/PageHeader';
import { useT } from '@/i18n/LanguageContext';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const t = useT();
  const pathname = usePathname();

  const navItems = [
    { name: t('Pengaturan Profil'), href: '/settings/profile', icon: 'person', active: pathname === '/settings/profile' },
    { name: t('Preferensi Notifikasi'), href: '/settings/notifications', icon: 'notifications_active', active: pathname === '/settings/notifications' },
    { name: t('Keamanan & Akses'), href: '/settings/security', icon: 'shield', active: pathname === '/settings/security' },
    { name: t('Konfigurasi Sistem'), href: '/settings/system', icon: 'dns', active: pathname === '/settings/system' },
  ];

  return (
    <DashboardLayout pageTitle="Settings">
      <div className="space-y-6">
      <PageHeader title={t('Pengaturan')} description={t('Kelola preferensi akun dan konfigurasi sistem.')} />

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-8 items-start">
        {/* Settings Navigation */}
        <nav aria-label={t('Pengaturan')} className="table-scroll flex w-full shrink-0 gap-1 overflow-x-auto pb-1 lg:w-60 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.active ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-3 whitespace-nowrap rounded-lg border px-3 py-2 transition-colors ${
                item.active
                  ? 'border-slate-200 bg-card font-medium text-slate-900 shadow-[0_1px_2px_rgb(15_23_42/0.04)]'
                  : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className={`material-symbols-outlined text-[18px] ${item.active ? 'fill text-blue-600' : 'text-slate-400'}`} aria-hidden="true">{item.icon}</span>
              <span className="text-sm">{item.name}</span>
            </Link>
          ))}
        </nav>

        {/* Content Area */}
        <div className="flex-grow w-full">
          {children}
        </div>
      </div>
      </div>
    </DashboardLayout>
  );
}
