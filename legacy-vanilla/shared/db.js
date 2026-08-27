// BKI Academy Database Connector
// Supports Supabase connection if credentials are configured in local config.json or Settings (localStorage).
// Falls back to localStorage relational mock tables if Supabase is offline/not configured.

const DB = {
  supabaseUrl: null,
  supabaseKey: null,
  configLoaded: false,

  // Initialize mock data if not already present
  initMock() {
    if (!localStorage.getItem('bki_trainings')) {
      const mockTrainings = [
        { id: "t-116", program_name: "Internal Auditor ISM", batch_code: "Batch 116", service_type: "PUBLIC TRAINING", learning_method: "OFFLINE", start_date: "2026-08-03", end_date: "2026-08-05", location: "Jakarta Training Center", status: "Completed" },
        { id: "t-53", program_name: "CSO Training", batch_code: "Batch 53", service_type: "PUBLIC TRAINING", learning_method: "OFFLINE", start_date: "2026-08-10", end_date: "2026-08-12", location: "Surabaya Hub", status: "Processing" }
      ];
      localStorage.setItem('bki_trainings', JSON.stringify(mockTrainings));
    }

    if (!localStorage.getItem('bki_participants')) {
      const mockParticipants = [
        { id: "p-001", name: "Ahmad Rizky", company: "Pertamina Shipping", registration_number: "0001" },
        { id: "p-002", name: "Sinta Maharani", company: "Pelindo II", registration_number: "0002" },
        { id: "p-003", name: "Budi Santoso", company: "Bumi Resources", registration_number: "0003" },
        { id: "p-004", name: "Dewi Lestari", company: "Meratus Line", registration_number: "0004" }
      ];
      localStorage.setItem('bki_participants', JSON.stringify(mockParticipants));
    }

    if (!localStorage.getItem('bki_certificates')) {
      const mockCertificates = [
        { id: "c-001", training_id: "t-116", participant_id: "p-001", certificate_type: "Qualification", certificate_number: "BKI-116-001", status: "Printing", evaluation_result: "Lulus", sla_age_days: 5 },
        { id: "c-002", training_id: "t-116", participant_id: "p-002", certificate_type: "Attendance", certificate_number: "BKI-116-002", status: "Completed", evaluation_result: "Lulus", sla_age_days: 0 },
        { id: "c-003", training_id: "t-116", participant_id: "p-003", certificate_type: "Qualification", certificate_number: "BKI-116-003", status: "Pending", evaluation_result: "Lulus", sla_age_days: 2 },
        { id: "c-004", training_id: "t-116", participant_id: "p-004", certificate_type: "Qualification", certificate_number: "BKI-116-004", status: "Completed", evaluation_result: "Lulus", sla_age_days: 0 }
      ];
      localStorage.setItem('bki_certificates', JSON.stringify(mockCertificates));
    }
  },

  async loadConfig() {
    if (this.configLoaded) return;
    try {
      const res = await fetch('config.json');
      if (res.ok) {
        const config = await res.json();
        this.supabaseUrl = config.supabaseUrl || null;
        this.supabaseKey = config.supabaseKey || null;
      }
    } catch (e) {
      // config.json not present
    }

    if (!this.supabaseUrl || !this.supabaseKey) {
      this.supabaseUrl = localStorage.getItem('supabase_url') || null;
      this.supabaseKey = localStorage.getItem('supabase_key') || null;
    }
    this.configLoaded = true;
  },

  async isSupabaseConfigured() {
    await this.loadConfig();
    return this.supabaseUrl && this.supabaseKey;
  },

  async loadSupabaseLibrary() {
    if (typeof supabase !== 'undefined') return true;
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  },

  async getSupabaseClient() {
    await this.loadConfig();
    if (this.supabaseUrl && this.supabaseKey) {
      const loaded = await this.loadSupabaseLibrary();
      if (loaded && typeof supabase !== 'undefined') {
        return supabase.createClient(this.supabaseUrl, this.supabaseKey);
      }
    }
    return null;
  },

  // Fetch all trainings
  async getTrainings() {
    this.initMock();
    const client = await this.getSupabaseClient();
    if (client) {
      const { data, error } = await client.from('trainings').select('*').order('created_at', { ascending: false });
      if (!error) return data;
    }
    // Fallback Mock
    return JSON.parse(localStorage.getItem('bki_trainings'));
  },

  // Insert a training batch
  async insertTraining(batch) {
    this.initMock();
    const client = await this.getSupabaseClient();
    const newId = "t-" + Date.now();
    const record = { id: newId, ...batch };

    if (client) {
      const { data, error } = await client.from('trainings').insert([batch]).select();
      if (!error) return data[0];
    }

    // Fallback Mock
    const list = JSON.parse(localStorage.getItem('bki_trainings'));
    list.unshift(record);
    localStorage.setItem('bki_trainings', JSON.stringify(list));
    return record;
  },

  // Delete a training batch
  async deleteTraining(trainingId) {
    this.initMock();
    const client = await this.getSupabaseClient();
    
    if (client) {
      // Cascade delete certificates
      await client.from('certificates').delete().eq('training_id', trainingId);
      // Delete training batch
      const { error } = await client.from('trainings').delete().eq('id', trainingId);
      if (error) throw error;
      return { success: true };
    }

    // Fallback Mock
    const trainings = JSON.parse(localStorage.getItem('bki_trainings'));
    const filteredTrainings = trainings.filter(t => t.id !== trainingId);
    localStorage.setItem('bki_trainings', JSON.stringify(filteredTrainings));

    const certs = JSON.parse(localStorage.getItem('bki_certificates'));
    const filteredCerts = certs.filter(c => c.training_id !== trainingId);
    localStorage.setItem('bki_certificates', JSON.stringify(filteredCerts));
    return { success: true };
  },

  // Update training details
  async updateTraining(trainingId, updates) {
    this.initMock();
    const client = await this.getSupabaseClient();
    if (client) {
      const { data, error } = await client.from('trainings').update(updates).eq('id', trainingId).select();
      if (error) throw error;
      return data[0];
    }

    // Fallback Mock
    const list = JSON.parse(localStorage.getItem('bki_trainings'));
    const item = list.find(t => t.id === trainingId);
    if (item) {
      Object.assign(item, updates);
      localStorage.setItem('bki_trainings', JSON.stringify(list));
      return item;
    }
    return null;
  },

  // Fetch all participants
  async getParticipants() {
    this.initMock();
    const client = await this.getSupabaseClient();
    if (client) {
      const { data, error } = await client.from('participants').select('*');
      if (!error) return data;
    }
    return JSON.parse(localStorage.getItem('bki_participants'));
  },

  // Insert/upsert participant
  async upsertParticipant(participant) {
    this.initMock();
    const client = await this.getSupabaseClient();
    
    if (client) {
      const { data, error } = await client.from('participants').upsert([participant], { onConflict: 'name,company' }).select();
      if (!error) return data[0];
    }

    // Fallback Mock
    const list = JSON.parse(localStorage.getItem('bki_participants'));
    let existing = list.find(p => p.name === participant.name && p.company === participant.company);
    if (existing) {
      return existing;
    }
    const newId = "p-" + Date.now() + Math.random().toString(36).substr(2, 4);
    const record = { id: newId, ...participant };
    list.push(record);
    localStorage.setItem('bki_participants', JSON.stringify(list));
    return record;
  },

  // Fetch all certificates
  async getCertificates() {
    this.initMock();
    const client = await this.getSupabaseClient();
    if (client) {
      const { data, error } = await client.from('certificates').select('*, trainings(*), participants(*)');
      if (!error) return data;
    }
    
    // Fallback Mock (Join simulation)
    const certs = JSON.parse(localStorage.getItem('bki_certificates'));
    const trains = JSON.parse(localStorage.getItem('bki_trainings'));
    const parts = JSON.parse(localStorage.getItem('bki_participants'));

    return certs.map(c => ({
      ...c,
      trainings: trains.find(t => t.id === c.training_id),
      participants: parts.find(p => p.id === c.participant_id)
    }));
  },

  // Insert certificate
  async insertCertificate(cert) {
    this.initMock();
    const client = await this.getSupabaseClient();
    const newId = "c-" + Date.now() + Math.random().toString(36).substr(2, 4);
    const record = { id: newId, ...cert };

    if (client) {
      const { data, error } = await client.from('certificates').insert([cert]).select();
      if (!error) return data[0];
    }

    // Fallback Mock
    const list = JSON.parse(localStorage.getItem('bki_certificates'));
    list.push(record);
    localStorage.setItem('bki_certificates', JSON.stringify(list));
    return record;
  },

  // Get certificate by ID (with tracking data)
  async getCertificateById(certId) {
    this.initMock();
    const client = await this.getSupabaseClient();
    if (client) {
      const { data, error } = await client.from('certificates').select('*, participants(name)').eq('id', certId).single();
      if (!error) return data;
    }
    // Fallback Mock
    const list = JSON.parse(localStorage.getItem('bki_certificates'));
    const cert = list.find(c => c.id === certId);
    if (cert) {
      const parts = JSON.parse(localStorage.getItem('bki_participants'));
      const p = parts.find(part => part.id === cert.participant_id);
      cert.participants = p || { name: 'Unknown' };
      return cert;
    }
    return null;
  },

  // Update certificate status
  async updateCertificateStatus(certId, status) {
    this.initMock();
    const client = await this.getSupabaseClient();
    
    // Retrieve currently active PIC name
    let profileName = localStorage.getItem('profileName') || 'Admin';
    if (client) {
      const { data: { user } } = await client.auth.getUser().catch(() => ({ data: { user: null } }));
      if (user && user.user_metadata && user.user_metadata.full_name) {
        profileName = user.user_metadata.full_name;
      }
    }

    const updates = { 
      status,
      updated_at: new Date().toISOString(),
      updated_by: profileName
    };

    if (status === 'Pending' || status === 'Processing') {
      updates.printed_at = null;
      updates.printed_by = null;
      updates.sent_at = null;
      updates.sent_by = null;
    } else if (status === 'Printing') {
      updates.printed_at = new Date().toISOString();
      updates.printed_by = profileName;
      updates.sent_at = null;
      updates.sent_by = null;
    } else if (status === 'Completed') {
      updates.printed_at = new Date().toISOString();
      updates.printed_by = profileName;
      updates.sent_at = new Date().toISOString();
      updates.sent_by = profileName;
    }

    if (client) {
      await client.from('certificates').update(updates).eq('id', certId);
    }
    
    // Fallback Mock
    const list = JSON.parse(localStorage.getItem('bki_certificates'));
    const item = list.find(c => c.id === certId);
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
  },

  // Register a new user (User Provisioning)
  async registerNewUser(email, password) {
    this.initMock();
    const client = await this.getSupabaseClient();
    if (client) {
      const { data, error } = await client.auth.signUp({
        email: email,
        password: password,
        options: {
          emailRedirectTo: window.location.origin + '/index.html'
        }
      });
      if (error) throw error;
      return data;
    }
    
    // Fallback Mock User signup
    return { user: { email, id: "u-mock-" + Date.now() } };
  },
  
  // Update current user password
  async updateUserPassword(newPassword) {
    const client = await this.getSupabaseClient();
    if (client) {
      const { data, error } = await client.auth.updateUser({
        password: newPassword
      });
      if (error) throw error;
      return data;
    }
    return { success: true };
  },

  // Update current user profile metadata
  async updateUserProfile(fullName) {
    const client = await this.getSupabaseClient();
    if (client) {
      const { data, error } = await client.auth.updateUser({
        data: { full_name: fullName }
      });
      if (error) throw error;
      return data;
    }
    return { success: true };
  }
};
