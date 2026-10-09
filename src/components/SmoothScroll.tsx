'use client';

import { useEffect, useSyncExternalStore } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { registerSmoothScroll, scrollToElement, smoothScrollActive, subscribeSmoothScroll } from '@/lib/smoothScroll';

/**
 * Smooth (inertial) scrolling for the mouse wheel and trackpad, using Lenis. Mounted once in the root layout.
 *
 *  - Wheel only: touch devices keep their native momentum scrolling, keyboard scrolling stays native.
 *  - Off when the OS asks for reduced motion, or when the user turned it off (Pengaturan > Profil > Tampilan).
 *  - Scrollable areas inside the page (sidebar, tables, dialogs) keep scrolling themselves (`allowNestedScroll`).
 *  - Dialogs pause it while they lock the page (lib/smoothScroll.ts), so the page behind never moves.
 *  - In-page `#section` links scroll smoothly and land below the sticky bars (they honour `scroll-margin-top`).
 */
export default function SmoothScroll() {
  // The preference lives in localStorage: the server (and the hydrating client) see "off", then it is read for real
  const enabled = useSyncExternalStore(subscribeSmoothScroll, smoothScrollActive, () => false);

  useEffect(() => {
    if (!enabled) return;
    const lenis = new Lenis({
      autoRaf: true,
      smoothWheel: true,
      syncTouch: false,
      lerp: 0.12,
      allowNestedScroll: true,
    });
    registerSmoothScroll(lenis);

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.('a[href^="#"]') as HTMLAnchorElement | null;
      const id = link?.getAttribute('href')?.slice(1);
      const target = id ? document.getElementById(decodeURIComponent(id)) : null;
      if (!target) return;
      e.preventDefault();
      scrollToElement(target);
    };
    document.addEventListener('click', onClick);

    return () => {
      document.removeEventListener('click', onClick);
      registerSmoothScroll(null);
      lenis.destroy();
    };
  }, [enabled]);

  return null;
}
