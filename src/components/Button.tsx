'use client';

import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'warning';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  className = '',
  disabled,
  ...props
}, ref) => {
  // Base classes that guarantee clean alignment, no overlapping, and smooth transitions
  const baseClasses = 'inline-flex items-center justify-center font-medium transition-colors select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

  // Variant styling matching BKI Academy design system
  const variantClasses = {
    primary: 'cms-btn-primary',
    secondary: 'cms-btn-secondary',
    danger: 'cms-btn-danger',
    success: 'bg-emerald-700 hover:bg-emerald-800 text-white border border-transparent shadow-xs active:scale-[0.98]',
    warning: 'bg-amber-700 hover:bg-amber-800 text-white border border-transparent shadow-xs active:scale-[0.98]',
    ghost: 'bg-transparent hover:bg-slate-100 text-slate-700 hover:text-slate-900 active:scale-[0.98]',
  }[variant];

  // Size variations
  const sizeClasses = {
    xs: '!h-7 !px-2.5 !py-1 !text-[11px] !gap-1.5 !rounded-md',
    sm: '!h-8 !px-3 !py-1.5 !text-xs !gap-2 !rounded-lg',
    md: '!h-10 !px-4 !py-2 !text-sm !gap-2 !rounded-lg',
    lg: '!h-11 !px-5 !py-2.5 !text-base !gap-2.5 !rounded-lg',
  }[size];

  // Render icon helper
  const renderIcon = (iconNode: React.ReactNode, isRight = false) => {
    if (!iconNode) return null;
    if (typeof iconNode === 'string') {
      const iconSizeClass = size === 'xs' ? 'text-[14px]' : size === 'sm' ? 'text-[16px]' : size === 'lg' ? 'text-[20px]' : 'text-[18px]';
      return (
        <span aria-hidden="true" className={`material-symbols-outlined ${iconSizeClass} shrink-0 leading-none ${isRight ? '-mr-0.5' : '-ml-0.5'}`}>
          {iconNode}
        </span>
      );
    }
    return <span className="shrink-0 flex items-center justify-center">{iconNode}</span>;
  };

  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClasses} ${sizeClasses} ${className}`}
      {...props}
    >
      {loading ? (
        <span className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full shrink-0" />
      ) : (
        renderIcon(icon)
      )}
      {children && <span className="leading-none whitespace-nowrap">{children}</span>}
      {!loading && renderIcon(iconRight, true)}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;
