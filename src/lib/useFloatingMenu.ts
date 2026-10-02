'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

interface FloatingPos {
  top: number;
  left?: number;
  right?: number;
}

const GAP = 6;
const VIEWPORT_PADDING = 8;

/**
 * Positions a dropdown menu with `position: fixed` relative to its trigger so it
 * escapes `overflow` clipping (tables, scroll containers). Render the menu in a
 * portal and pass `menuRef` + `style`. Flips above the trigger when there is no
 * room below; closes on outside click, Escape, resize and outside scroll.
 */
export function useFloatingMenu(align: 'left' | 'right' = 'right') {
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState<FloatingPos | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(o => !o), []);

  // Measure after the menu renders, then place below or flip above.
  useLayoutEffect(() => {
    if (!isOpen) {
      setPos(null);
      return;
    }
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;

    const t = trigger.getBoundingClientRect();
    const menuH = menu.offsetHeight;
    const spaceBelow = window.innerHeight - t.bottom;
    const placeAbove = spaceBelow < menuH + GAP + VIEWPORT_PADDING && t.top > spaceBelow;

    const top = placeAbove
      ? Math.max(VIEWPORT_PADDING, t.top - menuH - GAP)
      : t.bottom + GAP;

    setPos(
      align === 'right'
        ? { top, right: Math.max(VIEWPORT_PADDING, window.innerWidth - t.right) }
        : { top, left: Math.max(VIEWPORT_PADDING, t.left) }
    );
  }, [isOpen, align]);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    const onScroll = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setIsOpen(false);
    };
    const onResize = () => setIsOpen(false);

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [isOpen]);

  // Hidden until measured to avoid a one-frame jump.
  const style: React.CSSProperties = pos
    ? { position: 'fixed', top: pos.top, left: pos.left, right: pos.right }
    : { position: 'fixed', top: 0, left: 0, visibility: 'hidden' };

  return { isOpen, toggle, close, triggerRef, menuRef, style };
}
