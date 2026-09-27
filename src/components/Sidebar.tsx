'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const crmNav = [
    { name: 'Semua Leads', icon: 'person_search', href: '/crm/leads', active: pathname === '/crm/leads' },
    { name: 'Waiting List', icon: 'hourglass_top', href: '/crm/waiting-list', active: pathname === '/crm/waiting-list' },
    { name: 'Tugas Follow-up', icon: 'notification_important', href: '/crm/follow-ups', active: pathname === '/crm/follow-ups' },
    { name: 'Rekap Minat', icon: 'trending_up', href: '/crm/reports', active: pathname === '/crm/reports' }
  ];

  const certNav = [
    { name: 'Training Batches', icon: 'school', href: '/trainings', active: pathname.startsWith('/trainings') },
    { name: 'Monitoring Sertifikat', icon: 'verified', href: '/certificates', active: pathname === '/certificates' },
    { name: 'Riwayat Audit', icon: 'history', href: '/history-logs', active: pathname === '/history-logs' },
    { name: 'Laporan SLA', icon: 'assessment', href: '/reports', active: pathname === '/reports' }
  ];

  const directoryNav = [
    { name: 'Perusahaan', icon: 'corporate_fare', href: '/directory/companies', active: pathname === '/directory/companies' },
    { name: 'Kontak', icon: 'contacts', href: '/directory/contacts', active: pathname === '/directory/contacts' }
  ];

  const isSettingsActive = pathname.startsWith('/settings');

  return (
    <nav className="bg-[#131B2E] text-slate-300 w-64 h-screen fixed left-0 top-0 border-r border-slate-800 flex flex-col justify-between z-50">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800/80">
        <Link href="/dashboard" className="flex items-center gap-3 px-1 py-1 cursor-pointer group">
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center shrink-0 shadow-lg group-hover:scale-105 transition-transform">
            <span className="material-symbols-outlined text-white text-2xl fill">school</span>
          </div>
          <div className="overflow-hidden">
            <h1 className="font-bold text-white text-sm tracking-tight leading-tight">BKI Academy</h1>
            <p className="text-[10px] text-blue-400 font-medium uppercase tracking-wider">Integrated Platform</p>
          </div>
        </Link>
      </div>

      {/* Navigation Links Scrollable */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5 table-scroll">
        {/* Dashboard Link */}
        <div>
          <Link
            href="/dashboard"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 active:scale-95 ${
              pathname === '/dashboard'
                ? 'bg-blue-600 text-white font-semibold shadow-md'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <span className={`material-symbols-outlined text-lg ${pathname === '/dashboard' ? 'fill' : ''}`}>dashboard</span>
            <span className="text-sm">Dashboard</span>
          </Link>
        </div>

        {/* Section: Leads & Waiting List (CRM) */}
        <div>
          <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            Leads & Waiting List
          </p>
          <ul className="space-y-0.5">
            {crmNav.map(item => (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 active:scale-95 text-xs ${
                    item.active
                      ? 'bg-blue-600 text-white font-semibold shadow-md'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <span className={`material-symbols-outlined text-base ${item.active ? 'fill' : ''}`}>{item.icon}</span>
                  <span>{item.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Section: Certificate Tracker (Existing) */}
        <div>
          <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Certificate Tracker
          </p>
          <ul className="space-y-0.5">
            {certNav.map(item => (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 active:scale-95 text-xs ${
                    item.active
                      ? 'bg-blue-600 text-white font-semibold shadow-md'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <span className={`material-symbols-outlined text-base ${item.active ? 'fill' : ''}`}>{item.icon}</span>
                  <span>{item.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Section: Direktori Master */}
        <div>
          <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
            Direktori Data
          </p>
          <ul className="space-y-0.5">
            {directoryNav.map(item => (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 active:scale-95 text-xs ${
                    item.active
                      ? 'bg-blue-600 text-white font-semibold shadow-md'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <span className={`material-symbols-outlined text-base ${item.active ? 'fill' : ''}`}>{item.icon}</span>
                  <span>{item.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Bottom Profile & Settings Section */}
      <div className="p-3 border-t border-slate-800/80 space-y-2 bg-[#0F172A]/40">
        <Link
          href="/settings/profile"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-xs ${
            isSettingsActive
              ? 'bg-blue-600 text-white font-semibold shadow-md'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <span className={`material-symbols-outlined text-base ${isSettingsActive ? 'fill' : ''}`}>settings</span>
          <span>Pengaturan Sistem</span>
        </Link>
        
        {/* Administrator Card */}
        <div className="p-2.5 bg-slate-800/60 rounded-lg border border-slate-800 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 text-slate-400 shrink-0">
            <span className="material-symbols-outlined text-base">person</span>
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-semibold text-white truncate">{user?.name || 'Admin'}</p>
            <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider truncate">
              {user?.role || 'System Admin'}
            </p>
          </div>
        </div>
      </div>
    </nav>
  );
}
