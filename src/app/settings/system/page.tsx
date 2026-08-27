'use client';

import React, { useState, useEffect } from 'react';
import { DB } from '@/lib/db';
import ConfirmationModal from '@/components/ConfirmationModal';

export default function SystemSettingsPage() {
  const [sla, setSla] = useState('4');
  const [buffer, setBuffer] = useState('30');
  const [template, setTemplate] = useState('Standard Corporate Issue v2.1');
  const [dbUrl, setDbUrl] = useState('');
  const [dbKey, setDbKey] = useState('');

  // User Provisioning fields
  const [provEmail, setProvEmail] = useState('');
  const [provPassword, setProvPassword] = useState('');
  const [provSubmitting, setProvSubmitting] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    type?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSla(localStorage.getItem('sys_sla') || '4');
      setBuffer(localStorage.getItem('sys_buffer') || '30');
      setTemplate(localStorage.getItem('sys_template') || 'Standard Corporate Issue v2.1');
      setDbUrl(localStorage.getItem('supabase_url') || '');
      setDbKey(localStorage.getItem('supabase_key') || '');
    }
  }, []);

  const handleApplyConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== 'undefined') {
      localStorage.setItem('sys_sla', sla);
      localStorage.setItem('sys_buffer', buffer);
      localStorage.setItem('sys_template', template);
      localStorage.setItem('supabase_url', dbUrl.trim());
      localStorage.setItem('supabase_key', dbKey.trim());
      alert('System configurations applied successfully!');
    }
  };

  const handleResetToDefaults = () => {
    setConfirmConfig({
      isOpen: true,
      title: 'Reset Configurations',
      message: 'Reset all configurations to standard values (4 days SLA, 30 days buffer)? This will overwrite active parameters.',
      confirmLabel: 'Reset Defaults',
      type: 'warning',
      onConfirm: () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        setSla('4');
        setBuffer('30');
        setTemplate('Standard Corporate Issue v2.1');
        setDbUrl('');
        setDbKey('');

        if (typeof window !== 'undefined') {
          localStorage.setItem('sys_sla', '4');
          localStorage.setItem('sys_buffer', '30');
          localStorage.setItem('sys_template', 'Standard Corporate Issue v2.1');
          localStorage.setItem('supabase_url', '');
          localStorage.setItem('supabase_key', '');
        }
        alert('Configurations reset to system defaults.');
      }
    });
  };

  const handleRegisterUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setProvSubmitting(true);

    try {
      await DB.registerNewUser(provEmail.trim(), provPassword);
      alert(`Account for ${provEmail} has been registered successfully!`);
      setProvEmail('');
      setProvPassword('');
    } catch (err: any) {
      console.error(err);
      alert('Failed to register user: ' + err?.message);
    } finally {
      setProvSubmitting(false);
    }
  };

  return (
    <div className="flex-1 cms-card bg-white w-full border border-slate-200 shadow-sm p-6 rounded-xl">
      <section id="system">
        {/* Header */}
        <div className="border-b border-slate-200 pb-4 mb-6">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600 fill">dns</span>
            System Configuration
          </h3>
          <p className="text-xs text-slate-500 mt-1">Configure global Service Level Agreements (SLAs) and processing parameters.</p>
        </div>

        {/* Configuration Form */}
        <form onSubmit={handleApplyConfig} className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* SLA setting */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-4 text-left">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-700">Standard Processing SLA (Days)</label>
                <span className="text-blue-700 font-semibold bg-blue-100 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold">Critical Metric</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  id="sys-sla"
                  value={sla}
                  onChange={(e) => setSla(e.target.value)}
                  className="cms-input w-24 text-center font-semibold"
                  type="number"
                  min="1"
                  required
                />
                <span className="text-xs text-slate-500 font-medium">days from completion</span>
              </div>
              <p className="text-[11px] text-slate-400">Threshold before a certificate request is flagged as delayed.</p>
            </div>

            {/* Buffer setting */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-4 text-left">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-700">Certificate Validity Buffer</label>
              </div>
              <div className="flex items-center gap-3">
                <input
                  id="sys-buffer"
                  value={buffer}
                  onChange={(e) => setBuffer(e.target.value)}
                  className="cms-input w-24 text-center font-semibold"
                  type="number"
                  min="1"
                  required
                />
                <span className="text-xs text-slate-500 font-medium">days prior to expiry</span>
              </div>
              <p className="text-[11px] text-slate-400">When to start displaying 'Expiring Soon' warnings in dashboards.</p>
            </div>

            {/* Template setting */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-4 md:col-span-2 text-left">
              <label className="text-xs font-bold text-slate-700" htmlFor="sys-template">Default Certificate Template</label>
              <div className="relative">
                <select
                  id="sys-template"
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  className="cms-input appearance-none pr-10 cursor-pointer text-slate-700"
                >
                  <option>Standard Corporate Issue v2.1</option>
                  <option>Legacy Certificate Format v1.0</option>
                  <option>External Training Record Template</option>
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
              </div>
            </div>

            {/* Supabase setting */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-4 md:col-span-2 text-left">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-700">Supabase Connection Settings</label>
                <span className="text-blue-700 font-semibold bg-blue-100 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold">Database Sync</span>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Project URL</label>
                  <input
                    id="sys-supabase-url"
                    value={dbUrl}
                    onChange={(e) => setDbUrl(e.target.value)}
                    className="cms-input font-mono text-xs"
                    placeholder="https://xxxxxx.supabase.co"
                    type="url"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Anon API Key</label>
                  <input
                    id="sys-supabase-key"
                    value={dbKey}
                    onChange={(e) => setDbKey(e.target.value)}
                    className="cms-input font-mono text-xs"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    type="password"
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-400">
                Provide your Supabase URL and Anon API key to sync training, attendee, and certificate data in real-time. Leave blank to run locally in localStorage mock database.
              </p>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button type="button" onClick={handleResetToDefaults} className="cms-btn-secondary">Reset to Defaults</button>
            <button type="submit" className="cms-btn-primary">Apply Configuration</button>
          </div>
        </form>
      </section>

      {/* User Provisioning section */}
      <section id="user-provisioning" className="border-t border-slate-200 pt-6 mt-6">
        <div className="pb-4 mb-4 text-left">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600 fill">person_add</span>
            Add New Staff Account
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Register new administrative or operator accounts. They can login with the default password and change it later.
          </p>
        </div>

        <form onSubmit={handleRegisterUser} className="flex flex-col gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">User Email Address</label>
              <input
                value={provEmail}
                onChange={(e) => setProvEmail(e.target.value)}
                className="cms-input text-xs font-semibold"
                placeholder="operator@bkiacademy.com"
                type="email"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Default Password</label>
              <input
                value={provPassword}
                onChange={(e) => setProvPassword(e.target.value)}
                className="cms-input text-xs font-semibold font-mono"
                placeholder="e.g. BKI12345"
                type="text"
                required
              />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button type="submit" disabled={provSubmitting} className="cms-btn-primary py-2 px-4 text-xs flex items-center gap-1 cursor-pointer">
              {provSubmitting ? (
                <>
                  <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full align-middle mr-1.5"></span>
                  Registering...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">person_add</span>
                  Register User
                </>
              )}
            </button>
          </div>
        </form>
      </section>
      <ConfirmationModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmLabel={confirmConfig.confirmLabel}
        type={confirmConfig.type}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
