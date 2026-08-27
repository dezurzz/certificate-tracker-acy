'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const menuItems = [
    { name: 'Dashboard', icon: 'dashboard', href: '/dashboard', active: pathname === '/dashboard' },
    { name: 'Training List', icon: 'school', href: '/trainings', active: pathname.startsWith('/trainings') },
    { name: 'Certificate Monitoring', icon: 'verified', href: '/certificates', active: pathname === '/certificates' },
    { name: 'History Logs', icon: 'history', href: '/history-logs', active: pathname === '/history-logs' },
    { name: 'Reports', icon: 'assessment', href: '/reports', active: pathname === '/reports' }
  ];

  const isSettingsActive = pathname.startsWith('/settings');

  return (
    <nav className="bg-[#131B2E] text-slate-300 w-60 h-screen fixed left-0 top-0 border-r border-slate-800 flex flex-col justify-between p-4 z-50">
      <div className="flex flex-col gap-6">
        {/* Brand Header */}
        <Link href="/dashboard" className="flex items-center gap-3 px-2 py-1 cursor-pointer group">
          <div className="w-10 h-10 rounded bg-blue-600 flex items-center justify-center shrink-0 shadow-lg group-hover:scale-105 transition-transform">
            <span className="material-symbols-outlined text-white text-2xl fill">school</span>
          </div>
          <div>
            <h1 className="font-bold text-white text-md tracking-tight leading-tight">BKI Academy</h1>
            <p className="text-xs text-slate-400">Management System</p>
          </div>
        </Link>

        {/* Navigation Links */}
        <ul className="flex flex-col gap-1 w-full">
          {menuItems.map(item => (
            <li key={item.name}>
              <Link
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 active:scale-95 ${
                  item.active
                    ? 'bg-blue-600 text-white font-semibold shadow-md'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className={`material-symbols-outlined text-lg ${item.active ? 'fill' : ''}`}>{item.icon}</span>
                <span className="text-sm">{item.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Bottom Profile & Settings Section */}
      <div className="flex flex-col gap-3">
        <div className="pt-4 border-t border-slate-800">
          <Link
            href="/settings/profile"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
              isSettingsActive
                ? 'bg-blue-600 text-white font-semibold shadow-md'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <span className={`material-symbols-outlined text-lg ${isSettingsActive ? 'fill' : ''}`}>settings</span>
            <span className="text-sm">Settings</span>
          </Link>
        </div>
        
        {/* Administrator Card */}
        <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 text-slate-500 shrink-0">
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
