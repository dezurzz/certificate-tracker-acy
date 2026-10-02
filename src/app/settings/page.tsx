'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/Skeleton';
import { useT } from '@/i18n/LanguageContext';

export default function SettingsRedirect() {
  const router = useRouter();
  const t = useT();
  useEffect(() => {
    router.replace('/settings/profile');
  }, [router]);

  return (
    <div className="cms-card space-y-4" role="status" aria-busy="true">
      <span className="sr-only">{t('Memuat...')}</span>
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-3 w-72 max-w-full" />
      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  );
}
