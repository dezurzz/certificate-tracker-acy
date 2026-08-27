'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    { name: 'Profile Settings', href: '/settings/profile', icon: 'person', active: pathname === '/settings/profile' },
    { name: 'Notification Preferences', href: '/settings/notifications', icon: 'notifications_active', active: pathname === '/settings/notifications' },
    { name: 'Security & Access', href: '/settings/security', icon: 'shield', active: pathname === '/settings/security' },
    { name: 'System Configuration', href: '/settings/system', icon: 'dns', active: pathname === '/settings/system' },
  ];

  return (
    <DashboardLayout pageTitle="Settings">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Settings</h2>
        <p className="text-sm text-slate-500 mt-1">Manage your account preferences and system configurations.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Settings Navigation */}
        <nav className="w-full lg:w-64 flex flex-col gap-1 shrink-0 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold transition-all duration-150 ${
                item.active
                  ? 'bg-slate-100 text-slate-900 font-bold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <span className={`material-symbols-outlined text-[20px] ${item.active ? 'fill' : ''}`}>{item.icon}</span>
              <span className="text-sm">{item.name}</span>
            </Link>
          ))}
        </nav>

        {/* Content Area */}
        <div className="flex-grow w-full">
          {children}
        </div>
      </div>
    </DashboardLayout>
  );
}
