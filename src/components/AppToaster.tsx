'use client';

import { Toaster } from 'sonner';
import { useTheme } from '@/context/ThemeContext';

/**
 * The single Toaster for the whole app (mounted once in the root layout).
 * Styled with the same tokens as cards: white surface, slate border, 12px radius.
 * Only success / warning / error get a semantic icon color; everything else stays neutral.
 */
export default function AppToaster() {
  const { resolved } = useTheme();
  return (
    <Toaster
      theme={resolved}
      position="top-right"
      closeButton
      visibleToasts={4}
      duration={4000}
      offset={{ top: 72, right: 24 }}
      mobileOffset={{ top: 72, right: 16, left: 16 }}
      toastOptions={{
        classNames: {
          toast:
            '!rounded-xl !border !border-slate-200 !bg-card !text-slate-900 !shadow-lg !font-sans',
          title: '!text-[13px] !font-medium !text-slate-900',
          description: '!text-xs !text-slate-600',
          actionButton: '!bg-blue-600 !text-white !rounded-lg',
          cancelButton: '!bg-slate-100 !text-slate-700 !rounded-lg',
          closeButton: '!border-slate-200 !bg-card !text-slate-500',
          success: '[&_[data-icon]]:!text-emerald-600',
          warning: '[&_[data-icon]]:!text-amber-600',
          error: '[&_[data-icon]]:!text-red-600',
          info: '[&_[data-icon]]:!text-blue-600',
        },
      }}
    />
  );
}
