import { msg } from './msg';
import type { TFunction } from './LanguageContext';

/**
 * Labels for raw values stored in the database. The stored value stays as is
 * (e.g. 'Processing'); only what the user reads is translated.
 */
const CERT_STATUS = {
  Pending: msg('Menunggu'),
  Processing: msg('Proses QC'),
  Printing: msg('Dicetak'),
  Shipping: msg('Pengiriman'),
  Completed: msg('Selesai'),
  Overdue: msg('Terlambat'),
} as const;

const CERT_TYPE = {
  Qualification: msg('Kualifikasi'),
  Attendance: msg('Kehadiran'),
} as const;

/** Raw values that are already Indonesian keys: lead status, source, waiting reason. */
const LEAD_VALUES = [
  msg('Baru'),
  msg('Waiting List'),
  msg('Jadwal Ditawarkan'),
  msg('Link Terkirim'),
  msg('Terdaftar'),
  msg('Selesai Training'),
  msg('Batal'),
  msg('WA Bisnis'),
  msg('WA Pribadi'),
  msg('Website'),
  msg('Referral'),
  msg('Event'),
  msg('Lainnya'),
  msg('Belum Ada Jadwal'),
  msg('Reschedule'),
  msg('Menunggu Konfirmasi Internal'),
  msg('Budgeting'),
] as const;
void LEAD_VALUES;

export const certStatusLabel = (t: TFunction, raw: string) =>
  t(CERT_STATUS[raw as keyof typeof CERT_STATUS] ?? raw);

export const certTypeLabel = (t: TFunction, raw: string) =>
  t(CERT_TYPE[raw as keyof typeof CERT_TYPE] ?? raw);

/** Translate a stored lead value (status / source / waiting reason). Unknown values pass through. */
export const leadValueLabel = (t: TFunction, raw: string) => t(raw);

const LEAD_ACTION = {
  created: msg('Dibuat'),
  follow_up: msg('Follow-up'),
  link_sent: msg('Link Terkirim'),
  registered: msg('Terdaftar'),
  rescheduled: msg('Dijadwalkan Ulang'),
  cancelled: msg('Dibatalkan'),
} as const;

export const leadActionLabel = (t: TFunction, raw: string) =>
  t(LEAD_ACTION[raw as keyof typeof LEAD_ACTION] ?? raw);
