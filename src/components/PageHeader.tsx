import React from 'react';

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Small content rendered next to the title (e.g. a status badge). */
  meta?: React.ReactNode;
  /** Right-aligned actions. Keep to 1 primary + max 2 secondary. */
  actions?: React.ReactNode;
  /** Rendered above the title (e.g. a back link). */
  before?: React.ReactNode;
}

/**
 * Single page-heading pattern for every screen:
 * title (h1) + one-line description on the left, actions on the right.
 * Wraps under the title on narrow viewports.
 */
export default function PageHeader({ title, description, meta, actions, before }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {before && <div className="mb-2">{before}</div>}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {meta}
        </div>
        {description && (
          <p className="mt-1 max-w-[70ch] text-sm text-slate-500">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 max-md:[&>*]:grow">{actions}</div>}
    </div>
  );
}
