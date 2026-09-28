-- ==============================================================================
-- BKI ACADEMY INTEGRATED PLATFORM - SCALEUP SCHEMA EXTENSION
-- ==============================================================================
-- This script adds the master tables for Companies, Contacts, Programs,
-- Leads (CRM), and Lead Activities, while strictly preserving existing tables:
-- (trainings, participants, certificates, certificate_history).
-- ==============================================================================

-- 1. COMPANIES (Master Perusahaan)
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    alias VARCHAR(100),
    industry VARCHAR(100),
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. CONTACTS (Master Kontak Orang / PIC Pelanggan)
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    company_name VARCHAR(255),
    position VARCHAR(150),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. TRAINING PROGRAMS (Master Katalog Program Pelatihan)
CREATE TABLE IF NOT EXISTS training_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    code VARCHAR(50) NOT NULL UNIQUE,
    category VARCHAR(100),
    duration_days INT DEFAULT 3,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. LEADS (Peluang & Waiting List CRM)
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    contact_name VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(50) NOT NULL,
    contact_email VARCHAR(255),
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    company_name VARCHAR(255) NOT NULL,
    program_id UUID REFERENCES training_programs(id) ON DELETE SET NULL,
    program_name VARCHAR(255) NOT NULL,
    batch_id UUID REFERENCES trainings(id) ON DELETE SET NULL,
    batch_code VARCHAR(100),
    estimated_seats INT NOT NULL DEFAULT 1,
    confirmed_seats INT,
    status VARCHAR(50) NOT NULL DEFAULT 'Baru', -- 'Baru', 'Waiting List', 'Jadwal Ditawarkan', 'Link Terkirim', 'Terdaftar', 'Selesai Training', 'Batal'
    waiting_reason VARCHAR(100), -- 'Belum Ada Jadwal', 'Reschedule', 'Menunggu Konfirmasi Internal', etc.
    cancel_reason TEXT,
    source VARCHAR(50) NOT NULL DEFAULT 'WA Bisnis', -- 'WA Bisnis', 'WA Pribadi', 'Website', 'Referral', etc.
    pic_staff_name VARCHAR(150) NOT NULL,
    next_follow_up_date DATE NOT NULL,
    notes TEXT,
    previous_batch_info VARCHAR(150),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. LEAD ACTIVITIES (Audit Trail & Follow-up History)
CREATE TABLE IF NOT EXISTS lead_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL, -- 'created', 'status_changed', 'link_sent', 'registered', 'follow_up', 'rescheduled', 'cancelled', 'note_added'
    note TEXT NOT NULL,
    actor VARCHAR(150) NOT NULL,
    previous_status VARCHAR(50),
    new_status VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_pic ON leads(pic_staff_name);
CREATE INDEX IF NOT EXISTS idx_leads_next_follow_up ON leads(next_follow_up_date);
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead ON lead_activities(lead_id);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to companies" ON companies;
CREATE POLICY "Allow all access to companies" ON companies FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to contacts" ON contacts;
CREATE POLICY "Allow all access to contacts" ON contacts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to training_programs" ON training_programs;
CREATE POLICY "Allow all access to training_programs" ON training_programs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to leads" ON leads;
CREATE POLICY "Allow all access to leads" ON leads FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to lead_activities" ON lead_activities;
CREATE POLICY "Allow all access to lead_activities" ON lead_activities FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- SEED DATA: 21 OFFICIAL BKI ACADEMY TRAINING PROGRAMS
-- ==============================================================================
INSERT INTO training_programs (name, code, category, duration_days, is_active) VALUES
('Internal Auditor ISM Code', 'ISM-AUD', 'ISM Code & Safety', 3, true),
('DPA ISM Code', 'ISM-DPA', 'ISM Code & Safety', 3, true),
('Risk Assessment ISM Code', 'ISM-RA', 'ISM Code & Safety', 2, true),
('Marine Accident and Investigation', 'MAI', 'Maritime Investigation', 4, true),
('Jetty and Loading Master', 'JLM', 'Port & Terminal Operations', 3, true),
('Maritime Cyber Security', 'MCS', 'Cyber & Digital Security', 2, true),
('Internal Auditor ISPS Code', 'ISPS-AUD', 'ISPS Code & Port Security', 3, true),
('CSO ISPS Code', 'ISPS-CSO', 'ISPS Code & Port Security', 3, true),
('PFSO ISPS Code', 'ISPS-PFSO', 'ISPS Code & Port Security', 3, true),
('3.24 Security Awareness (Designated Security Duties)', 'IMO-3.24', 'ISPS Code & Port Security', 1, true),
('3.25 Security Awareness (All Port Facility Personnel)', 'IMO-3.25', 'ISPS Code & Port Security', 1, true),
('Marine Surveyor', 'MS', 'Survey & Inspection', 5, true),
('New Building Supervision', 'NBS', 'Survey & Inspection', 4, true),
('Marine Superintendent', 'MSUP', 'Technical & Ship Operations', 4, true),
('Container Inspector', 'CI', 'Survey & Inspection', 3, true),
('Welding Inspector', 'WI', 'Welding & NDT', 5, true),
('Ship Welding Inspector', 'SWI', 'Welding & NDT', 5, true),
('Welder Certification', 'WC', 'Welding & NDT', 3, true),
('Maritime Labour Convention', 'MLC', 'Statutory & Compliance', 2, true),
('Ballast Water Management', 'BWM', 'Statutory & Compliance', 2, true),
('Ship-Design Engineering Review Workshop', 'SDER', 'Ship Design & Engineering', 3, true)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category;

