'use client';

import React from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';

interface DashboardLayoutProps {
  children: React.ReactNode;
  pageTitle: string;
}

export default function DashboardLayout({ children, pageTitle }: DashboardLayoutProps) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen flex bg-slate-50">
        {/* Sidebar Component */}
        <Sidebar />

        {/* Main Content Wrapper */}
        <div className="flex-1 ml-60 flex flex-col min-h-screen">
          {/* Header Component */}
          <Header pageTitle={pageTitle} />

          {/* Page Content */}
          <main className="flex-grow p-6 max-w-[1440px] mx-auto w-full">
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
