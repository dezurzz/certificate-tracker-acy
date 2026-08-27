'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SettingsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/settings/profile');
  }, [router]);

  return (
    <div className="flex justify-center items-center p-12">
      <div className="animate-spin inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full"></div>
    </div>
  );
}
