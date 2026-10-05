'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { navGroupsForRole, SETTINGS_ITEM, NavItem, isNavActive } from '@/lib/navigation';
import { useT } from '@/i18n/LanguageContext';

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const t = useT();
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-colors ${
        active
          ? 'bg-white/10 font-medium text-white'
          : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
      }`}
    >
      {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-blue-500" aria-hidden="true" />}
      <span className={`material-symbols-outlined text-[18px] ${active ? 'fill text-blue-400' : ''}`} aria-hidden="true">
        {item.icon}
      </span>
      <span className="truncate">{t(item.name)}</span>
    </Link>
  );
}

interface SidebarProps {
  /** Mobile drawer state (ignored on lg+, where the sidebar is always visible). */
  open?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ open = false, onClose }: SidebarProps) {
  const t = useT();
  const pathname = usePathname();
  const { user } = useAuth();
  const initial = (user?.name || 'A').charAt(0).toUpperCase();

  // Close the mobile drawer after navigating, and on Esc
  useEffect(() => {
    onClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
    {/* Mobile backdrop */}
    <div
      aria-hidden="true"
      onClick={onClose}
      className={`fixed inset-0 z-[45] bg-black/50 transition-opacity lg:hidden ${
        open ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    />
    <nav
      id="app-sidebar"
      aria-label={t('Navigasi utama')}
      className={`sidebar-fixed fixed left-0 top-0 z-50 flex h-dvh w-64 flex-col justify-between border-r border-slate-800 bg-slate-900 text-slate-300 transition-transform duration-200 ease-out lg:translate-x-0 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* Brand */}
      <div className="flex h-16 items-center border-b border-slate-800 px-5">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600">
            <span className="material-symbols-outlined fill text-[18px] text-white" aria-hidden="true">school</span>
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-white">{t('BKI Academy')}</p>
            <p className="text-[11px] text-slate-400">{t('Platform Terintegrasi')}</p>
          </div>
        </Link>
      </div>

      {/* Groups */}
      <div className="table-scroll flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {navGroupsForRole(user?.roleKey ?? 'viewer').map(group => (
          <div key={group.label ?? 'root'}>
            {group.label && (
              <p className="mb-1.5 px-3 text-[11px] font-medium text-slate-500">{t(group.label)}</p>
            )}
            <ul className="space-y-0.5">
              {group.items.map(item => (
                <li key={item.href}>
                  <NavLink item={item} active={isNavActive(item, pathname)} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="space-y-1 border-t border-slate-800 p-3">
        <NavLink item={SETTINGS_ITEM} active={isNavActive(SETTINGS_ITEM, pathname)} />
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-slate-200">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-white">{user?.name || t('Admin')}</p>
            <p className="truncate text-[11px] text-slate-500">{user?.role || ''}</p>
          </div>
        </div>
      </div>
    </nav>
    </>
  );
}
