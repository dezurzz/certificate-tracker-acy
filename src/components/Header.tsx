'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { DB, Certificate, Training, CertificateHistory } from '@/lib/db';

interface NotificationItem {
  type: string;
  icon: string;
  iconColor: string;
  message: string;
  time: Date;
}

export default function Header({ pageTitle }: { pageTitle: string }) {
  const { user, signOut } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [hasUnread, setHasUnread] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadNotifications() {
      try {
        const [trainings, certificates, histories] = await Promise.all([
          DB.getTrainings(),
          DB.getCertificates(),
          DB.getCertificateHistory()
        ]);

        const notifs: NotificationItem[] = [];

        // 1. SLA Overdue Alerts
        const slaThreshold = typeof window !== 'undefined' ? parseInt(localStorage.getItem('sys_sla') || '4', 10) : 4;
        certificates.forEach(c => {
          if (c.status !== 'Completed' && c.sla_age_days > slaThreshold) {
            const name = c.participants ? c.participants.name : 'Unknown';
            const progName = c.trainings ? c.trainings.program_name : 'Training';
            const time = c.updated_at ? new Date(c.updated_at) : new Date(c.created_at || (Date.now() - 86400000));
            notifs.push({
              type: 'overdue',
              icon: 'warning',
              iconColor: 'text-red-500',
              message: `SLA Overdue: <span class="font-semibold text-slate-900">${name}</span> (${progName}) delayed by ${c.sla_age_days} days.`,
              time: time
            });
          }
        });

        // 2. Dynamic Status Update Notifications from CertificateHistory
        histories.forEach(h => {
          const cert = certificates.find(c => c.id === h.certificate_id);
          const name = cert?.participants ? cert.participants.name : 'Unknown';
          const progName = cert?.trainings ? cert.trainings.program_name : 'Training';
          const certType = cert ? cert.certificate_type : 'Certificate';

          let icon = 'info';
          let iconColor = 'text-blue-500';
          if (h.new_status === 'Completed') {
            icon = 'check_circle';
            iconColor = 'text-green-500';
          } else if (h.new_status === 'Printing') {
            icon = 'print';
            iconColor = 'text-amber-500';
          } else if (h.new_status === 'Pending') {
            icon = 'hourglass_empty';
            iconColor = 'text-slate-400';
          }

          notifs.push({
            type: 'status_update',
            icon: icon,
            iconColor: iconColor,
            message: `Certificate Update: <span class="font-semibold text-slate-900">${name}</span> (${progName}) moved to ${h.new_status} by ${h.changed_by}.`,
            time: new Date(h.created_at)
          });
        });

        // 3. New Training Batch
        trainings.forEach(t => {
          const time = t.created_at ? new Date(t.created_at) : new Date(t.start_date);
          notifs.push({
            type: 'new_batch',
            icon: 'add_circle',
            iconColor: 'text-blue-500',
            message: `New batch created: <span class="font-semibold text-slate-900">${t.program_name}</span> (${t.batch_code}).`,
            time: time
          });
        });

        // Sort by time descending
        notifs.sort((a, b) => b.time.getTime() - a.time.getTime());

        // Limit to 5
        const displayNotifs = notifs.slice(0, 5);
        setNotifications(displayNotifs);

        if (displayNotifs.length > 0) {
          const latestNotifTime = displayNotifs[0].time.getTime();
          const lastReadTime = parseInt(localStorage.getItem('bki_notif_read_timestamp') || '0');
          setHasUnread(latestNotifTime > lastReadTime);
        } else {
          setHasUnread(false);
        }
      } catch (err) {
        console.error('Error loading notifications:', err);
      }
    }

    loadNotifications();
    const handleDbUpdate = () => {
      loadNotifications();
    };
    window.addEventListener('bki-db-update', handleDbUpdate);
    const interval = setInterval(loadNotifications, 30000); // Check every 30s
    return () => {
      window.removeEventListener('bki-db-update', handleDbUpdate);
      clearInterval(interval);
    };
  }, []);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAllRead = () => {
    localStorage.setItem('bki_notif_read_timestamp', Date.now().toString());
    setHasUnread(false);
  };

  const formatRelativeTime = (dateInput: Date) => {
    const diffMs = new Date().getTime() - dateInput.getTime();
    const diffMins = Math.round(diffMs / 60000);
    const diffHours = Math.round(diffMs / 3600000);
    const diffDays = Math.round(diffMs / 86400000);

    if (diffMs < 0 || diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} mins ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return dateInput.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  };

  return (
    <>
      <header className="bg-white border-b border-slate-200 flex justify-between items-center h-16 px-6 sticky top-0 z-40 animate-in fade-in slide-in-from-top-1 duration-150">
        {/* Left Side: Page Title */}
        <h2 className="text-md font-bold text-slate-700 uppercase tracking-wider">{pageTitle}</h2>

        {/* Right Side: Actions */}
        <div className="flex items-center gap-4">
          {/* Notification button */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => {
                setNotifOpen(!notifOpen);
                setProfileOpen(false);
              }}
              className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors relative"
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              {/* Red dot indicator */}
              {hasUnread && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
              )}
            </button>
            
            {/* Dropdown content */}
            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-50 text-left">
                <div className="px-4 py-2 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                  <span className="font-bold text-xs text-slate-700">Notifications</span>
                  <button onClick={markAllRead} className="text-[10px] font-semibold text-blue-600 hover:underline">
                    Mark all read
                  </button>
                </div>
                <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto table-scroll">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-slate-400">
                      <span className="material-symbols-outlined text-xl block mb-1">notifications_off</span>
                      No notifications at this time
                    </div>
                  ) : (
                    notifications.map((n, index) => (
                      <div key={index} className="px-4 py-3 hover:bg-slate-50 flex gap-2">
                        <span className={`material-symbols-outlined ${n.iconColor} text-sm mt-0.5`}>{n.icon}</span>
                        <div>
                          <p className="text-xs text-slate-700" dangerouslySetInnerHTML={{ __html: n.message }}></p>
                          <span className="text-[9px] text-slate-400 block mt-1 font-semibold uppercase">
                            {formatRelativeTime(n.time)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Help button */}
          <button
            onClick={() => setHelpOpen(true)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">help_outline</span>
          </button>

          <div className="w-px h-6 bg-slate-200"></div>

          {/* Profile Dropdown Button */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => {
                setProfileOpen(!profileOpen);
                setNotifOpen(false);
              }}
              className="flex items-center gap-2 hover:bg-slate-50 p-1 rounded-full transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 text-slate-400 shrink-0">
                <span className="material-symbols-outlined text-base">person</span>
              </div>
              <span className="text-xs font-semibold text-slate-700 hidden sm:inline">{user?.name || 'Admin'}</span>
              <span className="material-symbols-outlined text-slate-400 text-sm">expand_more</span>
            </button>
            
            {/* Dropdown content */}
            {profileOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-50 text-left">
                <Link href="/settings/profile" className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  <span className="material-symbols-outlined text-sm">person</span> Profile Settings
                </Link>
                <Link href="/settings/system" className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  <span className="material-symbols-outlined text-sm">settings</span> System Config
                </Link>
                <hr className="border-slate-100 my-1" />
                <button
                  onClick={() => signOut()}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 text-left font-semibold"
                >
                  <span className="material-symbols-outlined text-sm">logout</span> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Support Center Help Modal */}
      {helpOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-4"
          onClick={() => setHelpOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-white">
              <h3 className="text-base font-bold text-slate-800">BKI Academy Support Center</h3>
              <button
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors"
                onClick={() => setHelpOpen(false)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div>
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2">Frequently Asked Questions</h4>
                <ul className="text-xs text-slate-600 flex flex-col gap-2 list-disc pl-4">
                  <li><strong>How do I change certificate status?</strong> Go to Training Detail &rarr; Certificates Tab and click on a card to open workflow status details.</li>
                  <li><strong>How do I import participants?</strong> Go to Training Detail &rarr; Participants Tab and click "Upload Participant List".</li>
                  <li><strong>Where do I set SLA limits?</strong> Go to Settings &rarr; System Configuration.</li>
                </ul>
              </div>
              <hr className="border-slate-100" />
              <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="material-symbols-outlined text-blue-600 text-2xl">mail</span>
                <div>
                  <p className="text-xs font-semibold text-slate-800">Need IT Support?</p>
                  <a href="mailto:support@bkiacademy.com" className="text-[11px] text-blue-600 hover:underline">
                    support@bkiacademy.com
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
