'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { DB, Lead, TrainingProgram } from '@/lib/db';

interface ProgramMetric {
  name: string;
  code: string;
  totalLeads: number;
  activeOpportunities: number;
  estimatedSeats: number;
  waitingListSeats: number;
  registeredSeats: number;
  completedSeats: number;
}

export default function CrmReportsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allLeads, allPrograms] = await Promise.all([
        DB.getLeads(),
        DB.getTrainingPrograms()
      ]);
      setLeads(allLeads);
      setPrograms(allPrograms);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('bki-db-update', handleUpdate);
    return () => window.removeEventListener('bki-db-update', handleUpdate);
  }, []);

  // Compute metrics per training program
  const programMap: Record<string, ProgramMetric> = {};

  programs.forEach(p => {
    programMap[p.name] = {
      name: p.name,
      code: p.code,
      totalLeads: 0,
      activeOpportunities: 0,
      estimatedSeats: 0,
      waitingListSeats: 0,
      registeredSeats: 0,
      completedSeats: 0
    };
  });

  leads.forEach(l => {
    if (!programMap[l.program_name]) {
      programMap[l.program_name] = {
        name: l.program_name,
        code: 'GENERAL',
        totalLeads: 0,
        activeOpportunities: 0,
        estimatedSeats: 0,
        waitingListSeats: 0,
        registeredSeats: 0,
        completedSeats: 0
      };
    }

    const m = programMap[l.program_name];
    m.totalLeads += 1;
    m.estimatedSeats += (l.estimated_seats || 1);

    if (l.status !== 'Selesai Training' && l.status !== 'Batal') {
      m.activeOpportunities += 1;
    }
    if (l.status === 'Waiting List') {
      m.waitingListSeats += (l.estimated_seats || 1);
    }
    if (l.status === 'Terdaftar') {
      m.registeredSeats += (l.confirmed_seats || l.estimated_seats || 1);
    }
    if (l.status === 'Selesai Training') {
      m.completedSeats += (l.confirmed_seats || l.estimated_seats || 1);
    }
  });

  const programMetrics = Object.values(programMap).sort((a, b) => b.estimatedSeats - a.estimatedSeats);

  // Overall totals
  const totalLeads = leads.length;
  const activeLeads = leads.filter(l => l.status !== 'Selesai Training' && l.status !== 'Batal').length;
  const totalEstSeats = leads.reduce((acc, l) => acc + (l.estimated_seats || 1), 0);
  const totalWaitingSeats = leads.filter(l => l.status === 'Waiting List').reduce((acc, l) => acc + (l.estimated_seats || 1), 0);
  const totalRegisteredSeats = leads.filter(l => l.status === 'Terdaftar').reduce((acc, l) => acc + (l.confirmed_seats || l.estimated_seats || 1), 0);

  // Source breakdown
  const sourceCounts: Record<string, number> = {};
  leads.forEach(l => {
    sourceCounts[l.source] = (sourceCounts[l.source] || 0) + 1;
  });

  // PIC workload
  const picCounts: Record<string, { total: number; registered: number }> = {};
  leads.forEach(l => {
    const pic = l.pic_staff_name || 'System';
    if (!picCounts[pic]) picCounts[pic] = { total: 0, registered: 0 };
    picCounts[pic].total += 1;
    if (l.status === 'Terdaftar' || l.status === 'Selesai Training') {
      picCounts[pic].registered += 1;
    }
  });

  return (
    <DashboardLayout pageTitle="Rekap Peminat & Laporan Leads CRM">
      <div className="space-y-6">
        {/* Banner */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600 text-2xl">trending_up</span>
              Rekap Peminat & Analitik Pipeline Training
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Visualisasi jumlah permintaan kursi pelatihan, antrean waiting list, dan distribusi sumber prospek BKI Academy.
            </p>
          </div>
        </div>

        {/* Top KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Peluang Tercatat</span>
            <p className="text-2xl font-bold text-slate-900 mt-1">{totalLeads}</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider">Peluang Aktif</span>
            <p className="text-2xl font-bold text-blue-700 mt-1">{activeLeads}</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <span className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider">Total Permintaan Kursi</span>
            <p className="text-2xl font-bold text-indigo-700 mt-1">{totalEstSeats} <span className="text-xs font-normal text-slate-500">Pax</span></p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider">Antrean Waiting List</span>
            <p className="text-2xl font-bold text-amber-700 mt-1">{totalWaitingSeats} <span className="text-xs font-normal text-slate-500">Pax</span></p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">Terkonfirmasi Terdaftar</span>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{totalRegisteredSeats} <span className="text-xs font-normal text-slate-500">Pax</span></p>
          </div>
        </div>

        {/* Table: Demand & Interest Breakdown per Training Program */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Peringkat Minat Pelatihan (Course Demand Ranking)</h3>
              <p className="text-[11px] text-slate-500">Urutan program berdasarkan total estimasi kursi dan antrean waiting list.</p>
            </div>
          </div>

          <div className="overflow-x-auto table-scroll">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Program Pelatihan</th>
                  <th className="py-3 px-4 text-center">Kode</th>
                  <th className="py-3 px-4 text-center">Total Lead</th>
                  <th className="py-3 px-4 text-center">Peluang Aktif</th>
                  <th className="py-3 px-4 text-center">Total Estimasi Kursi</th>
                  <th className="py-3 px-4 text-center">Waiting List (Backlog)</th>
                  <th className="py-3 px-4 text-center">Pasti Terdaftar</th>
                  <th className="py-3 px-4 text-center">Tingkat Minat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">Memuat rekap minat...</td>
                  </tr>
                ) : (
                  programMetrics.map(p => {
                    const demandLevel = p.estimatedSeats >= 5 ? 'Tinggi' : p.estimatedSeats >= 2 ? 'Sedang' : 'Rendah';
                    const badgeClass = p.estimatedSeats >= 5 ? 'bg-red-50 text-red-700 border-red-200' : p.estimatedSeats >= 2 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-600 border-slate-200';

                    return (
                      <tr key={p.name} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900">{p.name}</td>
                        <td className="py-3 px-4 text-center font-mono text-[11px] text-slate-500">{p.code}</td>
                        <td className="py-3 px-4 text-center font-semibold text-slate-700">{p.totalLeads}</td>
                        <td className="py-3 px-4 text-center font-semibold text-blue-700">{p.activeOpportunities}</td>
                        <td className="py-3 px-4 text-center font-bold text-indigo-700 text-sm">{p.estimatedSeats} Pax</td>
                        <td className="py-3 px-4 text-center font-bold text-amber-700">{p.waitingListSeats} Pax</td>
                        <td className="py-3 px-4 text-center font-bold text-emerald-700">{p.registeredSeats} Pax</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeClass}`}>
                            {demandLevel}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Secondary Widgets: Sources & PIC Performance */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Source Breakdown */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600 text-lg">call</span>
              Distribusi Kanal Sumber Leads
            </h3>
            <div className="space-y-2 pt-1 text-xs">
              {Object.entries(sourceCounts).map(([src, count]) => {
                const percent = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0;
                return (
                  <div key={src} className="space-y-1">
                    <div className="flex justify-between items-center text-slate-700">
                      <span className="font-medium">{src}</span>
                      <span className="font-bold">{count} Lead ({percent}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div className="bg-emerald-600 h-2 rounded-full" style={{ width: `${percent}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* PIC Staf Distribution */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600 text-lg">badge</span>
              Beban Kerja & Konversi per Staf PIC
            </h3>
            <div className="space-y-2.5 pt-1 text-xs">
              {Object.entries(picCounts).map(([picName, data]) => {
                const convRate = data.total > 0 ? Math.round((data.registered / data.total) * 100) : 0;
                return (
                  <div key={picName} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-slate-900">{picName}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Menangani: <b>{data.total} Peluang</b>
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        {data.registered} Terdaftar ({convRate}%)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
