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
  }
};
