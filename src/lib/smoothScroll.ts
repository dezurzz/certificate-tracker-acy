import type Lenis from 'lenis';

/**
 * Small control surface around the page's Lenis instance (see components/SmoothScroll.tsx), so the rest of the app
 * never imports the library: dialogs pause it while they lock the page, and "scroll to a section" goes through it.
 */
export const SMOOTH_SCROLL_KEY = 'bki_smooth_scroll';
export const SMOOTH_SCROLL_EVENT = 'bki-smooth-scroll';

let instance: Lenis | null = null;
let pauses = 0;

export function registerSmoothScroll(lenis: Lenis | null) {
  instance = lenis;
  if (lenis && pauses > 0) lenis.stop();
}

/** Called by anything that locks page scroll (modals). Calls nest: smooth scroll resumes when all are released. */
export function pauseSmoothScroll() {
  pauses++;
  instance?.stop();
}

export function resumeSmoothScroll() {
  pauses = Math.max(0, pauses - 1);
  if (pauses === 0) instance?.start();
}

/** Default is on; only an explicit 'off' disables it. */
export function readSmoothScrollPreference(): boolean {
  try {
    return localStorage.getItem(SMOOTH_SCROLL_KEY) !== 'off';
  } catch {
    return true; // storage blocked
  }
}

/** For `useSyncExternalStore`: re-read when the preference changes (here or in another tab) or the OS motion setting changes. */
export function subscribeSmoothScroll(onChange: () => void) {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  window.addEventListener(SMOOTH_SCROLL_EVENT, onChange);
  window.addEventListener('storage', onChange);
  mq.addEventListener('change', onChange);
  return () => {
    window.removeEventListener(SMOOTH_SCROLL_EVENT, onChange);
    window.removeEventListener('storage', onChange);
    mq.removeEventListener('change', onChange);
  };
}

/** Whether smooth scrolling should actually run: wanted by the user and not overridden by reduced motion. */
export function smoothScrollActive(): boolean {
  return readSmoothScrollPreference() && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function writeSmoothScrollPreference(on: boolean) {
  try {
    localStorage.setItem(SMOOTH_SCROLL_KEY, on ? 'on' : 'off');
  } catch {
    /* storage blocked: the choice just lasts until the next load */
  }
  window.dispatchEvent(new Event(SMOOTH_SCROLL_EVENT));
}

/**
 * Scrolls an element to the top of the viewport, honouring its CSS `scroll-margin-top` (the sticky bars). Uses Lenis
 * when it is running, otherwise the browser's own scrolling (smooth unless the user prefers reduced motion).
 */
export function scrollToElement(el: HTMLElement | null) {
  if (!el) return;
  if (instance && pauses === 0) {
    instance.scrollTo(el); // Lenis already subtracts the element's CSS scroll-margin-top itself
    return;
  }
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

export function scrollToId(id: string) {
  scrollToElement(document.getElementById(id));
}
