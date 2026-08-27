'use client';

import React, { useState, useEffect } from 'react';

export default function NotificationsSettingsPage() {
  const [digest, setDigest] = useState(true);
  const [breaches, setBreaches] = useState(true);
  const [reports, setReports] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDigest(localStorage.getItem('notif_digest') !== 'false');
      setBreaches(localStorage.getItem('notif_breaches') !== 'false');
      setReports(localStorage.getItem('notif_reports') === 'true');
    }
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== 'undefined') {
      localStorage.setItem('notif_digest', String(digest));
      localStorage.setItem('notif_breaches', String(breaches));
      localStorage.setItem('notif_reports', String(reports));
      alert('Notification preferences updated successfully!');
    }
  };

  const handleDiscard = () => {
    if (typeof window !== 'undefined') {
      setDigest(localStorage.getItem('notif_digest') !== 'false');
      setBreaches(localStorage.getItem('notif_breaches') !== 'false');
      setReports(localStorage.getItem('notif_reports') === 'true');
      alert('Changes discarded. State reverted.');
    }
  };

  return (
    <div className="cms-card bg-white w-full border border-slate-200 shadow-sm p-6 rounded-xl">
      <section id="notifications">
        {/* Header */}
        <div className="border-b border-slate-200 pb-4 mb-6">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600 fill">notifications_active</span>
            Notification Preferences
          </h3>
          <p className="text-xs text-slate-500 mt-1">Choose how and when you receive system digests and warning triggers.</p>
        </div>

        {/* Preferences Form */}
        <form onSubmit={handleSave} className="flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            {/* Toggle Item 1 */}
            <div className="flex items-start justify-between p-4 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors bg-white">
              <div className="flex flex-col gap-1 pr-6 text-left">
                <span className="text-sm font-bold text-slate-800">Email digest summary</span>
                <span className="text-xs text-slate-500">Receive a consolidated daily summary of all batch completions and PIC pipelines.</span>
              </div>
              <input
                id="notif-digest"
                checked={digest}
                onChange={(e) => setDigest(e.target.checked)}
                className="rounded border-slate-350 text-blue-600 focus:ring-blue-500 border-slate-250 cursor-pointer h-4 w-4"
                type="checkbox"
              />
            </div>

            {/* Toggle Item 2 */}
            <div className="flex items-start justify-between p-4 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors bg-white">
              <div className="flex flex-col gap-1 pr-6 text-left">
                <span className="text-sm font-bold text-slate-800">SLA warning notifications</span>
                <span className="text-xs text-slate-500">Get alerted immediately when a certificate processing age exceeds 7 days.</span>
              </div>
              <input
                id="notif-breaches"
                checked={breaches}
                onChange={(e) => setBreaches(e.target.checked)}
                className="rounded border-slate-350 text-blue-600 focus:ring-blue-500 border-slate-250 cursor-pointer h-4 w-4"
                type="checkbox"
              />
            </div>

            {/* Toggle Item 3 */}
            <div className="flex items-start justify-between p-4 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors bg-white">
              <div className="flex flex-col gap-1 pr-6 text-left">
                <span className="text-sm font-bold text-slate-800">System analytics reports</span>
                <span className="text-xs text-slate-500">Receive monthly performance graphs and PIC compliance ratings in your inbox.</span>
              </div>
              <input
                id="notif-reports"
                checked={reports}
                onChange={(e) => setReports(e.target.checked)}
                className="rounded border-slate-350 text-blue-600 focus:ring-blue-500 border-slate-250 cursor-pointer h-4 w-4"
                type="checkbox"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button type="button" onClick={handleDiscard} className="cms-btn-secondary">Discard Changes</button>
            <button type="submit" className="cms-btn-primary">Save Preferences</button>
          </div>
        </form>
      </section>
    </div>
  );
}
