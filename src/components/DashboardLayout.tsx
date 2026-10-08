'use client';

import React, { useCallback, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';

interface DashboardLayoutProps {
  children: React.ReactNode;
  pageTitle: string;
}

export default function DashboardLayout({ children, pageTitle }: DashboardLayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  return (
    <ProtectedRoute>
      <div className="min-h-screen flex bg-slate-50">
        {/* Sidebar Component */}
        <Sidebar open={menuOpen} onClose={closeMenu} />

        {/* Main Content Wrapper */}
        <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:ml-64 print:ml-0">
          {/* Header Component */}
          <Header pageTitle={pageTitle} onMenuClick={() => setMenuOpen(true)} menuOpen={menuOpen} />

          {/* Page Content */}
          <main className="mx-auto w-full min-w-0 max-w-[1440px] flex-grow px-4 pb-12 pt-5 sm:px-6 lg:px-8 lg:pt-6">
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
