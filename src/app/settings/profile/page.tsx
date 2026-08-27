'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function ProfileSettingsPage() {
  const { user, updateProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.name);
      setEmail(user.email);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const res = await updateProfile(fullName);
    if (res.success) {
      alert('Profile details saved successfully!');
    } else {
      alert('Failed to update profile: ' + res.error);
    }
    setIsSubmitting(false);
  };

  const handleDiscard = () => {
    if (user) {
      setFullName(user.name);
      setEmail(user.email);
    }
  };

  return (
    <div className="cms-card bg-white w-full border border-slate-200 shadow-sm p-6 rounded-xl">
      <section id="profile">
        {/* Header */}
        <div className="border-b border-slate-200 pb-4 mb-6">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600 fill">person</span>
            Profile Settings
          </h3>
          <p className="text-xs text-slate-500 mt-1">Update your personal account information and details.</p>
        </div>

        {/* Profile Info Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Avatar Silhouette */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 text-slate-400 shrink-0 shadow-inner">
              <span className="material-symbols-outlined text-4xl">person</span>
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Account Photo</label>
              <span className="text-xs text-slate-400 mt-0.5">Profile pictures are disabled.</span>
            </div>
          </div>

          {/* Input Group */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider" htmlFor="prof-name">Full Name</label>
              <input
                className="cms-input"
                id="prof-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Andi Pratama"
                type="text"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider" htmlFor="prof-email">Email Address</label>
              <input
                className="cms-input bg-slate-50 text-slate-500 font-semibold cursor-not-allowed"
                id="prof-email"
                value={email}
                readOnly
                placeholder="e.g. andi.pratama@bki.co.id"
                type="email"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider" htmlFor="prof-role">Account Role</label>
              <input
                className="cms-input bg-slate-50 text-slate-500 font-semibold cursor-not-allowed"
                id="prof-role"
                value={user?.role || 'System Administrator'}
                type="text"
                readOnly
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider" htmlFor="prof-dept">Department</label>
              <input
                className="cms-input bg-slate-50 text-slate-500 font-semibold cursor-not-allowed"
                id="prof-dept"
                value="BKI Academy Training Center"
                type="text"
                readOnly
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button type="button" onClick={handleDiscard} className="cms-btn-secondary">Discard Changes</button>
            <button type="submit" disabled={isSubmitting} className="cms-btn-primary disabled:opacity-50">
              {isSubmitting ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
