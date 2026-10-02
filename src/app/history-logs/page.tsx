'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { DB, Training, Certificate } from '@/lib/db';
import Button from '@/components/Button';
import PageHeader from '@/components/PageHeader';
import { useT, useLanguage } from '@/i18n/LanguageContext';
import { formatRelativeTime } from '@/lib/relativeTime';
import { certStatusLabel, certTypeLabel } from '@/i18n/labels';
import { TimelineSkeleton } from '@/components/Skeleton';

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
  const t = useT();
  const { locale } = useLanguage();
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
      trainings.forEach(training => {
        acts.push({
          id: `t-${training.id}`,
          type: 'training_created',
          title: t('Batch Training Dibuat'),
          desc: t('Batch program "{program_name}" ({batch_code}) dimulai.', { program_name: training.program_name, batch_code: training.batch_code }),
          time: training.created_at ? new Date(training.created_at) : (training.start_date ? new Date(training.start_date) : new Date()),
          pic: (t as any).pic || 'System',
          trainingName: `${training.program_name} (${training.batch_code})`,
          dotColor: 'bg-blue-500',
          badgeClass: 'cms-badge-neutral'
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
            title: t('Sertifikat Dibuat'),
            desc: t('Draf sertifikat dibuat untuk "{name}" ({certificate_type}).', { name, certificate_type: certTypeLabel(t, c.certificate_type) }),
            time: new Date(c.created_at),
            pic: c.updated_by || 'System',
            trainingName: trainingName,
            dotColor: 'bg-slate-300',
            badgeClass: 'cms-badge-neutral'
          });
        }
      });

      // Certificate status history updates
      histories.forEach(h => {
        const cert = certificates.find(c => c.id === h.certificate_id);
        const name = cert?.participants ? cert.participants.name : 'Unknown';
        const trainingName = cert?.trainings ? `${cert.trainings.program_name} (${cert.trainings.batch_code})` : 'Unknown Training';

        let dotColor = 'bg-blue-500';
        let badgeClass = 'cms-badge-info';
        if (h.new_status === 'Completed') {
          dotColor = 'bg-emerald-500';
          badgeClass = 'cms-badge-success';
        } else if (h.new_status === 'Pending') {
          dotColor = 'bg-slate-300';
          badgeClass = 'cms-badge-neutral';
        }

        acts.push({
          id: `h-log-${h.id}`,
          type: `certificate_${h.new_status.toLowerCase()}`,
          title: t('Sertifikat diperbarui ke {status}', { status: certStatusLabel(t, h.new_status) }),
          desc: t('Status sertifikat "{name}" bergeser dari {from} ke {to}.', { name, from: certStatusLabel(t, h.previous_status), to: certStatusLabel(t, h.new_status) }),
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

  const formatRelTime = (date: Date) => formatRelativeTime(date, t, locale);

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
      <div className="space-y-6">
      <PageHeader
        title={t('Riwayat Audit')}
        description={t('Lacak semua penyelenggaraan training dan pembaruan status sertifikat.')}
        actions={<Button variant="secondary" icon="download" onClick={handleExportCSV}>{t('Ekspor Jejak Audit')}</Button>}
      />

      {/* Controls & Grouping Filter */}
      <div className="bg-card rounded-xl border border-slate-200 p-3 flex flex-col md:flex-row gap-3 items-center justify-between shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
        <div className="relative w-full md:w-80">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="cms-input h-9 !pl-10 !text-[13px]"
            aria-label={t('Cari log')}
            placeholder={t('Cari log...')}
            type="text"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <label htmlFor="group-by" className="text-[13px] text-slate-500 whitespace-nowrap">{t('Kelompokkan menurut')}</label>
          <select
            value={groupBy}
            id="group-by"
            onChange={(e) => setGroupBy(e.target.value as any)}
            className="cms-select-filter min-w-[180px]"
          >
            <option value="time">{t('Waktu')}</option>
            <option value="pic">{t('PIC (operator)')}</option>
            <option value="training">{t('Batch training')}</option>
          </select>
        </div>
      </div>

      {/* History List Output */}
      <div className="flex flex-col gap-6">
        {loading ? (
          <TimelineSkeleton label={t('Memuat riwayat')} />
        ) : filtered.length === 0 ? (
          <div className="bg-card rounded-xl border border-slate-200 p-12 text-center shadow-sm">
            <div className="flex flex-col items-center justify-center gap-3">
              <span className="material-symbols-outlined text-4xl text-slate-400" aria-hidden="true">history</span>
              <p className="text-sm font-medium text-slate-900">{t('Log tidak ditemukan')}</p>
              <p className="text-xs text-slate-500">{t('Ubah kata kunci pencarian atau catat operasi baru.')}</p>
            </div>
          </div>
        ) : (
          groupKeys.map(groupKey => {
            const items = groups[groupKey];
            if (!items || items.length === 0) return null;
            return (
              <div key={groupKey} className="bg-card rounded-xl border border-slate-200 shadow-[0_1px_2px_rgb(15_23_42/0.04)] overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center">
                  <h2 className="text-sm font-semibold text-slate-900">{groupKey}</h2>
                  <span className="text-xs text-slate-500 tabular-nums">{items.length === 1 ? t('1 event') : t('{count} event', { count: items.length })}</span>
                </div>
                <div className="p-5">
                  <div className="relative before:absolute before:inset-y-0 before:left-3 before:w-px before:bg-slate-100 flex flex-col gap-6">
                    {items.map(item => (
                      <div key={item.id} className="relative pl-8 flex justify-between items-start animate-in fade-in duration-150">
                        <div className={`absolute left-[8px] top-1.5 w-2 h-2 rounded-full ${item.dotColor} ring-4 ring-card`}></div>
                        <div className="flex-grow">
                          <p className="text-sm font-medium text-slate-900 leading-snug">{item.title}</p>
                          <p className="text-xs text-slate-500 mt-1">{item.desc}</p>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px] text-slate-400" aria-hidden="true">person</span>
                              {item.pic}
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px] text-slate-400" aria-hidden="true">school</span>
                              {item.trainingName}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0 flex flex-col items-end gap-1.5 ml-4">
                          <span className={`cms-badge ${item.badgeClass} capitalize`}>
                            {(() => {
                              const k = item.type.split('_').pop() ?? '';
                              return k === 'created' ? t('Dibuat') : certStatusLabel(t, k.charAt(0).toUpperCase() + k.slice(1));
                            })()}
                          </span>
                          <span className="text-xs text-slate-500">{formatRelTime(item.time)}</span>
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
      </div>
    </DashboardLayout>
  );
}
