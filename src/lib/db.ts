import { createClient } from '@supabase/supabase-js';

// Retrieves the Supabase client dynamically, checking localStorage overrides first, then environment variables.
export const getSupabaseClient = () => {
  let url = '';
  let key = '';

  if (typeof window !== 'undefined') {
    url = localStorage.getItem('supabase_url') || '';
    key = localStorage.getItem('supabase_key') || '';
  }

  if (!url || !key) {
    url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  }

  if (url && key) {
    try {
      return createClient(url, key);
    } catch (e) {
      console.error('Failed to create Supabase client:', e);
      return null;
    }
  }

  return null;
};

export const supabase = getSupabaseClient();

if (typeof window !== 'undefined') {
  console.log('BKI Academy Supabase dynamic client initialized:', !!supabase);
}

// Dispatches a global event on the window to sync database states in real-time
const notifyDbUpdate = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('bki-db-update'));
  }
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
          program_name: "Internal Auditor ISM", 
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
          program_name: "CSO Training", 
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

    if (!localStorage.getItem('bki_programs')) {
      const mockPrograms: TrainingProgram[] = [
        { id: "prog-1", name: "Internal Auditor ISM", code: "ISM-AUD", category: "Statutory & Safety", duration_days: 3, is_active: true, created_at: new Date().toISOString() },
        { id: "prog-2", name: "CSO Training", code: "CSO", category: "Security & ISPS", duration_days: 3, is_active: true, created_at: new Date().toISOString() },
        { id: "prog-3", name: "Maritime Cyber Security", code: "MCS", category: "Cyber & Digital", duration_days: 2, is_active: true, created_at: new Date().toISOString() },
        { id: "prog-4", name: "Ship Safety Officer", code: "SSO", category: "Safety Operations", duration_days: 3, is_active: true, created_at: new Date().toISOString() },
        { id: "prog-5", name: "Basic Marine Surveyor", code: "BMS", category: "Survey & Inspection", duration_days: 5, is_active: true, created_at: new Date().toISOString() }
      ];
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
          program_name: "Internal Auditor ISM",
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
          program_name: "CSO Training",
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
      if (!error && data) return data as Training[];
    }
    if (typeof window !== 'undefined') {
      return JSON.parse(localStorage.getItem('bki_trainings') || '[]');
    }
    return [];
  },

  // Insert a training batch
  async insertTraining(batch: Omit<Training, 'id'>): Promise<Training> {
    this.initMock();
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.from('trainings').insert([batch]).select();
      if (!error && data && data.length > 0) {
        notifyDbUpdate();
        return data[0] as Training;
      }
    }
    const newId = "t-" + Date.now();
    const record: Training = { 
      id: newId, 
      created_at: new Date().toISOString(),
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
      await supabase.from('certificates').delete().eq('training_id', trainingId);
      const { error } = await supabase.from('trainings').delete().eq('id', trainingId);
      if (error) throw error;
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
      if (!error && data) return data as Participant[];
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
      const dbPayload: any = {
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
      if (!error && data && data.length > 0) {
        notifyDbUpdate();
        return data[0] as Participant;
      } else if (error) {
        console.error("Supabase upsertParticipant error:", error);
      }
    }
    if (typeof window !== 'undefined') {
      const list = JSON.parse(localStorage.getItem('bki_participants') || '[]');
      let existing = list.find((p: Participant) => p.name === participant.name && p.company === participant.company);
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
      if (!error && data) return data as Certificate[];
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
      if (!error && data && data.length > 0) {
        notifyDbUpdate();
        return data[0] as Certificate;
      }
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
      const { data, error } = await supabase.from('certificates').select('*, participants(name)').eq('id', certId).single();
      if (!error && data) return data as Certificate;
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
      if (!error && data) return data as unknown as CertificateHistory[];

      // Fallback: If Supabase connection is active but table is missing,
      // return only localStorage logs that match the active Supabase certificate IDs
      if (typeof window !== 'undefined') {
        const { data: certs } = await supabase.from('certificates').select('id').eq('training_id', trainingId);
        if (certs) {
          const certIds = certs.map((c: any) => c.id);
          const history = JSON.parse(localStorage.getItem('bki_certificate_history') || '[]');
          return history.filter((h: CertificateHistory) => certIds.includes(h.certificate_id));
        }
      }
      return [];
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
      if (!error && data) return data as CertificateHistory[];

      // Fallback: If Supabase connection is active but table is missing,
      // return only localStorage logs that match active Supabase certificate IDs
      if (typeof window !== 'undefined') {
        const { data: certs } = await supabase.from('certificates').select('id');
        if (certs) {
          const certIds = certs.map((c: any) => c.id);
          const history = JSON.parse(localStorage.getItem('bki_certificate_history') || '[]');
          return history.filter((h: CertificateHistory) => certIds.includes(h.certificate_id));
        }
      }
      return [];
    }
    if (typeof window !== 'undefined') {
      return JSON.parse(localStorage.getItem('bki_certificate_history') || '[]');
    }
    return [];
  },

  // Register user
  async registerNewUser(email: string, pass: string): Promise<any> {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: pass,
        options: {
          emailRedirectTo: typeof window !== 'undefined' ? window.location.origin + '/' : undefined
        }
      });
      if (error) throw error;
      notifyDbUpdate();
      return data;
    }
    return { user: { email, id: "u-mock-" + Date.now() } };
  },

  // Update password
  async updateUserPassword(newPassword: string): Promise<any> {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      notifyDbUpdate();
      return data;
    }
    return { success: true };
  },

  // Update profile
  async updateUserProfile(fullName: string): Promise<any> {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.auth.updateUser({
        data: { full_name: fullName }
      });
      if (error) throw error;
      notifyDbUpdate();
      return data;
    }
    return { success: true };
  },

  // --- CRM & LEADS METHODS ---

  // Fetch all companies
  async getCompanies(): Promise<Company[]> {
    this.initMock();
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.from('companies').select('*').order('name');
      if (!error && data) return data as Company[];
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
      const { data, error } = await supabase.from('companies').upsert([company]).select();
      if (!error && data && data.length > 0) {
        notifyDbUpdate();
        return data[0] as Company;
      }
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
      if (!error && data) return data as Contact[];
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
      const { data, error } = await supabase.from('contacts').upsert([contact]).select();
      if (!error && data && data.length > 0) {
        notifyDbUpdate();
        return data[0] as Contact;
      }
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
      if (!error && data) return data as TrainingProgram[];
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
      const { data, error } = await supabase.from('training_programs').upsert([prog]).select();
      if (!error && data && data.length > 0) {
        notifyDbUpdate();
        return data[0] as TrainingProgram;
      }
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
      if (!error && data) return data as Lead[];
    }
    if (typeof window !== 'undefined') {
      return JSON.parse(localStorage.getItem('bki_leads') || '[]');
    }
    return [];
  },

  // Get lead by ID
  async getLeadById(leadId: string): Promise<Lead | null> {
    this.initMock();
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.from('leads').select('*').eq('id', leadId).single();
      if (!error && data) return data as Lead;
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
      const { data, error } = await supabase.from('leads').insert([record]).select();
      if (!error && data && data.length > 0) {
        // Log activity
        await this.insertLeadActivity({
          lead_id: data[0].id,
          action_type: 'created',
          note: `Lead baru dibuat untuk program "${leadData.program_name}" (${leadData.estimated_seats} peserta).`,
          actor: leadData.pic_staff_name || 'System',
          new_status: leadData.status
        });
        notifyDbUpdate();
        return data[0] as Lead;
      }
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
    const payload = { ...updates, updated_at: now };

    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.from('leads').update(payload).eq('id', leadId).select();
      if (!error && data && data.length > 0) {
        notifyDbUpdate();
        return data[0] as Lead;
      }
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
    options?: {
      note?: string;
      reason?: WaitingReason;
      cancelReason?: string;
      batchId?: string;
      batchCode?: string;
      confirmedSeats?: number;
      nextFollowUp?: string;
      actor?: string;
    }
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

  // Delete lead
  async deleteLead(leadId: string): Promise<{ success: boolean }> {
    this.initMock();
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.from('lead_activities').delete().eq('lead_id', leadId);
      const { error } = await supabase.from('leads').delete().eq('id', leadId);
      if (!error) {
        notifyDbUpdate();
        return { success: true };
      }
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
      if (!error && data) return data as LeadActivity[];
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
    if (supabase) {
      const { data, error } = await supabase.from('lead_activities').insert([record]).select();
      if (!error && data && data.length > 0) {
        notifyDbUpdate();
        return data[0] as LeadActivity;
      }
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
