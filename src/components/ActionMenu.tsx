'use client';

import React, { useState, useRef, useEffect } from 'react';

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
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className={`relative inline-block text-left ${className}`} ref={menuRef} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="row-actions-btn text-slate-400 hover:text-slate-700 p-1.5 rounded transition-colors focus:outline-none cursor-pointer"
        title="Pilihan Aksi"
      >
        <span className="material-symbols-outlined text-[18px] leading-none block">more_vert</span>
      </button>

      {isOpen && (
        <div
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-1 ${menuWidth} bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-30 text-left animate-in fade-in zoom-in-95 duration-100`}
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
                  setIsOpen(false);
                  item.onClick();
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors text-left cursor-pointer ${
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
        </div>
      )}
    </div>
  );
};

export default ActionMenu;
