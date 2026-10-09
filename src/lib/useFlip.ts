import { useLayoutEffect, useRef, type RefObject } from 'react';

/** Strong ease-out (the project's `--ease-out`): starts fast so the move reads as an immediate response. */
const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
const DURATION_MS = 240;
const STAGGER_MS = 28;
const MAX_STAGGERED = 8;

/**
 * FLIP animation for items that change place (e.g. a card moving to another kanban column).
 * Mark every item with `data-flip-id="<stable id>"`; whenever `changeKey` changes, each item that ended up somewhere
 * else slides from where it was to where it is now, using `transform` only (no layout work while animating).
 *
 *  - Items are matched by id, so it also works when React re-mounts the item under a different parent.
 *  - Positions are stored relative to the container, so scrolling the page never causes false movement.
 *  - New items and the first render do not animate; `prefers-reduced-motion` disables it.
 *  - A move that is interrupted by another (e.g. the card is rolled back) starts from where it is drawn right now,
 *    because the position is read after the browser applied the running animation.
 */
export function useFlip(containerRef: RefObject<HTMLElement | null>, changeKey: string) {
  const previous = useRef<Map<string, { x: number; y: number }>>(new Map());
  const lastKey = useRef<string | null>(null);

  useLayoutEffect(() => {
    const root = containerRef.current;
    if (!root) {
      previous.current = new Map();
      lastKey.current = null;
      return;
    }
    const origin = root.getBoundingClientRect();
    const items = Array.from(root.querySelectorAll<HTMLElement>('[data-flip-id]'));
    const next = new Map<string, { x: number; y: number }>();
    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animate = lastKey.current !== null && lastKey.current !== changeKey && !reduce;
    let order = 0;

    items.forEach(el => {
      const id = el.dataset.flipId as string;
      const r = el.getBoundingClientRect();
      const pos = { x: r.left - origin.left, y: r.top - origin.top };
      next.set(id, pos);
      const from = previous.current.get(id);
      if (!animate || !from) return;
      const dx = from.x - pos.x;
      const dy = from.y - pos.y;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
        { duration: DURATION_MS, easing: EASE_OUT, delay: Math.min(order++, MAX_STAGGERED) * STAGGER_MS, fill: 'backwards' }
      );
    });

    previous.current = next;
    lastKey.current = changeKey;
  });
}
