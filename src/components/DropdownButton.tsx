'use client';

import React, { useState, useRef, useEffect } from 'react';
import Button, { ButtonProps } from './Button';

export interface DropdownItem {
  id?: string;
  label: string;
  description?: string;
  icon?: string | React.ReactNode;
  iconColor?: string;
  onClick: () => void;
  variant?: 'default' | 'danger' | 'success' | 'warning';
  disabled?: boolean;
}

export interface DropdownButtonProps extends Omit<ButtonProps, 'onClick'> {
  items: (DropdownItem | 'divider')[];
  align?: 'left' | 'right';
  menuWidth?: string;
  headerTitle?: string;
  headerSubtitle?: string;
}

export const DropdownButton: React.FC<DropdownButtonProps> = ({
  children,
  items,
  variant = 'secondary',
  size = 'sm',
  align = 'right',
  menuWidth = 'w-48',
  headerTitle,
  headerSubtitle,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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

  const chevronIcon = (
    <svg
      className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : 'opacity-70'}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <Button
        variant={variant}
        size={size}
        icon={icon}
        iconRight={chevronIcon}
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`${isOpen ? 'ring-2 ring-blue-500/20' : ''} ${className}`}
        {...props}
      >
        {children}
      </Button>

      {isOpen && (
        <div
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-1.5 ${menuWidth} bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 z-40 text-left animate-in fade-in zoom-in-95 duration-150`}
        >
          {(headerTitle || headerSubtitle) && (
            <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 flex items-center justify-between mb-1">
              {headerTitle && <span>{headerTitle}</span>}
              {headerSubtitle && <span className="font-mono text-slate-500 normal-case">{headerSubtitle}</span>}
            </div>
          )}

          <div className="space-y-0.5">
            {items.map((item, idx) => {
              if (item === 'divider') {
                return <div key={`div-${idx}`} className="border-t border-slate-100 my-1" />;
              }

              const isDanger = item.variant === 'danger';
              const isSuccess = item.variant === 'success';

              return (
                <button
                  key={item.id || idx}
                  type="button"
                  disabled={item.disabled}
                  onClick={() => {
                    setIsOpen(false);
                    item.onClick();
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg transition-colors text-left group ${
                    isDanger
                      ? 'text-red-600 hover:bg-red-50'
                      : isSuccess
                      ? 'text-emerald-700 hover:bg-emerald-50'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                  } ${item.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {item.icon && (
                    <span className="shrink-0 flex items-center justify-center">
                      {typeof item.icon === 'string' ? (
                        <span className={`material-symbols-outlined text-[16px] leading-none ${item.iconColor || (isDanger ? 'text-red-500' : 'text-slate-400 group-hover:text-slate-600')}`}>
                          {item.icon}
                        </span>
                      ) : (
                        item.icon
                      )}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`leading-none truncate ${isDanger ? 'font-semibold text-red-600' : 'font-medium'}`}>
                      {item.label}
                    </p>
                    {item.description && (
                      <p className="text-[10px] text-slate-400 mt-1 leading-tight truncate">
                        {item.description}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default DropdownButton;
