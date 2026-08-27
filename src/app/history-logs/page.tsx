'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { DB, Training, Certificate } from '@/lib/db';

interface ActivityLogItem {
  id: string;
  type: string;
  title: string;
  desc: string;
  time: Date;
  pic: string;
  trainingName: string;
  dotColor: string;
  badgeClass: string;
}

export default function HistoryLogsPage() {
  const [activities, setActivities] = useState<ActivityLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [groupBy, setGroupBy] = useState<'time' | 'pic' | 'training'>('time');

  const loadData = async () => {
    setLoading(true);
    try {
      const trainings = await DB.getTrainings();
      const certificates = await DB.getCertificates();
      const histories = await DB.getCertificateHistory();

      const acts: ActivityLogItem[] = [];

      // Trainings created events
      trainings.forEach(t => {
        acts.push({
          id: `t-${t.id}`,
          type: 'training_created',
          title: 'Training Batch Created',
          desc: `Program batch "${t.program_name}" (${t.batch_code}) was initialized.`,
          time: t.created_at ? new Date(t.created_at) : (t.start_date ? new Date(t.start_date) : new Date()),
          pic: (t as any).pic || 'System',
          trainingName: `${t.program_name} (${t.batch_code})`,
          dotColor: 'bg-blue-600',
          badgeClass: 'bg-blue-50 text-blue-700 border-blue-100'
        });
      });

      // Certificates draft generated events
      certificates.forEach(c => {
        const name = c.participants ? c.participants.name : 'Unknown';
        const trainingName = c.trainings ? `${c.trainings.program_name} (${c.trainings.batch_code})` : 'Unknown Training';

        if (c.created_at) {
          acts.push({
            id: `c-gen-${c.id}`,
            type: 'certificate_created',
            title: 'Certificate Generated',
            desc: `Certificate draft generated for "${name}" (${c.certificate_type}).`,
            time: new Date(c.created_at),
            pic: c.updated_by || 'System',
            trainingName: trainingName,
            dotColor: 'bg-slate-300',
            badgeClass: 'bg-slate-50 text-slate-500 border-slate-100'
          });
        }
      });

      // Certificate status history updates
      histories.forEach(h => {
        const cert = certificates.find(c => c.id === h.certificate_id);
        const name = cert?.participants ? cert.participants.name : 'Unknown';
        const trainingName = cert?.trainings ? `${cert.trainings.program_name} (${cert.trainings.batch_code})` : 'Unknown Training';

        let dotColor = 'bg-blue-500';
        let badgeClass = 'bg-blue-50 text-blue-700 border-blue-100';
        if (h.new_status === 'Printing') {
          dotColor = 'bg-amber-500';
          badgeClass = 'bg-amber-50 text-amber-700 border-amber-100';
        } else if (h.new_status === 'Completed') {
          dotColor = 'bg-green-500';
          badgeClass = 'bg-green-50 text-green-700 border-green-100';
        } else if (h.new_status === 'Pending') {
          dotColor = 'bg-slate-400';
          badgeClass = 'bg-slate-50 text-slate-500 border-slate-100';
        }

        acts.push({
          id: `h-log-${h.id}`,
          type: `certificate_${h.new_status.toLowerCase()}`,
          title: `Certificate updated to ${h.new_status}`,
          desc: `Status of "${name}"'s certificate shifted from <span class="font-semibold text-slate-800">${h.previous_status}</span> to <span class="font-semibold text-slate-800">${h.new_status}</span>.`,
          time: new Date(h.created_at),
          pic: h.changed_by,
          trainingName: trainingName,
          dotColor,
          badgeClass
        });
      });

      setActivities(acts);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleDbUpdate = () => {
      loadData();
    };
    window.addEventListener('bki-db-update', handleDbUpdate);
    return () => {
      window.removeEventListener('bki-db-update', handleDbUpdate);
    };
  }, []);

  const formatRelativeTime = (date: Date) => {
    const diffMs = new Date().getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMs < 0 || diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} mins ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return 'Yesterday';
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const getGroupTimeLabel = (date: Date) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const itemDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (itemDate.getTime() === today.getTime()) return 'Today';
    if (itemDate.getTime() === yesterday.getTime()) return 'Yesterday';
    
    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    if (date >= oneWeekAgo) return 'This Week';
    
    return 'Older Logs';
  };

  const handleExportCSV = () => {
    if (activities.length === 0) return;
    let csv = "ID,Timestamp,Type,Event,PIC,Training\n";
    activities.forEach(act => {
      const timeStr = act.time.toISOString();
      const descText = act.desc.replace(/,/g, ';');
      csv += `"${act.id}","${timeStr}","${act.type}","${descText}","${act.pic}","${act.trainingName}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `bki-audit-logs-${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 1. Filter activities
  const filtered = activities.filter(act => {
    const term = searchTerm.toLowerCase();
    return act.title.toLowerCase().includes(term) ||
           act.desc.toLowerCase().includes(term) ||
           act.pic.toLowerCase().includes(term) ||
           act.trainingName.toLowerCase().includes(term);
  });

  // Sort descending by time
  filtered.sort((a, b) => b.time.getTime() - a.time.getTime());

  // 2. Group activities
  const groups: Record<string, ActivityLogItem[]> = {};
  filtered.forEach(act => {
    let key = '';
    if (groupBy === 'time') {
      key = getGroupTimeLabel(act.time);
    } else if (groupBy === 'pic') {
      key = act.pic || 'System / Batch';
    } else if (groupBy === 'training') {
      key = act.trainingName || 'Unassociated';
    }

    if (!groups[key]) groups[key] = [];
    groups[key].push(act);
  });

  // Group Keys Sorting
  const groupKeys = Object.keys(groups);
  if (groupBy === 'time') {
    const order = ['Today', 'Yesterday', 'This Week', 'Older Logs'];
    groupKeys.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  } else {
    groupKeys.sort();
  }

  return (
    <DashboardLayout pageTitle="History Logs">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Audit History Logs</h2>
          <p className="text-sm text-slate-500 mt-1">Trace all training deployments and certificate status updates.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleExportCSV} className="cms-btn-secondary h-10 shadow-sm">
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export Audit Trail
          </button>
        </div>
      </div>

      {/* Controls & Grouping Filter */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm mb-8">
        <div className="relative w-full md:w-80">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 transition-all text-slate-800"
            placeholder="Search logs..."
            type="text"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Group By</label>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as any)}
            className="h-9 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-700 px-3 py-0 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 min-w-[180px] cursor-pointer"
          >
            <option value="time">📅 Group by Time</option>
            <option value="pic">👤 Group by PIC (Operator)</option>
            <option value="training">🏫 Group by Training Batch</option>
          </select>
        </div>
      </div>

      {/* History List Output */}
      <div className="flex flex-col gap-8">
        {loading ? (
          <div className="p-16 flex justify-center items-center bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
            <div className="flex flex-col items-center justify-center gap-3">
              <span className="material-symbols-outlined text-4xl text-slate-350 text-slate-450">history</span>
              <p className="text-sm font-semibold text-slate-700">No logs found</p>
              <p className="text-xs text-slate-400">Try adjusting your search criteria or record new operations.</p>
            </div>
          </div>
        ) : (
          groupKeys.map(groupKey => {
            const items = groups[groupKey];
            if (!items || items.length === 0) return null;
            return (
              <div key={groupKey} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
                <div className="px-6 py-4 bg-slate-50/70 border-b border-slate-200 flex justify-between items-center select-none">
                  <span className="text-xs font-bold text-slate-655 uppercase tracking-wider">{groupKey}</span>
                  <span className="text-[10px] bg-slate-200 text-slate-600 font-bold px-2 py-0.5 rounded-full">{items.length} Event(s)</span>
                </div>
                <div className="p-6">
                  <div className="relative before:absolute before:inset-y-0 before:left-3 before:w-px before:bg-slate-100 flex flex-col gap-6">
                    {items.map(item => (
                      <div key={item.id} className="relative pl-8 flex justify-between items-start animate-in fade-in duration-150">
                        <div className={`absolute left-[8px] top-1.5 w-2 h-2 rounded-full ${item.dotColor} ring-4 ring-white`}></div>
                        <div className="flex-grow">
                          <p className="text-sm font-semibold text-slate-800 leading-snug">{item.title}</p>
                          <p className="text-xs text-slate-500 mt-1" dangerouslySetInnerHTML={{ __html: item.desc }}></p>
                          <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">person</span>
                              {item.pic}
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">school</span>
                              {item.trainingName}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0 flex flex-col items-end gap-1.5 ml-4">
                          <span className={`cms-badge ${item.badgeClass} text-[9px] uppercase tracking-wider`}>
                            {item.type.split('_').pop()}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">{formatRelativeTime(item.time)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </DashboardLayout>
  );
}
