'use client';

import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import Button from './Button';
import { useT } from '@/i18n/LanguageContext';
import { pauseSmoothScroll, resumeSmoothScroll } from '@/lib/smoothScroll';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

const SIZE: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Several modals can be open at once (e.g. a confirmation over a form):
// only the top one reacts to Esc / traps focus, and scroll unlocks when the last one closes.
const openStack: symbol[] = [];

function useModalBehavior(isOpen: boolean, onClose: () => void, panelRef: React.RefObject<HTMLDivElement | null>) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isOpen) return;
    const id = Symbol('modal');
    openStack.push(id);
    const isTop = () => openStack[openStack.length - 1] === id;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    pauseSmoothScroll(); // Lenis would otherwise keep scrolling the page behind the dialog

    // Initial focus: first field in the body, else the first focusable, else the panel itself
    const panel = panelRef.current;
    const raf = requestAnimationFrame(() => {
      if (!panel) return;
      const target =
        panel.querySelector<HTMLElement>('[data-autofocus], form input:not([type="hidden"]), form select, form textarea') ||
        panel.querySelector<HTMLElement>(FOCUSABLE) ||
        panel;
      target.focus({ preventScroll: true });
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (!isTop()) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        el => el.offsetParent !== null || el === document.activeElement
      );
      if (items.length === 0) {
        e.preventDefault();
        panelRef.current.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !panelRef.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panelRef.current.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeyDown, true);
      const i = openStack.indexOf(id);
      if (i >= 0) openStack.splice(i, 1);
      if (openStack.length === 0) document.body.style.overflow = prevOverflow;
      resumeSmoothScroll();
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [isOpen, panelRef]);
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Material Symbols name shown before the title (neutral color). */
  icon?: string;
  size?: ModalSize;
  /** `center` dialog (default) or a `right` side drawer. */
  placement?: 'center' | 'right';
  children: React.ReactNode;
  /**
   * When set, body + footer are wrapped in a <form> and the submit button
   * (type="submit") fires this handler. Enter inside inputs submits as usual.
   */
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
  /** Standard footer: Cancel + submit. Ignored when `footer` is given. */
  submitLabel?: string;
  submitIcon?: string;
  submitVariant?: 'primary' | 'danger' | 'success' | 'warning';
  submitDisabled?: boolean;
  submitting?: boolean;
  cancelLabel?: string;
  /** Called by the submit button when there is no `onSubmit` form. */
  onConfirm?: () => void;
  /** Custom footer content (replaces the standard footer). */
  footer?: React.ReactNode;
  /** Close when clicking the dark backdrop. Off by default so half-filled forms aren't lost. */
  dismissOnBackdrop?: boolean;
  /** Stack above other modals (use for confirmations opened from a modal). */
  elevated?: boolean;
  /** Remove body padding (for content that brings its own, e.g. tables). */
  flush?: boolean;
  className?: string;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  icon,
  size = 'md',
  placement = 'center',
  children,
  onSubmit,
  submitLabel,
  submitIcon,
  submitVariant = 'primary',
  submitDisabled,
  submitting,
  cancelLabel,
  onConfirm,
  footer,
  dismissOnBackdrop = false,
  elevated = false,
  flush = false,
  className = '',
}: ModalProps) {
  const t = useT();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  useModalBehavior(isOpen, onClose, panelRef);

  if (!isOpen || typeof document === 'undefined') return null;

  const drawer = placement === 'right';

  const footerNode =
    footer ??
    (submitLabel ? (
      <>
        <Button type="button" variant="secondary" onClick={onClose}>
          {cancelLabel ?? t('Batal')}
        </Button>
        <Button
          type={onSubmit ? 'submit' : 'button'}
          variant={submitVariant}
          icon={submitIcon}
          loading={submitting}
          disabled={submitDisabled}
          onClick={onSubmit ? undefined : onConfirm}
        >
          {submitLabel}
        </Button>
      </>
    ) : null);

  const body = (
    <>
      <div className={`min-h-0 flex-1 overflow-y-auto table-scroll ${flush ? '' : 'px-5 py-5'}`}>{children}</div>
      {footerNode && (
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          {footerNode}
        </div>
      )}
    </>
  );

  return createPortal(
    <div
      className={`fixed inset-0 ${elevated ? 'z-[55]' : 'z-50'} flex bg-black/50 backdrop-blur-[2px] ${
        drawer ? 'justify-end' : 'items-center justify-center p-4'
      }`}
      onMouseDown={e => {
        if (dismissOnBackdrop && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={`flex flex-col bg-card shadow-xl outline-none animate-in fade-in duration-150 ${
          drawer
            ? `h-full w-full ${SIZE[size]} border-l border-slate-200 slide-in-from-right`
            : `max-h-[90vh] w-full ${SIZE[size]} rounded-xl border border-slate-200 zoom-in-95`
        } ${className}`}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="flex items-center gap-2 text-base font-semibold text-slate-900">
              {icon && (
                <span className="material-symbols-outlined text-[20px] text-slate-500" aria-hidden="true">
                  {icon}
                </span>
              )}
              <span className="truncate">{title}</span>
            </h2>
            {description && (
              <p id={descId} className="mt-0.5 text-xs text-slate-500">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Tutup')}
            className="-mr-1.5 -mt-1 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
          </button>
        </div>

        {onSubmit ? (
          <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
            {body}
          </form>
        ) : (
          body
        )}
      </div>
    </div>,
    document.body
  );
}
