'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { useFloatingMenu } from '@/lib/useFloatingMenu';
import { useT } from '@/i18n/LanguageContext';

export interface ActionMenuItem {
  id?: string;
  label: string;
  icon?: string | React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

export interface ActionMenuProps {
  items: (ActionMenuItem | 'divider')[];
  menuWidth?: string;
  align?: 'left' | 'right';
  className?: string;
}

export const ActionMenu: React.FC<ActionMenuProps> = ({
  items,
  menuWidth = 'w-44',
  align = 'right',
  className = '',
}) => {
  const t = useT();
  const { isOpen, toggle, close, triggerRef, menuRef, style } = useFloatingMenu(align);

  return (
    <div className={`relative inline-block text-left ${className}`} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        ref={triggerRef as React.Ref<HTMLButtonElement>}
        onClick={toggle}
        className="row-actions-btn text-slate-500 hover:text-slate-900 hover:bg-slate-100 p-1.5 rounded-lg transition-colors cursor-pointer"
        title={t('Pilihan Aksi')}
        aria-label={t('Pilihan Aksi')}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <span className="material-symbols-outlined text-[18px] leading-none block" aria-hidden="true">more_vert</span>
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={style}
          onClick={(e) => e.stopPropagation()}
          className={`${menuWidth} bg-card border border-slate-200 rounded-xl shadow-lg p-1 z-[60] text-left`}
        >
          {items.map((item, idx) => {
            if (item === 'divider') {
              return <hr key={`div-${idx}`} className="border-slate-100 my-1" />;
            }

            const isDanger = item.variant === 'danger';

            return (
              <button
                key={item.id || idx}
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  close();
                  item.onClick();
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-[13px] rounded-lg transition-colors text-left cursor-pointer ${
                  isDanger
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-slate-700 hover:bg-slate-50'
                } ${item.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                {item.icon && (
                  <span className="shrink-0 flex items-center justify-center">
                    {typeof item.icon === 'string' ? (
                      <span className={`material-symbols-outlined text-sm leading-none ${isDanger ? 'text-red-500' : 'text-slate-400'}`}>
                        {item.icon}
                      </span>
                    ) : (
                      item.icon
                    )}
                  </span>
                )}
                <span className="leading-none whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
};

export default ActionMenu;
