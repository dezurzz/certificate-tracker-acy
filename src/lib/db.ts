import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseEnvConfigured } from '@/lib/supabase/config';
import { getErrorMessage } from '@/lib/errors';

// Cache singleton client instance to avoid recreating GoTrueClient instances
let cachedClient: SupabaseClient | null = null;
let lastUrl = '';
let lastKey = '';

// Retrieves the Supabase client as a singleton.
// - With server env configured (the normal/production case) the project comes from env ONLY and the
//   session lives in cookies, so proxy.ts can verify it on the server. localStorage overrides are ignored
//   (they could not be trusted by the server, and a script could otherwise repoint the app).
// - Without env (local demo) a URL/key saved in Settings is used, with a localStorage session.
export const getSupabaseClient = (): SupabaseClient | null => {
  let url = '';
  let key = '';
  const cookieSession = isSupabaseEnvConfigured;

  if (cookieSession) {
    url = SUPABASE_URL;
    key = SUPABASE_ANON_KEY;
  } else if (typeof window !== 'undefined') {
    url = localStorage.getItem('supabase_url') || '';
    key = localStorage.getItem('supabase_key') || '';
  }

  if (url && key) {
    // Return cached singleton instance if url & key haven't changed
    if (cachedClient && lastUrl === url && lastKey === key) {
      return cachedClient;
    }
    try {
      cachedClient = cookieSession ? createBrowserClient(url, key) : createClient(url, key);
      lastUrl = url;
      lastKey = key;
      return cachedClient;
    } catch (e) {
      console.error('Failed to create Supabase client:', e);
      return null;
    }
  }

  cachedClient = null;
  lastUrl = '';
  lastKey = '';
  return null;
};

export const supabase = getSupabaseClient();

if (typeof window !== 'undefined') {
  console.log('BKI Academy Supabase dynamic client initialized:', !!supabase);
}

// Dispatches a global event on the window to sync database states in real-time
/**
 * When a Supabase client exists, a rejected query must surface as an error.
 * Falling through to the localStorage demo store would save the row in one
 * browser only while the UI reports success. localStorage is for demo mode
 * (no Supabase configured) only.
 */
const throwIfError = (error: { message: string } | null | undefined) => {
  if (error) throw new Error(error.message);
};

// Read de-duplication: concurrent callers (header, page, repeated events) share
// one in-flight request, and a fresh result is reused for a few seconds. Any
// write clears the cache (notifyDbUpdate); failed reads are never cached.
const READ_CACHE_TTL_MS = 3000;
const readCache = new Map<string, { at: number; promise: Promise<unknown> }>();
const clearReadCache = () => readCache.clear();
function cachedRead<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const hit = readCache.get(key);
  if (hit && Date.now() - hit.at < READ_CACHE_TTL_MS) return hit.promise as Promise<T>;
  const promise = fetcher();
  readCache.set(key, { at: Date.now(), promise });
  promise.catch(() => {
    if (readCache.get(key)?.promise === promise) readCache.delete(key);
  });
  return promise;
}

/**
 * Under row level security a DELETE the caller may not perform does NOT fail: the row is simply
 * invisible, so zero rows are deleted and no error is returned. Treat that as an error so the UI
 * never reports a delete that did not happen.
 */
function assertDeleted(rows: unknown[] | null | undefined, message: string) {
  if (!rows || rows.length === 0) throw new Error(message);
}

let dbNotifyPaused = false;
const notifyDbUpdate = () => {
  clearReadCache();
  if (dbNotifyPaused) return;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('bki-db-update'));
  }
};

const isValidUUID = (str?: unknown): boolean => {
  if (typeof str !== 'string' || !str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
};

export interface Training {
  id: string;
  program_name: string;
  batch_code: string;
  service_type: string;
  learning_method: string;
  start_date: string;
  end_date: string;
  location: string;
  status: string;
  pic?: string;
  created_at?: string;
  /** Auth user id of the creator (owner). Added in roles stage 4; null/undefined for older rows. */
  created_by?: string | null;
}

export interface Participant {
  id: string;
  name: string;
  company: string;
  registration_number: string;
  email?: string;
  position?: string;
  phone?: string;
}

export interface Certificate {
  id: string;
  training_id: string;
  participant_id: string;
  certificate_type: 'Qualification' | 'Attendance';
  certificate_number: string;
  status: string;
  evaluation_result?: string;
  sla_age_days: number;
  file_url?: string;
  generated_at?: string;
  printed_at?: string;
  printed_by?: string;
  sent_at?: string;
  sent_by?: string;
  created_at?: string;
  updated_at?: string;
  updated_by?: string;
  trainings?: Training;
  participants?: Participant;
  /** Auth user id of the creator (owner). Added in roles stage 4; null/undefined for older rows. */
  created_by?: string | null;
}

export interface CertificateHistory {
  id: string;
  certificate_id: string;
  previous_status: string;
  new_status: string;
  changed_by: string;
  note: string;
  created_at: string;
}

export type LeadStatus = 'Baru' | 'Waiting List' | 'Jadwal Ditawarkan' | 'Link Terkirim' | 'Terdaftar' | 'Selesai Training' | 'Batal';
export type LeadSource = 'WA Bisnis' | 'WA Pribadi' | 'Website' | 'Referral' | 'Event' | 'Lainnya';
export type WaitingReason = 'Belum Ada Jadwal' | 'Reschedule' | 'Menunggu Konfirmasi Internal' | 'Budgeting' | 'Lainnya';

export interface Company {
  id: string;
  name: string;
  alias?: string;
  industry?: string;
  address?: string;
  created_at?: string;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  company_id?: string;
  company_name?: string;
  position?: string;
  notes?: string;
  created_at?: string;
}

// Official 21 Training Programs of BKI Academy
export const BKI_TRAINING_PROGRAMS = [
  'Internal Auditor ISM Code',
  'DPA ISM Code',
  'Risk Assessment ISM Code',
  'Marine Accident and Investigation',
  'Jetty and Loading Master',
  'Maritime Cyber Security',
  'Internal Auditor ISPS Code',
  'CSO ISPS Code',
  'PFSO ISPS Code',
  '3.24 Security Awareness (Designated Security Duties)',
  '3.25 Security Awareness (All Port Facility Personnel)',
  'Marine Surveyor',
  'New Building Supervision',
  'Marine Superintendent',
  'Container Inspector',
  'Welding Inspector',
  'Ship Welding Inspector',
  'Welder Certification',
  'Maritime Labour Convention',
  'Ballast Water Management',
  'Ship-Design Engineering Review Workshop',
] as const;

export type BkiTrainingProgramName = (typeof BKI_TRAINING_PROGRAMS)[number];

export interface TrainingProgram {
  id: string;
  name: string;
  code: string;
  category?: string;
  duration_days?: number;
  description?: string;
  is_active: boolean;
  created_at?: string;
}

export interface Lead {
  id: string;
  contact_id?: string;
  contact_name: string;
  contact_phone: string;
  contact_email?: string;
  company_id?: string;
  company_name: string;
  program_id?: string;
  program_name: string;
  batch_id?: string;
  batch_code?: string;
  estimated_seats: number;
  confirmed_seats?: number;
  status: LeadStatus;
  waiting_reason?: WaitingReason;
  cancel_reason?: string;
  source: LeadSource;
  pic_staff_name: string;
  next_follow_up_date: string; // YYYY-MM-DD
  notes?: string;
  previous_batch_info?: string;
  created_at: string;
  updated_at?: string;
  /** Auth user id of the creator (owner). Added in roles stage 4; null/undefined for older rows. */
  created_by?: string | null;
}

export interface LeadActivity {
  id: string;
  lead_id: string;
  action_type: 'created' | 'status_changed' | 'link_sent' | 'registered' | 'follow_up' | 'rescheduled' | 'cancelled' | 'note_added';
  note: string;
  actor: string;
  previous_status?: LeadStatus;
  new_status?: LeadStatus;
  created_at: string;
}

/** Digits-only phone in local form, so 0812…, +62812… and 62812… match. */
export const normalizePhone = (raw?: string): string => {
  let d = (raw || '').replace(/\D/g, '');
  if (d.startsWith('62')) d = '0' + d.slice(2);
  else if (d && !d.startsWith('0')) d = '0' + d;
  return d;
};

/** Company names that are individuals, not organisations: never added to the company directory. */
const isPersonalCompany = (name?: string) => !name || name.trim().toUpperCase() === 'PRIBADI';
const cleanName = (name: string) => name.trim().replace(/\s+/g, ' ');

/** Slim rows for the header bell: only what the notification text needs. */
export interface NotificationSources {
  overdue: { id: string; participant_name: string; program_name: string; sla_age_days: number; time: string }[];
  history: { id: string; participant_name: string; program_name: string; new_status: string; changed_by: string; time: string }[];
  trainings: { id: string; program_name: string; batch_code: string; time: string }[];
}

export interface LeadStatusOptions {
  note?: string;
  reason?: WaitingReason;
  cancelReason?: string;
  batchId?: string;
  batchCode?: string;
  confirmedSeats?: number;
  nextFollowUp?: string;
  actor?: string;
}

export const DB = {
  // Check if Supabase client is active
  isSupabaseConfigured(): boolean {
    return !!getSupabaseClient();
  },

  // Initialize mock data in localStorage (Client side only)
  initMock() {
    if (typeof window === 'undefined') return;

    if (!localStorage.getItem('bki_trainings')) {
      const mockTrainings: Training[] = [
        { 
          id: "t-116", 
          program_name: "Internal Auditor ISM Code", 
          batch_code: "Batch 116", 
          service_type: "PUBLIC TRAINING", 
          learning_method: "OFFLINE", 
          start_date: "2026-08-03", 
          end_date: "2026-08-05", 
          location: "Jakarta Training Center", 
          status: "Completed", 
          pic: "Andi", 
          created_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString() 
        },
        { 
          id: "t-53", 
          program_name: "CSO ISPS Code", 
          batch_code: "Batch 53", 
          service_type: "PUBLIC TRAINING", 
          learning_method: "OFFLINE", 
          start_date: "2026-08-10", 
          end_date: "2026-08-12", 
          location: "Surabaya Hub", 
          status: "Processing", 
          pic: "Budi", 
          created_at: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString() 
        }
      ];
      localStorage.setItem('bki_trainings', JSON.stringify(mockTrainings));
    }

    if (!localStorage.getItem('bki_participants')) {
      const mockParticipants: Participant[] = [
        { id: "p-001", name: "Ahmad Rizky", company: "Pertamina Shipping", registration_number: "0001" },
        { id: "p-002", name: "Sinta Maharani", company: "Pelindo II", registration_number: "0002" },
        { id: "p-003", name: "Budi Santoso", company: "Bumi Resources", registration_number: "0003" },
        { id: "p-004", name: "Dewi Lestari", company: "Meratus Line", registration_number: "0004" }
      ];
      localStorage.setItem('bki_participants', JSON.stringify(mockParticipants));
    }

    if (!localStorage.getItem('bki_certificates')) {
      const mockCertificates: Certificate[] = [
        { 
          id: "c-001", 
          training_id: "t-116", 
          participant_id: "p-001", 
          certificate_type: "Qualification", 
          certificate_number: "BKI-116-001", 
          status: "Printing", 
          evaluation_result: "Lulus", 
          sla_age_days: 5, 
          created_at: new Date(Date.now() - 25 * 24 * 3600 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 25 * 24 * 3600 * 1000).toISOString()
        },
        { 
          id: "c-002", 
          training_id: "t-116", 
          participant_id: "p-002", 
          certificate_type: "Attendance", 
          certificate_number: "BKI-116-002", 
          status: "Completed", 
          evaluation_result: "Lulus", 
          sla_age_days: 0, 
          created_at: new Date(Date.now() - 25 * 24 * 3600 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 25 * 24 * 3600 * 1000).toISOString(),
          printed_at: new Date(Date.now() - 24 * 24 * 3600 * 1000).toISOString(), 
          printed_by: "Andi", 
          sent_at: new Date(Date.now() - 23 * 24 * 3600 * 1000).toISOString(), 
          sent_by: "Andi" 
        },
        { 
          id: "c-003", 
          training_id: "t-116", 
          participant_id: "p-003", 
          certificate_type: "Qualification", 
          certificate_number: "BKI-116-003", 
          status: "Pending", 
          evaluation_result: "Lulus", 
          sla_age_days: 2, 
          created_at: new Date(Date.now() - 25 * 24 * 3600 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 25 * 24 * 3600 * 1000).toISOString()
        },
        { 
          id: "c-004", 
          training_id: "t-116", 
          participant_id: "p-004", 
          certificate_type: "Qualification", 
          certificate_number: "BKI-116-004", 
          status: "Completed", 
          evaluation_result: "Lulus", 
          sla_age_days: 0, 
          created_at: new Date(Date.now() - 25 * 24 * 3600 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 25 * 24 * 3600 * 1000).toISOString(),
          printed_at: new Date(Date.now() - 24 * 24 * 3600 * 1000).toISOString(), 
          printed_by: "Andi", 
          sent_at: new Date(Date.now() - 23 * 24 * 3600 * 1000).toISOString(), 
          sent_by: "Andi" 
        }
      ];
      localStorage.setItem('bki_certificates', JSON.stringify(mockCertificates));
    }

    if (!localStorage.getItem('bki_certificate_history')) {
      const mockHistory: CertificateHistory[] = [
        {
          id: "h-001",
          certificate_id: "c-001",
          previous_status: "Pending",
          new_status: "Processing",
          changed_by: "Andi",
          note: "Moved status from Pending to Processing",
          created_at: new Date(Date.now() - 25 * 24 * 3600 * 1000).toISOString()
        },
        {
          id: "h-002",
          certificate_id: "c-001",
          previous_status: "Processing",
          new_status: "Printing",
          changed_by: "Andi",
          note: "Moved status from Processing to Printing",
          created_at: new Date(Date.now() - 24 * 24 * 3600 * 1000).toISOString()
        },
        {
          id: "h-003",
          certificate_id: "c-002",
          previous_status: "Pending",
          new_status: "Processing",
          changed_by: "Andi",
          note: "Moved status from Pending to Processing",
          created_at: new Date(Date.now() - 25 * 24 * 3600 * 1000).toISOString()
        },
        {
          id: "h-004",
          certificate_id: "c-002",
          previous_status: "Processing",
          new_status: "Printing",
          changed_by: "Andi",
          note: "Moved status from Processing to Printing",
          created_at: new Date(Date.now() - 24 * 24 * 3600 * 1000).toISOString()
        },
        {
          id: "h-005",
          certificate_id: "c-002",
          previous_status: "Printing",
          new_status: "Completed",
          changed_by: "Andi",
          note: "Moved status from Printing to Completed",
          created_at: new Date(Date.now() - 23 * 24 * 3600 * 1000).toISOString()
        }
      ];
      localStorage.setItem('bki_certificate_history', JSON.stringify(mockHistory));
    }

    if (!localStorage.getItem('bki_companies')) {
      const mockCompanies: Company[] = [
        { id: "comp-1", name: "PT Pertamina International Shipping", alias: "Pertamina Shipping", industry: "Maritime & Oil/Gas", created_at: new Date().toISOString() },
        { id: "comp-2", name: "PT Pelabuhan Indonesia (Pelindo)", alias: "Pelindo II", industry: "Port Operations", created_at: new Date().toISOString() },
        { id: "comp-3", name: "PT Meratus Line", alias: "Meratus", industry: "Shipping & Logistics", created_at: new Date().toISOString() },
        { id: "comp-4", name: "PT Samudera Indonesia Tbk", alias: "Samudera Indonesia", industry: "Shipping", created_at: new Date().toISOString() },
        { id: "comp-5", name: "PT Bumi Resources", alias: "Bumi Resources", industry: "Mining & Energy", created_at: new Date().toISOString() }
      ];
      localStorage.setItem('bki_companies', JSON.stringify(mockCompanies));
    }

    if (!localStorage.getItem('bki_contacts')) {
      const mockContacts: Contact[] = [
        { id: "cnt-1", name: "Hendra Wijaya", phone: "081234567890", email: "hendra.w@pertamina.com", company_name: "PT Pertamina International Shipping", position: "Crewing & Training Manager", created_at: new Date().toISOString() },
        { id: "cnt-2", name: "Maya Kartika", phone: "081398765432", email: "maya.k@pelindo.co.id", company_name: "PT Pelabuhan Indonesia (Pelindo)", position: "HR & People Development", created_at: new Date().toISOString() },
        { id: "cnt-3", name: "Doni Prasetyo", phone: "081122334455", email: "doni.p@meratus.com", company_name: "PT Meratus Line", position: "HSE Specialist", created_at: new Date().toISOString() },
        { id: "cnt-4", name: "Citra Dewi", phone: "085711223344", email: "citra.dewi@gmail.com", company_name: "PRIBADI", position: "Marine Surveyor Independent", created_at: new Date().toISOString() },
        { id: "cnt-5", name: "Rahmat Hidayat", phone: "081299887766", email: "rahmat.h@samudera.id", company_name: "PT Samudera Indonesia Tbk", position: "QHSE Manager", created_at: new Date().toISOString() }
      ];
      localStorage.setItem('bki_contacts', JSON.stringify(mockContacts));
    }

    const mockPrograms: TrainingProgram[] = [
      { id: "prog-1", name: "Internal Auditor ISM Code", code: "ISM-AUD", category: "ISM Code & Safety", duration_days: 3, is_active: true, created_at: new Date().toISOString() },
      { id: "prog-2", name: "DPA ISM Code", code: "ISM-DPA", category: "ISM Code & Safety", duration_days: 3, is_active: true, created_at: new Date().toISOString() },
      { id: "prog-3", name: "Risk Assessment ISM Code", code: "ISM-RA", category: "ISM Code & Safety", duration_days: 2, is_active: true, created_at: new Date().toISOString() },
      { id: "prog-4", name: "Marine Accident and Investigation", code: "MAI", category: "Maritime Investigation", duration_days: 4, is_active: true, created_at: new Date().toISOString() },
      { id: "prog-5", name: "Jetty and Loading Master", code: "JLM", category: "Port & Terminal Operations", duration_days: 3, is_active: true, created_at: new Date().toISOString() },
      { id: "prog-6", name: "Maritime Cyber Security", code: "MCS", category: "Cyber & Digital Security", duration_days: 2, is_active: true, created_at: new Date().toISOString() },
      { id: "prog-7", name: "Internal Auditor ISPS Code", code: "ISPS-AUD", category: "ISPS Code & Port Security", duration_days: 3, is_active: true, created_at: new Date().toISOString() },
      { id: "prog-8", name: "CSO ISPS Code", code: "ISPS-CSO", category: "ISPS Code & Port Security", duration_days: 3, is_active: true, created_at: new Date().toISOString() },
      { id: "prog-9", name: "PFSO ISPS Code", code: "ISPS-PFSO", category: "ISPS Code & Port Security", duration_days: 3, is_active: true, created_at: new Date().toISOString() },
      { id: "prog-10", name: "3.24 Security Awareness (Designated Security Duties)", code: "IMO-3.24", category: "ISPS Code & Port Security", duration_days: 1, is_active: true, created_at: new Date().toISOString() },
      { id: "prog-11", name: "3.25 Security Awareness (All Port Facility Personnel)", code: "IMO-3.25", category: "ISPS Code & Port Security", duration_days: 1, is_active: true, created_at: new Date().toISOString() },
      { id: "prog-12", name: "Marine Surveyor", code: "MS", category: "Survey & Inspection", duration_days: 5, is_active: true, created_at: new Date().toISOString() },
      { id: "prog-13", name: "New Building Supervision", code: "NBS", category: "Survey & Inspection", duration_days: 4, is_active: true, created_at: new Date().toISOString() },
      { id: "prog-14", name: "Marine Superintendent", code: "MSUP", category: "Technical & Ship Operations", duration_days: 4, is_active: true, created_at: new Date().toISOString() },
      { id: "prog-15", name: "Container Inspector", code: "CI", category: "Survey & Inspection", duration_days: 3, is_active: true, created_at: new Date().toISOString() },
      { id: "prog-16", name: "Welding Inspector", code: "WI", category: "Welding & NDT", duration_days: 5, is_active: true, created_at: new Date().toISOString() },
      { id: "prog-17", name: "Ship Welding Inspector", code: "SWI", category: "Welding & NDT", duration_days: 5, is_active: true, created_at: new Date().toISOString() },
      { id: "prog-18", name: "Welder Certification", code: "WC", category: "Welding & NDT", duration_days: 3, is_active: true, created_at: new Date().toISOString() },
      { id: "prog-19", name: "Maritime Labour Convention", code: "MLC", category: "Statutory & Compliance", duration_days: 2, is_active: true, created_at: new Date().toISOString() },
      { id: "prog-20", name: "Ballast Water Management", code: "BWM", category: "Statutory & Compliance", duration_days: 2, is_active: true, created_at: new Date().toISOString() },
      { id: "prog-21", name: "Ship-Design Engineering Review Workshop", code: "SDER", category: "Ship Design & Engineering", duration_days: 3, is_active: true, created_at: new Date().toISOString() }
    ];

    const currentProgRaw = localStorage.getItem('bki_programs');
    let currentProgs: TrainingProgram[] = [];
    try {
      currentProgs = currentProgRaw ? JSON.parse(currentProgRaw) : [];
    } catch {
      currentProgs = [];
    }

    if (!currentProgRaw || currentProgs.length < 15) {
      localStorage.setItem('bki_programs', JSON.stringify(mockPrograms));
    }

    if (!localStorage.getItem('bki_leads')) {
      const todayStr = new Date().toISOString().split('T')[0];
      const overdueDate = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString().split('T')[0];
      const tomorrowDate = new Date(Date.now() + 1 * 24 * 3600 * 1000).toISOString().split('T')[0];

      const mockLeads: Lead[] = [
        {
          id: "lead-101",
          contact_id: "cnt-1",
          contact_name: "Hendra Wijaya",
          contact_phone: "081234567890",
          contact_email: "hendra.w@pertamina.com",
          company_name: "PT Pertamina International Shipping",
          program_name: "Internal Auditor ISM Code",
          estimated_seats: 5,
          status: "Baru",
          source: "WA Bisnis",
          pic_staff_name: "System Admin",
          next_follow_up_date: todayStr,
          notes: "Menanyakan kuota 5 orang untuk tim inspeksi kapal tanker. Meminta penawaran resmi.",
          created_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString()
        },
        {
          id: "lead-102",
          contact_id: "cnt-2",
          contact_name: "Maya Kartika",
          contact_phone: "081398765432",
          contact_email: "maya.k@pelindo.co.id",
          company_name: "PT Pelabuhan Indonesia (Pelindo)",
          program_name: "CSO ISPS Code",
          estimated_seats: 3,
          status: "Waiting List",
          waiting_reason: "Reschedule",
          source: "WA Pribadi",
          pic_staff_name: "Andi",
          next_follow_up_date: todayStr,
          notes: "Awalnya mendaftar batch Agustus, namun reschedule karena berbenturan dengan agenda audit internal Pelindo. Menunggu batch Oktober.",
          previous_batch_info: "Batch 53 (Agustus 2026)",
          created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString()
        },
        {
          id: "lead-103",
          contact_id: "cnt-3",
          contact_name: "Doni Prasetyo",
          contact_phone: "081122334455",
          contact_email: "doni.p@meratus.com",
          company_name: "PT Meratus Line",
          program_name: "Maritime Cyber Security",
          estimated_seats: 2,
          status: "Link Terkirim",
          source: "Website",
          pic_staff_name: "System Admin",
          next_follow_up_date: overdueDate,
          notes: "Link formulir pendaftaran sudah dikirimkan via WA 2 hari lalu. Belum mengisi data.",
          created_at: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString()
        },
        {
          id: "lead-104",
          contact_id: "cnt-4",
          contact_name: "Citra Dewi",
          contact_phone: "085711223344",
          contact_email: "citra.dewi@gmail.com",
          company_name: "PRIBADI",
          program_name: "Ship Safety Officer",
          batch_id: "t-116",
          batch_code: "Batch 116",
          estimated_seats: 1,
          confirmed_seats: 1,
          status: "Terdaftar",
          source: "Referral",
          pic_staff_name: "Budi",
          next_follow_up_date: tomorrowDate,
          notes: "Sudah melengkapi formulir dan diverifikasi PIC.",
          created_at: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
        },
        {
          id: "lead-105",
          contact_id: "cnt-5",
          contact_name: "Rahmat Hidayat",
          contact_phone: "081299887766",
          contact_email: "rahmat.h@samudera.id",
          company_name: "PT Samudera Indonesia Tbk",
          program_name: "Basic Marine Surveyor",
          estimated_seats: 4,
          status: "Waiting List",
          waiting_reason: "Belum Ada Jadwal",
          source: "WA Bisnis",
          pic_staff_name: "System Admin",
          next_follow_up_date: tomorrowDate,
          notes: "Sangat berminat jika ada jadwal kelas weekend atau offline di Surabaya.",
          created_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString()
        }
      ];
      localStorage.setItem('bki_leads', JSON.stringify(mockLeads));
    }

    if (!localStorage.getItem('bki_lead_activities')) {
      const mockActivities: LeadActivity[] = [
        {
          id: "act-1",
          lead_id: "lead-101",
          action_type: "created",
          note: "Lead baru dibuat dari WA Bisnis dengan estimasi 5 peserta.",
          actor: "System Admin",
          new_status: "Baru",
          created_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString()
        },
        {
          id: "act-2",
          lead_id: "lead-102",
          action_type: "rescheduled",
          note: "Status dialihkan ke Waiting List dengan alasan Reschedule dari Batch 53.",
          actor: "Andi",
          previous_status: "Jadwal Ditawarkan",
          new_status: "Waiting List",
          created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString()
        },
        {
          id: "act-3",
          lead_id: "lead-103",
          action_type: "link_sent",
          note: "Link formulir pendaftaran berhasil dikirim ke nomor 081122334455.",
          actor: "System Admin",
          previous_status: "Baru",
          new_status: "Link Terkirim",
          created_at: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString()
        },
        {
          id: "act-4",
          lead_id: "lead-104",
          action_type: "registered",
          note: "Pendaftaran dikonfirmasi untuk 1 peserta pada Batch 116.",
          actor: "Budi",
          previous_status: "Link Terkirim",
          new_status: "Terdaftar",
          created_at: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
        }
      ];
      localStorage.setItem('bki_lead_activities', JSON.stringify(mockActivities));
    }
  },

  // Fetch all trainings
  async getTrainings(): Promise<Training[]> {
    this.initMock();
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.from('trainings').select('*').order('created_at', { ascending: false });
      throwIfError(error);
      return (data ?? []) as Training[];
    }
    if (typeof window !== 'undefined') {
      return JSON.parse(localStorage.getItem('bki_trainings') || '[]');
    }
    return [];
  },

  // Insert a training batch
  // service_type / learning_method are optional on insert (the batch form does not set them)
  async insertTraining(
    batch: Omit<Training, 'id' | 'service_type' | 'learning_method'> & Partial<Pick<Training, 'service_type' | 'learning_method'>>
  ): Promise<Training> {
    this.initMock();
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.from('trainings').insert([batch]).select();
      throwIfError(error);
      if (data && data.length > 0) {
        notifyDbUpdate();
        return data[0] as Training;
      }
      throw new Error('Batch training tidak tersimpan');
    }
    const newId = "t-" + Date.now();
    const record: Training = {
      id: newId,
      created_at: new Date().toISOString(),
      service_type: '',
      learning_method: '',
      ...batch
    };
    if (typeof window !== 'undefined') {
      const list = JSON.parse(localStorage.getItem('bki_trainings') || '[]');
      list.unshift(record);
      localStorage.setItem('bki_trainings', JSON.stringify(list));
      notifyDbUpdate();
    }
    return record;
  },

  // Delete a training batch
  async deleteTraining(trainingId: string): Promise<{ success: boolean }> {
    this.initMock();
    const supabase = getSupabaseClient();
    if (supabase) {
      // certificates (and their history) go with the batch via ON DELETE CASCADE, in one atomic statement
      const { data, error } = await supabase.from('trainings').delete().eq('id', trainingId).select('id');
      throwIfError(error);
      assertDeleted(data, 'Batch tidak dihapus: tidak ditemukan, atau Anda tidak punya izin menghapusnya.');
      notifyDbUpdate();
      return { success: true };
    }
    if (typeof window !== 'undefined') {
      const trainings = JSON.parse(localStorage.getItem('bki_trainings') || '[]');
      const filteredTrainings = trainings.filter((t: Training) => t.id !== trainingId);
      localStorage.setItem('bki_trainings', JSON.stringify(filteredTrainings));

      const certs = JSON.parse(localStorage.getItem('bki_certificates') || '[]');
      const filteredCerts = certs.filter((c: Certificate) => c.training_id !== trainingId);
      localStorage.setItem('bki_certificates', JSON.stringify(filteredCerts));
      notifyDbUpdate();
    }
    return { success: true };
  },

  // Delete a single certificate (audit history rows are kept)
  async deleteCertificate(certId: string): Promise<{ success: boolean }> {
    this.initMock();
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.from('certificates').delete().eq('id', certId).select('id');
      throwIfError(error);
      assertDeleted(data, 'Sertifikat tidak dihapus: tidak ditemukan, atau Anda tidak punya izin menghapusnya.');
      notifyDbUpdate();
      return { success: true };
    }
    if (typeof window !== 'undefined') {
      const certs = JSON.parse(localStorage.getItem('bki_certificates') || '[]');
      localStorage.setItem('bki_certificates', JSON.stringify(certs.filter((c: Certificate) => c.id !== certId)));
      notifyDbUpdate();
    }
    return { success: true };
  },

  // Remove a participant from one batch: deletes their certificates for that
  // training only. The participant's global record is kept.
  async removeParticipantFromTraining(participantId: string, trainingId: string): Promise<{ success: boolean }> {
    this.initMock();
    const supabase = getSupabaseClient();
    if (supabase) {
      const matching = await supabase.from('certificates').select('id').eq('participant_id', participantId).eq('training_id', trainingId);
      throwIfError(matching.error);
      const { data, error } = await supabase
        .from('certificates')
        .delete()
        .eq('participant_id', participantId)
        .eq('training_id', trainingId)
        .select('id');
      throwIfError(error);
      notifyDbUpdate();
      if ((data?.length ?? 0) < (matching.data?.length ?? 0)) {
        throw new Error('Hanya sebagian sertifikat peserta yang terhapus: sisanya bukan milik Anda.');
      }
      return { success: true };
    }
    if (typeof window !== 'undefined') {
      const certs = JSON.parse(localStorage.getItem('bki_certificates') || '[]');
      localStorage.setItem(
        'bki_certificates',
        JSON.stringify(certs.filter((c: Certificate) => !(c.participant_id === participantId && c.training_id === trainingId)))
      );
      notifyDbUpdate();
    }
    return { success: true };
  },

  // Update training details
  async updateTraining(trainingId: string, updates: Partial<Training>): Promise<Training | null> {
    this.initMock();
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.from('trainings').update(updates).eq('id', trainingId).select();
      if (error) throw error;
      if (data && data.length > 0) {
        notifyDbUpdate();
        return data[0] as Training;
      }
    }
    if (typeof window !== 'undefined') {
      const list = JSON.parse(localStorage.getItem('bki_trainings') || '[]');
      const item = list.find((t: Training) => t.id === trainingId);
      if (item) {
        Object.assign(item, updates);
        localStorage.setItem('bki_trainings', JSON.stringify(list));
        notifyDbUpdate();
        return item;
      }
    }
    return null;
  },

  // Fetch all participants
  async getParticipants(): Promise<Participant[]> {
    this.initMock();
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.from('participants').select('*');
      throwIfError(error);
      return (data ?? []) as Participant[];
    }
    if (typeof window !== 'undefined') {
      return JSON.parse(localStorage.getItem('bki_participants') || '[]');
    }
    return [];
  },

  // Insert/upsert participant
  async upsertParticipant(participant: Omit<Participant, 'id'> & { id?: string }): Promise<Participant> {
    this.initMock();
    const supabase = getSupabaseClient();
    if (supabase) {
      // Filter out fields that do not exist in the Supabase schema to prevent PGRST204 errors
      const dbPayload: Record<string, unknown> = {
        name: participant.name,
        company: participant.company,
        registration_number: participant.registration_number,
      };
      if (participant.email) {
        dbPayload.email = participant.email;
      }
      if (participant.id) {
        dbPayload.id = participant.id;
      }

      const { data, error } = await supabase.from('participants').upsert([dbPayload], { onConflict: 'name,company' }).select();
      throwIfError(error);
      if (data && data.length > 0) {
        notifyDbUpdate();
        return data[0] as Participant;
      }
      throw new Error('Peserta tidak tersimpan');
    }
    if (typeof window !== 'undefined') {
      const list = JSON.parse(localStorage.getItem('bki_participants') || '[]');
      const existing = list.find((p: Participant) => p.name === participant.name && p.company === participant.company);
      if (existing) {
        return existing;
      }
      const newId = "p-" + Date.now() + Math.random().toString(36).substr(2, 4);
      const record: Participant = { id: newId, ...participant } as Participant;
      list.push(record);
      localStorage.setItem('bki_participants', JSON.stringify(list));
      notifyDbUpdate();
      return record;
    }
    return { id: 'mock', name: participant.name, company: participant.company, registration_number: participant.registration_number };
  },

  // Fetch all certificates
  async getCertificates(): Promise<Certificate[]> {
    this.initMock();
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.from('certificates').select('*, trainings(*), participants(*)');
      throwIfError(error);
      return (data ?? []) as Certificate[];
    }
    
    if (typeof window !== 'undefined') {
      const certs = JSON.parse(localStorage.getItem('bki_certificates') || '[]');
      const trains = JSON.parse(localStorage.getItem('bki_trainings') || '[]');
      const parts = JSON.parse(localStorage.getItem('bki_participants') || '[]');

      return certs.map((c: Certificate) => ({
        ...c,
        trainings: trains.find((t: Training) => t.id === c.training_id),
        participants: parts.find((p: Participant) => p.id === c.participant_id)
      }));
    }
    return [];
  },

  // Insert certificate
  async insertCertificate(cert: Omit<Certificate, 'id' | 'sla_age_days'> & { sla_age_days?: number }): Promise<Certificate> {
    this.initMock();
    const certWithSla = { sla_age_days: 0, ...cert };
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.from('certificates').insert([certWithSla]).select();
      throwIfError(error);
      if (data && data.length > 0) {
        notifyDbUpdate();
        return data[0] as Certificate;
      }
      throw new Error('Sertifikat tidak tersimpan');
    }
    const newId = "c-" + Date.now() + Math.random().toString(36).substr(2, 4);
    const record: Certificate = { 
      id: newId, 
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...certWithSla 
    } as Certificate;
    if (typeof window !== 'undefined') {
      const list = JSON.parse(localStorage.getItem('bki_certificates') || '[]');
      list.push(record);
      localStorage.setItem('bki_certificates', JSON.stringify(list));
      notifyDbUpdate();
    }
    return record;
  },

  // Get certificate by ID (with tracking data)
  async getCertificateById(certId: string): Promise<Certificate | null> {
    this.initMock();
    const supabase = getSupabaseClient();
    if (supabase) {
      if (!isValidUUID(certId)) return null;
      const { data, error } = await supabase.from('certificates').select('*, participants(name)').eq('id', certId).maybeSingle();
      throwIfError(error);
      return (data as Certificate | null) ?? null;
    }
    if (typeof window !== 'undefined') {
      const list = JSON.parse(localStorage.getItem('bki_certificates') || '[]');
      const cert = list.find((c: Certificate) => c.id === certId);
      if (cert) {
        const parts = JSON.parse(localStorage.getItem('bki_participants') || '[]');
        const p = parts.find((part: Participant) => part.id === cert.participant_id);
        cert.participants = p || { name: 'Unknown', id: '', company: '', registration_number: '' };
        return cert;
      }
    }
    return null;
  },

  // Update certificate status
  async updateCertificateStatus(certId: string, status: string): Promise<void> {
    this.initMock();
    let profileName = 'Admin';
    if (typeof window !== 'undefined') {
      profileName = localStorage.getItem('profileName') || 'Admin';
    }

    const supabase = getSupabaseClient();
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
      if (user && user.user_metadata && user.user_metadata.full_name) {
        profileName = user.user_metadata.full_name;
      }
    }

    // 1. Fetch current status of the certificate for auditing
    let previousStatus = 'Pending';
    if (supabase) {
      const { data } = await supabase.from('certificates').select('status').eq('id', certId).single();
      if (data) previousStatus = data.status;
    } else if (typeof window !== 'undefined') {
      const list = JSON.parse(localStorage.getItem('bki_certificates') || '[]');
      const item = list.find((c: Certificate) => c.id === certId);
      if (item) previousStatus = item.status;
    }

    const updates: Partial<Certificate> = { 
      status,
      updated_at: new Date().toISOString(),
      updated_by: profileName
    };

    if (status === 'Pending' || status === 'Processing') {
      updates.printed_at = undefined;
      updates.printed_by = undefined;
      updates.sent_at = undefined;
      updates.sent_by = undefined;
    } else if (status === 'Printing') {
      updates.printed_at = new Date().toISOString();
      updates.printed_by = profileName;
      updates.sent_at = undefined;
      updates.sent_by = undefined;
    } else if (status === 'Completed') {
      updates.printed_at = new Date().toISOString();
      updates.printed_by = profileName;
      updates.sent_at = new Date().toISOString();
      updates.sent_by = profileName;
    }

    if (supabase) {
      const { error: updateError } = await supabase.from('certificates').update(updates).eq('id', certId);
      if (updateError) {
        console.error('Failed to update certificate status in Supabase:', updateError);
      }
      
      const { error: historyError } = await supabase.from('certificate_history').insert([{
        certificate_id: certId,
        previous_status: previousStatus,
        new_status: status,
        changed_by: profileName,
        note: `Status shifted from ${previousStatus} to ${status}`
      }]);
      if (historyError) {
        console.warn('Failed to insert Supabase audit log. Fallback to localStorage will be used. Error:', historyError.message);
      } else {
        notifyDbUpdate();
      }
    }
    
    if (typeof window !== 'undefined') {
      // Always write the transition history to local storage as local audit fallback
      const historyList = JSON.parse(localStorage.getItem('bki_certificate_history') || '[]');
      const newHistoryRecord: CertificateHistory = {
        id: "h-" + Date.now() + Math.random().toString(36).substr(2, 4),
        certificate_id: certId,
        previous_status: previousStatus,
        new_status: status,
        changed_by: profileName,
        note: `Status shifted from ${previousStatus} to ${status}`,
        created_at: new Date().toISOString()
      };
      historyList.push(newHistoryRecord);
      localStorage.setItem('bki_certificate_history', JSON.stringify(historyList));

      // Also update local certificates array if it exists locally
      const list = JSON.parse(localStorage.getItem('bki_certificates') || '[]');
      const item = list.find((c: Certificate) => c.id === certId);
      if (item) {
        item.status = status;
        item.updated_at = updates.updated_at;
        item.updated_by = updates.updated_by;
        
        item.printed_at = updates.printed_at;
        item.printed_by = updates.printed_by;
        item.sent_at = updates.sent_at;
        item.sent_by = updates.sent_by;
        
        localStorage.setItem('bki_certificates', JSON.stringify(list));
      }
      notifyDbUpdate();
    }
  },

  // Fetch certificate history logs for a specific training program
  async getCertificateHistoryForTraining(trainingId: string): Promise<CertificateHistory[]> {
    this.initMock();
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase
        .from('certificate_history')
        .select('*, certificates!inner(training_id)')
        .eq('certificates.training_id', trainingId)
        .order('created_at', { ascending: false });
      throwIfError(error);
      return (data ?? []) as unknown as CertificateHistory[];
    }

    if (typeof window !== 'undefined') {
      const history = JSON.parse(localStorage.getItem('bki_certificate_history') || '[]');
      const certs = JSON.parse(localStorage.getItem('bki_certificates') || '[]');
      const trainingCerts = certs.filter((c: Certificate) => c.training_id === trainingId);
      const trainingCertIds = trainingCerts.map((c: Certificate) => c.id);

      return history.filter((h: CertificateHistory) => trainingCertIds.includes(h.certificate_id));
    }
    return [];
  },

  // Fetch all certificate history logs globally
  async getCertificateHistory(): Promise<CertificateHistory[]> {
    this.initMock();
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase
        .from('certificate_history')
        .select('*')
        .order('created_at', { ascending: false });
      throwIfError(error);
      return (data ?? []) as CertificateHistory[];
    }
    if (typeof window !== 'undefined') {
      return JSON.parse(localStorage.getItem('bki_certificate_history') || '[]');
    }
    return [];
  },


  // Update password
  async updateUserPassword(newPassword: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      notifyDbUpdate();
    }
  },

  // Verify the current password by re-authenticating (no-op without Supabase)
  async verifyUserPassword(email: string, password: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) return true;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return !error;
  },

  // Sign out every other device/browser, keeping this session
  async signOutOtherSessions(): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { error } = await supabase.auth.signOut({ scope: 'others' });
    if (error) throw error;
  },

  // Email a password reset link
  async sendPasswordReset(email: string, redirectTo?: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Reset password membutuhkan koneksi Supabase.');
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  },

  // Update profile
  async updateUserProfile(fullName: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName }
      });
      if (error) throw error;
      notifyDbUpdate();
    }
  },

  // --- CRM & LEADS METHODS ---

  // Fetch all companies
  async getCompanies(): Promise<Company[]> {
    this.initMock();
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.from('companies').select('*').order('name');
      throwIfError(error);
      return (data ?? []) as Company[];
    }
    if (typeof window !== 'undefined') {
      return JSON.parse(localStorage.getItem('bki_companies') || '[]');
    }
    return [];
  },

  // Upsert company
  async upsertCompany(company: Omit<Company, 'id'> & { id?: string }): Promise<Company> {
    this.initMock();
    const supabase = getSupabaseClient();
    if (supabase) {
      const payload: Record<string, unknown> = { ...company };
      if (payload.id && !isValidUUID(payload.id)) delete payload.id;
      const { data, error } = await supabase.from('companies').upsert([payload], { onConflict: 'name' }).select();
      throwIfError(error);
      if (data && data.length > 0) {
        notifyDbUpdate();
        return data[0] as Company;
      }
      throw new Error('Perusahaan tidak tersimpan');
    }
    const newId = company.id || "comp-" + Date.now();
    const record: Company = { id: newId, created_at: new Date().toISOString(), ...company };
    if (typeof window !== 'undefined') {
      const list: Company[] = JSON.parse(localStorage.getItem('bki_companies') || '[]');
      const idx = list.findIndex(c => c.name.toLowerCase() === company.name.toLowerCase() || (company.id && c.id === company.id));
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...record };
      } else {
        list.push(record);
      }
      localStorage.setItem('bki_companies', JSON.stringify(list));
      notifyDbUpdate();
    }
    return record;
  },

  // Fetch all contacts
  async getContacts(): Promise<Contact[]> {
    this.initMock();
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.from('contacts').select('*').order('name');
      throwIfError(error);
      return (data ?? []) as Contact[];
    }
    if (typeof window !== 'undefined') {
      return JSON.parse(localStorage.getItem('bki_contacts') || '[]');
    }
    return [];
  },

  // Upsert contact
  async upsertContact(contact: Omit<Contact, 'id'> & { id?: string }): Promise<Contact> {
    this.initMock();
    const supabase = getSupabaseClient();
    if (supabase) {
      const payload: Record<string, unknown> = { ...contact };
      if (payload.id && !isValidUUID(payload.id)) delete payload.id;
      if (payload.company_id && !isValidUUID(payload.company_id)) delete payload.company_id;
      const { data, error } = await supabase.from('contacts').upsert([payload]).select();
      throwIfError(error);
      if (data && data.length > 0) {
        notifyDbUpdate();
        return data[0] as Contact;
      }
      throw new Error('Kontak tidak tersimpan');
    }
    const newId = contact.id || "cnt-" + Date.now();
    const record: Contact = { id: newId, created_at: new Date().toISOString(), ...contact };
    if (typeof window !== 'undefined') {
      const list: Contact[] = JSON.parse(localStorage.getItem('bki_contacts') || '[]');
      const idx = list.findIndex(c => (c.phone && c.phone === contact.phone) || (contact.id && c.id === contact.id));
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...record };
      } else {
        list.push(record);
      }
      localStorage.setItem('bki_contacts', JSON.stringify(list));
      notifyDbUpdate();
    }
    return record;
  },

  // Fetch all training programs
  async getTrainingPrograms(): Promise<TrainingProgram[]> {
    this.initMock();
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.from('training_programs').select('*').order('name');
      throwIfError(error);
      return (data ?? []) as TrainingProgram[];
    }
    if (typeof window !== 'undefined') {
      return JSON.parse(localStorage.getItem('bki_programs') || '[]');
    }
    return [];
  },

  // Upsert training program
  async upsertTrainingProgram(prog: Omit<TrainingProgram, 'id'> & { id?: string }): Promise<TrainingProgram> {
    this.initMock();
    const supabase = getSupabaseClient();
    if (supabase) {
      const payload: Record<string, unknown> = { ...prog };
      if (payload.id && !isValidUUID(payload.id)) delete payload.id;
      const { data, error } = await supabase.from('training_programs').upsert([payload], { onConflict: 'code' }).select();
      throwIfError(error);
      if (data && data.length > 0) {
        notifyDbUpdate();
        return data[0] as TrainingProgram;
      }
      throw new Error('Program training tidak tersimpan');
    }
    const newId = prog.id || "prog-" + Date.now();
    const record: TrainingProgram = { id: newId, created_at: new Date().toISOString(), ...prog };
    if (typeof window !== 'undefined') {
      const list: TrainingProgram[] = JSON.parse(localStorage.getItem('bki_programs') || '[]');
      const idx = list.findIndex(p => p.name.toLowerCase() === prog.name.toLowerCase() || (prog.id && p.id === prog.id));
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...record };
      } else {
        list.push(record);
      }
      localStorage.setItem('bki_programs', JSON.stringify(list));
      notifyDbUpdate();
    }
    return record;
  },

  // Fetch all leads
  async getLeads(): Promise<Lead[]> {
    this.initMock();
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
      throwIfError(error);
      return (data ?? []) as Lead[];
    }
    if (typeof window !== 'undefined') {
      return JSON.parse(localStorage.getItem('bki_leads') || '[]');
    }
    return [];
  },

  // Find-or-create the company and contact behind a lead and return their ids.
  // Supabase only (the localStorage demo path keeps its own upsert). Companies
  // match by name ignoring case; contacts by normalized phone number. Existing
  // rows are only filled in where empty, never overwritten.
  async resolveDirectoryLinks(input: {
    contact_name: string;
    contact_phone: string;
    contact_email?: string;
    company_name?: string;
  }): Promise<{ company_id?: string; contact_id?: string }> {
    const supabase = getSupabaseClient();
    if (!supabase) return {};
    const result: { company_id?: string; contact_id?: string } = {};
    clearReadCache(); // writes companies/contacts directly

    // Company
    if (!isPersonalCompany(input.company_name)) {
      const name = cleanName(input.company_name!);
      const escaped = name.replace(/[\\%_]/g, m => '\\' + m);
      const found = await supabase.from('companies').select('id').ilike('name', escaped).limit(1);
      if (found.error) throw new Error(found.error.message);
      if (found.data && found.data.length > 0) {
        result.company_id = found.data[0].id;
      } else {
        const created = await supabase.from('companies').insert([{ name }]).select('id');
        if (created.error) {
          // Lost a race with another insert of the same name: read it back
          const again = await supabase.from('companies').select('id').ilike('name', escaped).limit(1);
          if (again.error || !again.data?.length) throw new Error(created.error.message);
          result.company_id = again.data[0].id;
        } else {
          result.company_id = created.data[0].id;
        }
      }
    }

    // Contact
    const phone = normalizePhone(input.contact_phone);
    if (phone) {
      const all = await supabase.from('contacts').select('*');
      if (all.error) throw new Error(all.error.message);
      const existing = (all.data as Contact[] | null)?.find(c => normalizePhone(c.phone) === phone);
      if (existing) {
        result.contact_id = existing.id;
        const fill: Partial<Contact> = {};
        if (!existing.email && input.contact_email) fill.email = input.contact_email;
        if (!existing.company_id && result.company_id) {
          fill.company_id = result.company_id;
          fill.company_name = cleanName(input.company_name!);
        }
        if (Object.keys(fill).length > 0) {
          await supabase.from('contacts').update(fill).eq('id', existing.id);
        }
      } else {
        const created = await supabase.from('contacts').insert([{
          name: cleanName(input.contact_name),
          phone: input.contact_phone.trim(),
          email: input.contact_email || null,
          company_id: result.company_id ?? null,
          company_name: input.company_name ? cleanName(input.company_name) : null,
        }]).select('id');
        if (created.error) throw new Error(created.error.message);
        result.contact_id = created.data[0].id;
      }
    }
    return result;
  },

  // One-off backfill: link existing leads that have no contact/company yet and
  // fill the directories from them. Safe to run repeatedly.
  async syncLeadsToDirectory(): Promise<{ leadsLinked: number; newCompanies: number; newContacts: number; failed: number }> {
    const supabase = getSupabaseClient();
    if (!supabase) return { leadsLinked: 0, newCompanies: 0, newContacts: 0, failed: 0 };

    const [leads, companiesBefore, contactsBefore] = await Promise.all([
      this.getLeads(), this.getCompanies(), this.getContacts(),
    ]);
    const todo = leads.filter(l => isValidUUID(l.id) && (!l.contact_id || (!l.company_id && !isPersonalCompany(l.company_name))));

    let leadsLinked = 0;
    let failed = 0;
    // Oldest first so the earliest lead of a contact defines the contact name
    for (const lead of [...todo].reverse()) {
      try {
        const links = await this.resolveDirectoryLinks(lead);
        const patch: { contact_id?: string; company_id?: string } = {};
        if (!lead.contact_id && links.contact_id) patch.contact_id = links.contact_id;
        if (!lead.company_id && links.company_id) patch.company_id = links.company_id;
        if (Object.keys(patch).length > 0) {
          const { error } = await supabase.from('leads').update(patch).eq('id', lead.id);
          if (error) throw new Error(error.message);
          leadsLinked++;
        }
      } catch (e) {
        console.error('Directory sync failed for lead', lead.id, e);
        failed++;
      }
    }

    const [companiesAfter, contactsAfter] = await Promise.all([this.getCompanies(), this.getContacts()]);
    notifyDbUpdate();
    return {
      leadsLinked,
      newCompanies: Math.max(0, companiesAfter.length - companiesBefore.length),
      newContacts: Math.max(0, contactsAfter.length - contactsBefore.length),
      failed,
    };
  },

  // Header bell: the newest `limit` items of each notification source, fetched
  // with narrow queries (no full-table loads). limit=1 is enough to know whether
  // anything is newer than the last-read timestamp.
  async getNotificationSources(slaThreshold: number, limit: number): Promise<NotificationSources> {
    this.initMock();
    const supabase = getSupabaseClient();
    if (supabase) {
      type Embedded = { participants?: { name: string } | null; trainings?: { program_name: string } | null };
      const [overdueRes, historyRes, trainingRes] = await Promise.all([
        supabase
          .from('certificates')
          .select('id, sla_age_days, updated_at, created_at, participants(name), trainings(program_name)')
          .neq('status', 'Completed')
          .gt('sla_age_days', slaThreshold)
          .order('updated_at', { ascending: false })
          .limit(limit),
        supabase
          .from('certificate_history')
          .select('id, new_status, changed_by, created_at, certificates(participants(name), trainings(program_name))')
          .order('created_at', { ascending: false })
          .limit(limit),
        supabase
          .from('trainings')
          .select('id, program_name, batch_code, start_date, created_at')
          .order('created_at', { ascending: false })
          .limit(limit),
      ]);
      throwIfError(overdueRes.error);
      throwIfError(historyRes.error);
      throwIfError(trainingRes.error);

      const one = <T,>(v: T | T[] | null | undefined): T | undefined => (Array.isArray(v) ? v[0] : v ?? undefined);
      return {
        overdue: (overdueRes.data ?? []).map(r => {
          const row = r as unknown as Embedded & { id: string; sla_age_days: number; updated_at?: string; created_at?: string };
          return {
            id: row.id,
            participant_name: one(row.participants)?.name ?? 'Unknown',
            program_name: one(row.trainings)?.program_name ?? 'Training',
            sla_age_days: row.sla_age_days,
            time: row.updated_at || row.created_at || new Date(Date.now() - 86400000).toISOString(),
          };
        }),
        history: (historyRes.data ?? []).map(r => {
          const row = r as unknown as { id: string; new_status: string; changed_by: string; created_at: string; certificates?: Embedded | Embedded[] | null };
          const cert = one(row.certificates);
          return {
            id: row.id,
            participant_name: one(cert?.participants)?.name ?? 'Unknown',
            program_name: one(cert?.trainings)?.program_name ?? 'Training',
            new_status: row.new_status,
            changed_by: row.changed_by,
            time: row.created_at,
          };
        }),
        trainings: (trainingRes.data ?? []).map(t => ({
          id: t.id as string,
          program_name: t.program_name as string,
          batch_code: t.batch_code as string,
          time: ((t.created_at as string | null) || (t.start_date as string)),
        })),
      };
    }

    // Demo mode (localStorage): small data, derive from the full local lists
    const [trainings, certificates, histories] = await Promise.all([
      this.getTrainings(), this.getCertificates(), this.getCertificateHistory(),
    ]);
    const byTimeDesc = <T extends { time: string }>(a: T, b: T) => Date.parse(b.time) - Date.parse(a.time);
    return {
      overdue: certificates
        .filter(c => c.status !== 'Completed' && c.sla_age_days > slaThreshold)
        .map(c => ({
          id: c.id,
          participant_name: c.participants?.name ?? 'Unknown',
          program_name: c.trainings?.program_name ?? 'Training',
          sla_age_days: c.sla_age_days,
          time: c.updated_at || c.created_at || new Date(Date.now() - 86400000).toISOString(),
        }))
        .sort(byTimeDesc).slice(0, limit),
      history: histories
        .map(h => {
          const cert = certificates.find(c => c.id === h.certificate_id);
          return {
            id: h.id,
            participant_name: cert?.participants?.name ?? 'Unknown',
            program_name: cert?.trainings?.program_name ?? 'Training',
            new_status: h.new_status,
            changed_by: h.changed_by,
            time: h.created_at,
          };
        })
        .sort(byTimeDesc).slice(0, limit),
      trainings: trainings
        .map(t => ({ id: t.id, program_name: t.program_name, batch_code: t.batch_code, time: t.created_at || t.start_date }))
        .sort(byTimeDesc).slice(0, limit),
    };
  },

  // Get lead by ID
  async getLeadById(leadId: string): Promise<Lead | null> {
    this.initMock();
    const supabase = getSupabaseClient();
    if (supabase) {
      if (!isValidUUID(leadId)) return null;
      const { data, error } = await supabase.from('leads').select('*').eq('id', leadId).maybeSingle();
      throwIfError(error);
      return (data as Lead | null) ?? null;
    }
    if (typeof window !== 'undefined') {
      const list: Lead[] = JSON.parse(localStorage.getItem('bki_leads') || '[]');
      return list.find(l => l.id === leadId) || null;
    }
    return null;
  },

  // Insert a new lead
  async insertLead(leadData: Omit<Lead, 'id' | 'created_at' | 'updated_at'>): Promise<Lead> {
    this.initMock();
    const newId = "lead-" + Date.now() + Math.random().toString(36).substr(2, 4);
    const now = new Date().toISOString();
    const record: Lead = {
      id: newId,
      created_at: now,
      updated_at: now,
      ...leadData
    };

    const supabase = getSupabaseClient();
    if (supabase) {
      const payload: Record<string, unknown> = { ...leadData };
      if (!isValidUUID(payload.contact_id)) delete payload.contact_id;
      if (!isValidUUID(payload.company_id)) delete payload.company_id;
      if (!isValidUUID(payload.program_id)) delete payload.program_id;
      if (!isValidUUID(payload.batch_id)) delete payload.batch_id;

      // Keep the company/contact directories in sync. A failure here must not
      // block saving the lead: the "Sinkronkan" backfill can link it later.
      try {
        const links = await this.resolveDirectoryLinks(leadData);
        if (links.company_id && !payload.company_id) payload.company_id = links.company_id;
        if (links.contact_id && !payload.contact_id) payload.contact_id = links.contact_id;
      } catch (e) {
        console.error('Could not sync company/contact directory:', e);
      }

      const { data, error } = await supabase.from('leads').insert([payload]).select();
      // A configured database that rejects the insert must surface the error;
      // silently saving to localStorage would lose the lead.
      throwIfError(error);
      if (data && data.length > 0) {
        // The lead is saved; a failed audit-log row must not report the whole save as failed
        try {
          await this.insertLeadActivity({
            lead_id: data[0].id,
            action_type: 'created',
            note: `Lead baru dibuat untuk program "${leadData.program_name}" (${leadData.estimated_seats} peserta).`,
            actor: leadData.pic_staff_name || 'System',
            new_status: leadData.status
          });
        } catch (e) {
          console.error('Lead saved but its activity log failed:', e);
        }
        notifyDbUpdate();
        return data[0] as Lead;
      }
      throw new Error('Lead tidak tersimpan');
    }

    if (typeof window !== 'undefined') {
      const list: Lead[] = JSON.parse(localStorage.getItem('bki_leads') || '[]');
      list.unshift(record);
      localStorage.setItem('bki_leads', JSON.stringify(list));

      // Also upsert company & contact automatically for master directory
      if (leadData.company_name && leadData.company_name !== 'PRIBADI') {
        await this.upsertCompany({ name: leadData.company_name });
      }
      if (leadData.contact_name && leadData.contact_phone) {
        await this.upsertContact({
          name: leadData.contact_name,
          phone: leadData.contact_phone,
          email: leadData.contact_email,
          company_name: leadData.company_name
        });
      }

      // Log activity
      await this.insertLeadActivity({
        lead_id: newId,
        action_type: 'created',
        note: `Lead baru dibuat untuk program "${leadData.program_name}" (${leadData.estimated_seats} peserta).`,
        actor: leadData.pic_staff_name || 'System',
        new_status: leadData.status
      });

      notifyDbUpdate();
    }
    return record;
  },

  // Update lead
  async updateLead(leadId: string, updates: Partial<Lead>): Promise<Lead | null> {
    this.initMock();
    const now = new Date().toISOString();
    const payload: Record<string, unknown> = { ...updates, updated_at: now };

    const supabase = getSupabaseClient();
    if (supabase && isValidUUID(leadId)) {
      if (payload.contact_id !== undefined && !isValidUUID(payload.contact_id)) delete payload.contact_id;
      if (payload.company_id !== undefined && !isValidUUID(payload.company_id)) delete payload.company_id;
      if (payload.program_id !== undefined && !isValidUUID(payload.program_id)) delete payload.program_id;
      if (payload.batch_id !== undefined && !isValidUUID(payload.batch_id)) delete payload.batch_id;

      const { data, error } = await supabase.from('leads').update(payload).eq('id', leadId).select();
      throwIfError(error);
      if (data && data.length > 0) {
        notifyDbUpdate();
        return data[0] as Lead;
      }
      return null; // no such row in the database
    }

    if (typeof window !== 'undefined') {
      const list: Lead[] = JSON.parse(localStorage.getItem('bki_leads') || '[]');
      const idx = list.findIndex(l => l.id === leadId);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...payload };
        localStorage.setItem('bki_leads', JSON.stringify(list));
        notifyDbUpdate();
        return list[idx];
      }
    }
    return null;
  },

  // Update lead status with automatic activity audit logging
  async updateLeadStatus(
    leadId: string,
    newStatus: LeadStatus,
    options?: LeadStatusOptions
  ): Promise<Lead | null> {
    this.initMock();
    const current = await this.getLeadById(leadId);
    if (!current) return null;

    let profileName = options?.actor || 'Admin';
    if (!options?.actor && typeof window !== 'undefined') {
      profileName = localStorage.getItem('profileName') || 'System Admin';
    }

    const previousStatus = current.status;
    const updates: Partial<Lead> = {
      status: newStatus,
      updated_at: new Date().toISOString()
    };

    let actionType: LeadActivity['action_type'] = 'status_changed';
    let activityNote = options?.note || `Status berubah dari ${previousStatus} menjadi ${newStatus}`;

    if (newStatus === 'Link Terkirim') {
      actionType = 'link_sent';
      activityNote = options?.note || 'Link formulir pendaftaran telah dikirimkan ke calon peserta/PIC.';
    } else if (newStatus === 'Terdaftar') {
      actionType = 'registered';
      if (options?.batchId) updates.batch_id = options.batchId;
      if (options?.batchCode) updates.batch_code = options.batchCode;
      if (options?.confirmedSeats) updates.confirmed_seats = options.confirmedSeats;
      activityNote = options?.note || `Pendaftaran berhasil dikonfirmasi untuk ${options?.confirmedSeats || current.estimated_seats} peserta (Batch: ${options?.batchCode || current.batch_code || '-'}).`;
    } else if (newStatus === 'Waiting List') {
      if (options?.reason === 'Reschedule') {
        actionType = 'rescheduled';
        updates.waiting_reason = 'Reschedule';
        if (current.batch_code) {
          updates.previous_batch_info = current.batch_code;
        }
        activityNote = options?.note || `Dialihkan ke Waiting List karena Reschedule (sebelumnya: ${current.batch_code || 'Belum ada batch'}).`;
      } else {
        updates.waiting_reason = options?.reason || 'Belum Ada Jadwal';
      }
    } else if (newStatus === 'Batal') {
      actionType = 'cancelled';
      updates.cancel_reason = options?.cancelReason || options?.note || 'Dibatalkan oleh PIC / Calon Peserta';
      activityNote = `Peluang dibatalkan. Alasan: ${updates.cancel_reason}`;
    }

    if (options?.nextFollowUp) {
      updates.next_follow_up_date = options.nextFollowUp;
    }

    const updatedLead = await this.updateLead(leadId, updates);

    // Record activity log
    await this.insertLeadActivity({
      lead_id: leadId,
      action_type: actionType,
      note: activityNote,
      actor: profileName,
      previous_status: previousStatus,
      new_status: newStatus
    });

    return updatedLead;
  },

  // Change the status of several leads at once. Runs sequentially (each lead
  // keeps its own activity log row) and fires ONE refresh event at the end
  // instead of one per lead. A failing lead never aborts the rest.
  async bulkUpdateLeadStatus(
    leadIds: string[],
    newStatus: LeadStatus,
    options?: LeadStatusOptions,
    perLead?: (leadId: string) => LeadStatusOptions
  ): Promise<{ succeeded: string[]; failed: { id: string; message: string }[] }> {
    const succeeded: string[] = [];
    const failed: { id: string; message: string }[] = [];
    dbNotifyPaused = true;
    try {
      for (const id of leadIds) {
        try {
          const result = await DB.updateLeadStatus(id, newStatus, { ...options, ...perLead?.(id) });
          if (result) succeeded.push(id);
          else failed.push({ id, message: 'Lead tidak ditemukan' });
        } catch (e) {
          failed.push({ id, message: getErrorMessage(e, 'Gagal memperbarui') });
        }
      }
    } finally {
      dbNotifyPaused = false;
      notifyDbUpdate();
    }
    return { succeeded, failed };
  },

  // Delete lead
  async deleteLead(leadId: string): Promise<{ success: boolean }> {
    this.initMock();
    const supabase = getSupabaseClient();
    if (supabase) {
      // lead_activities go with the lead via ON DELETE CASCADE, in one atomic statement
      const { data, error } = await supabase.from('leads').delete().eq('id', leadId).select('id');
      throwIfError(error);
      assertDeleted(data, 'Lead tidak dihapus: tidak ditemukan, atau Anda tidak punya izin menghapusnya.');
      notifyDbUpdate();
      return { success: true };
    }
    if (typeof window !== 'undefined') {
      const leads: Lead[] = JSON.parse(localStorage.getItem('bki_leads') || '[]');
      const filteredLeads = leads.filter(l => l.id !== leadId);
      localStorage.setItem('bki_leads', JSON.stringify(filteredLeads));

      const acts: LeadActivity[] = JSON.parse(localStorage.getItem('bki_lead_activities') || '[]');
      const filteredActs = acts.filter(a => a.lead_id !== leadId);
      localStorage.setItem('bki_lead_activities', JSON.stringify(filteredActs));

      notifyDbUpdate();
    }
    return { success: true };
  },

  // Fetch lead activities
  async getLeadActivities(leadId?: string): Promise<LeadActivity[]> {
    this.initMock();
    const supabase = getSupabaseClient();
    if (supabase) {
      let query = supabase.from('lead_activities').select('*').order('created_at', { ascending: false });
      if (leadId) {
        query = query.eq('lead_id', leadId);
      }
      const { data, error } = await query;
      throwIfError(error);
      return (data ?? []) as LeadActivity[];
    }
    if (typeof window !== 'undefined') {
      const list: LeadActivity[] = JSON.parse(localStorage.getItem('bki_lead_activities') || '[]');
      if (leadId) {
        return list.filter(a => a.lead_id === leadId);
      }
      return list;
    }
    return [];
  },

  // Insert lead activity
  async insertLeadActivity(act: Omit<LeadActivity, 'id' | 'created_at'>): Promise<LeadActivity> {
    this.initMock();
    const newId = "act-" + Date.now() + Math.random().toString(36).substr(2, 4);
    const record: LeadActivity = {
      id: newId,
      created_at: new Date().toISOString(),
      ...act
    };

    const supabase = getSupabaseClient();
    if (supabase && isValidUUID(act.lead_id)) {
      const payload: Record<string, unknown> = { ...act };
      const { data, error } = await supabase.from('lead_activities').insert([payload]).select();
      throwIfError(error);
      if (data && data.length > 0) {
        notifyDbUpdate();
        return data[0] as LeadActivity;
      }
      throw new Error('Aktivitas lead tidak tersimpan');
    }

    if (typeof window !== 'undefined') {
      const list: LeadActivity[] = JSON.parse(localStorage.getItem('bki_lead_activities') || '[]');
      list.unshift(record);
      localStorage.setItem('bki_lead_activities', JSON.stringify(list));
      notifyDbUpdate();
    }
    return record;
  }
};

// Share concurrent/rapid identical reads (see cachedRead). Callers get their own
// array copy so an in-place sort cannot leak into another page's data.
const CACHED_READS = [
  'getTrainings', 'getParticipants', 'getCertificates', 'getCertificateHistory',
  'getCompanies', 'getContacts', 'getTrainingPrograms', 'getLeads', 'getLeadActivities',
  'getNotificationSources',
] as const;
for (const name of CACHED_READS) {
  const original = DB[name] as (...args: unknown[]) => Promise<unknown>;
  (DB as unknown as Record<string, unknown>)[name] = (...args: unknown[]) =>
    cachedRead(name + JSON.stringify(args), () => original.apply(DB, args)).then(r => (Array.isArray(r) ? [...r] : r));
}
