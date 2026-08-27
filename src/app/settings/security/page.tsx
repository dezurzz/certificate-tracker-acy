'use client';

import React, { useState, useEffect } from 'react';
import { DB } from '@/lib/db';
import ConfirmationModal from '@/components/ConfirmationModal';

export default function SecuritySettingsPage() {
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [twofaEnabled, setTwofaEnabled] = useState(false);
  const [twofaModalOpen, setTwofaModalOpen] = useState(false);
  const [twofaCode, setTwofaCode] = useState('');
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

  const [sessions, setSessions] = useState([
    { id: 'sess-mac', name: 'MacBook Pro (Jakarta, Indonesia)', device: 'laptop_mac', desc: 'Chrome Browser • IP 192.168.1.102', current: true },
    { id: 'sess-mobile', name: 'Samsung Galaxy S24 (Surabaya, Indonesia)', device: 'phone_android', desc: 'Mobile App • IP 182.4.22.90', current: false }
  ]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setTwofaEnabled(localStorage.getItem('twofa_enabled') === 'true');
    }
  }, []);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPass !== confirmPass) {
      alert('Confirm password does not match new password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await DB.updateUserPassword(newPass);
      alert('Password updated successfully!');
      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');
    } catch (err: any) {
      console.error(err);
      alert('Failed to update password: ' + err?.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handle2FAToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.checked;
    if (val) {
      setTwofaModalOpen(true);
    } else {
      if (typeof window !== 'undefined') {
        localStorage.setItem('twofa_enabled', 'false');
      }
      setTwofaEnabled(false);
      alert('Two-factor authentication disabled.');
    }
  };

  const handleConfirm2FA = (e: React.FormEvent) => {
    e.preventDefault();
    if (twofaCode.length === 6) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('twofa_enabled', 'true');
      }
      setTwofaEnabled(true);
      setTwofaModalOpen(false);
      setTwofaCode('');
      alert('Two-factor authentication enabled successfully!');
    } else {
      alert('Please enter a valid 6-digit code.');
    }
  };

  const handleCancel2FA = () => {
    setTwofaModalOpen(false);
    setTwofaCode('');
  };

  const handleRevokeSession = (id: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Revoke Session',
      message: 'Are you sure you want to revoke this login session? The associated device will be immediately signed out.',
      confirmLabel: 'Revoke',
      type: 'danger',
      onConfirm: () => {
        setSessions(prev => prev.filter(s => s.id !== id));
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        alert('Login session revoked successfully.');
      }
    });
  };

  return (
    <div className="flex-grow flex flex-col gap-6 w-full max-w-3xl">
      {/* Card 1: Update Password */}
      <div className="cms-card bg-white w-full border border-slate-200 shadow-sm p-6 rounded-xl">
        <section id="security-password">
          <div className="border-b border-slate-200 pb-4 mb-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600 fill">shield</span>
              Update Password
            </h3>
            <p className="text-xs text-slate-500 mt-1">Change your current account access credentials.</p>
          </div>

          <form onSubmit={handlePasswordUpdate} className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-6">
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider" htmlFor="current-pass">Current Password</label>
                <input
                  className="cms-input"
                  id="current-pass"
                  type="password"
                  value={currentPass}
                  onChange={(e) => setCurrentPass(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-1.5 text-left">
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider" htmlFor="new-pass">New Password</label>
                  <input
                    className="cms-input"
                    id="new-pass"
                    type="password"
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    minLength={8}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5 text-left">
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider" htmlFor="confirm-pass">Confirm New Password</label>
                  <input
                    className="cms-input"
                    id="confirm-pass"
                    type="password"
                    value={confirmPass}
                    onChange={(e) => setConfirmPass(e.target.value)}
                    minLength={8}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button type="submit" disabled={isSubmitting} className="cms-btn-primary disabled:opacity-50">
                {isSubmitting ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </section>
      </div>

      {/* Card 2: 2FA */}
      <div className="cms-card bg-white w-full border border-slate-200 shadow-sm p-6 rounded-xl">
        <section id="security-2fa">
          <div className="border-b border-slate-200 pb-4 mb-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600">smartphone</span>
              Two-Factor Authentication (2FA)
            </h3>
            <p className="text-xs text-slate-500 mt-1">Secure your system with an extra verification device.</p>
          </div>

          <div className="flex items-start justify-between p-4 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors bg-white">
            <div className="flex flex-col gap-1 pr-6 text-left">
              <span className="text-sm font-bold text-slate-800">Authenticator App</span>
              <span className="text-xs text-slate-500">Require temporary 6-digit codes generated by your mobile device.</span>
            </div>
            <input
              id="twofa-toggle"
              checked={twofaEnabled || twofaModalOpen}
              onChange={handle2FAToggle}
              className="rounded border-slate-350 text-blue-600 focus:ring-blue-500 border-slate-250 cursor-pointer h-4 w-4"
              type="checkbox"
            />
          </div>
        </section>
      </div>

      {/* Card 3: Sessions */}
      <div className="cms-card bg-white w-full border border-slate-200 shadow-sm p-6 rounded-xl">
        <section id="security-sessions">
          <div className="border-b border-slate-200 pb-4 mb-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600">devices</span>
              Active Login Sessions
            </h3>
            <p className="text-xs text-slate-500 mt-1">Manage external devices logged into BKI Academy CMS.</p>
          </div>

          <div className="flex flex-col gap-4">
            {sessions.map(s => (
              <div
                key={s.id}
                className={`flex items-center justify-between p-4 rounded-xl border ${
                  s.current ? 'bg-blue-50/20 border-blue-100' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex gap-4 items-center text-left">
                  <span className={`material-symbols-outlined ${s.current ? 'text-blue-600' : 'text-slate-400'}`}>
                    {s.device}
                  </span>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-800">{s.name}</span>
                      {s.current && (
                        <span className="bg-blue-100 text-blue-800 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">
                          Current Session
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500">{s.desc}</span>
                  </div>
                </div>
                {!s.current && (
                  <button
                    onClick={() => handleRevokeSession(s.id)}
                    className="text-xs font-semibold text-red-655 hover:text-red-700 hover:underline shrink-0"
                  >
                    Revoke Access
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* 2FA SETUP MODAL */}
      {twofaModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-4" onClick={handleCancel2FA}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-white">
              <h3 className="text-base font-bold text-slate-800">Set Up Two-Factor (2FA)</h3>
              <button className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors" onClick={handleCancel2FA}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleConfirm2FA} className="p-6 flex flex-col gap-4 items-center text-center bg-white">
              <p className="text-xs text-slate-500">Scan this QR code with Google Authenticator or Microsoft Authenticator app.</p>
              
              {/* Mock QR Code */}
              <div className="w-36 h-36 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center p-2 relative group cursor-help">
                <span className="material-symbols-outlined text-4xl text-slate-400">qr_code_2</span>
                <div className="absolute inset-0 bg-slate-950/80 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] text-white p-2">
                  Simulated Key: BKIACAD116
                </div>
              </div>
              
              <div className="w-full flex flex-col gap-1 text-left">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider" htmlFor="twofa-code">Verification Code</label>
                <input
                  className="cms-input text-center font-mono tracking-widest text-lg"
                  id="twofa-code"
                  placeholder="000000"
                  value={twofaCode}
                  onChange={(e) => setTwofaCode(e.target.value)}
                  type="text"
                  maxLength={6}
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-2 w-full">
                <button className="cms-btn-secondary flex-1" type="button" onClick={handleCancel2FA}>Cancel</button>
                <button className="cms-btn-primary flex-1" type="submit">Verify & Enable</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Confirmation Modal */}
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
