'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useT } from '@/i18n/LanguageContext';
import { AppShellSkeleton } from '@/components/Skeleton';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const t = useT();
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading) {
    return <AppShellSkeleton label={t('Memuat sesi...')} />;
  }

  if (!user) {
    return null; // Prevents any content flashing before redirection triggers
  }

  return <>{children}</>;
}
