import { msg } from '@/i18n/msg';

export interface NavItem {
  name: string;
  icon: string;
  href: string;
  /** Match nested routes (e.g. /trainings/[id]). */
  matchPrefix?: boolean;
}

export interface NavGroup {
  label: string | null;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [{ name: msg('Dashboard'), icon: 'space_dashboard', href: '/dashboard' }],
  },
  {
    label: msg('Leads & Waiting List'),
    items: [
      { name: msg('Semua Leads'), icon: 'person_search', href: '/crm/leads' },
      { name: msg('Waiting List'), icon: 'hourglass_top', href: '/crm/waiting-list' },
      { name: msg('Tugas Follow-up'), icon: 'notification_important', href: '/crm/follow-ups' },
      { name: msg('Rekap Minat'), icon: 'trending_up', href: '/crm/reports' },
    ],
  },
  {
    label: msg('Pelacak Sertifikat'),
    items: [
      { name: msg('Batch Training'), icon: 'school', href: '/trainings', matchPrefix: true },
      { name: msg('Monitoring Sertifikat'), icon: 'verified', href: '/certificates' },
      { name: msg('Riwayat Audit'), icon: 'history', href: '/history-logs' },
      { name: msg('Laporan SLA'), icon: 'assessment', href: '/reports' },
    ],
  },
  {
    label: msg('Direktori Data'),
    items: [
      { name: msg('Perusahaan'), icon: 'corporate_fare', href: '/directory/companies' },
      { name: msg('Kontak'), icon: 'contacts', href: '/directory/contacts' },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = {
  name: msg('Pengaturan'),
  icon: 'settings',
  href: '/settings/profile',
};

export function isNavActive(item: NavItem, pathname: string) {
  if (item.href.startsWith('/settings')) return pathname.startsWith('/settings');
  return item.matchPrefix ? pathname.startsWith(item.href) : pathname === item.href;
}

/** Resolve "Group / Page" for the top-bar breadcrumb. */
export function resolveBreadcrumb(pathname: string): { group: string | null; page: string | null } {
  if (pathname.startsWith('/settings')) return { group: null, page: SETTINGS_ITEM.name };
  for (const group of NAV_GROUPS) {
    const item = group.items.find(i => isNavActive(i, pathname));
    if (item) return { group: group.label, page: item.name };
  }
  return { group: null, page: null };
}
