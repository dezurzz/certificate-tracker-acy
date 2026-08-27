'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { DB, Training, Certificate } from '@/lib/db';

interface PicMetric {
  name: string;
  batches: number;
  avgAge: number;
  overdueRate: number;
  complianceRate: number;
  complianceClass: string;
  overdueClass: string;
}

interface MonthlyRecord {
  name: string;
  count: number;
}

export default function ReportsPage() {
  const router = useRouter();
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePeriod, setActivePeriod] = useState('Last 30 Days');
  const [periodDropdownOpen, setPeriodDropdownOpen] = useState(false);

  // Computed states
  const [picMetrics, setPicMetrics] = useState<PicMetric[]>([]);
  const [monthlyRecords, setMonthlyRecords] = useState<MonthlyRecord[]>([]);
  
  // Delay Reason States
  const [pctAssessor, setPctAssessor] = useState(0);
  const [pctMismatch, setPctMismatch] = useState(0);
  const [pctPrinting, setPctPrinting] = useState(0);
  const [totalOverdue, setTotalOverdue] = useState(0);

  const loadData = async () => {
    setLoading(true);
    try {
      const trainList = await DB.getTrainings();
      const certList = await DB.getCertificates();
      const slaThreshold = typeof window !== 'undefined' ? parseInt(localStorage.getItem('sys_sla') || '4', 10) : 4;
      
      setTrainings(trainList);
      setCertificates(certList);

      // 1. Calculate PIC SLA Metrics
      const pics: Record<string, { name: string; batches: number; certs: Certificate[] }> = {};
      trainList.forEach(t => {
        const pic = (t as any).pic || 'Not set';
        if (!pics[pic]) {
          pics[pic] = { name: pic, batches: 0, certs: [] };
        }
        pics[pic].batches++;
      });

      certList.forEach(c => {
        if (c.trainings) {
          const pic = (c.trainings as any).pic || 'Not set';
          if (pics[pic]) {
            pics[pic].certs.push(c);
          }
        }
      });

      const metrics: PicMetric[] = Object.values(pics).map(p => {
        const total = p.certs.length;
        const compliant = p.certs.filter(c => c.sla_age_days <= slaThreshold).length;
        const overdue = p.certs.filter(c => c.status !== 'Completed' && c.sla_age_days > slaThreshold).length;
        
        const complianceRate = total > 0 ? Math.round((compliant / total) * 100) : 100;
        const overdueRate = total > 0 ? Math.round((overdue / total) * 100) : 0;
        
        let avgAge = 0;
        if (total > 0) {
          const sum = p.certs.reduce((acc, c) => acc + (c.sla_age_days || 0), 0);
          avgAge = Math.round((sum / total) * 10) / 10;
        }

        return {
          name: p.name,
          batches: p.batches,
          avgAge,
          overdueRate,
          complianceRate,
          complianceClass: complianceRate >= 90 ? 'cms-badge-completed' : 'cms-badge-processing',
          overdueClass: overdueRate > 10 ? 'text-amber-500' : 'text-green-600'
        };
      });
      setPicMetrics(metrics);

      // 2. Monthly completed certificates calculation (rolling 4 months)
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const last4Months: { index: number; year: number; name: string }[] = [];
      const today = new Date();
      
      for (let i = 3; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        last4Months.push({
          index: d.getMonth(),
          year: d.getFullYear(),
          name: monthNames[d.getMonth()]
        });
      }

      const monthCounts = [0, 0, 0, 0];
      certList.forEach(c => {
        if (c.status === 'Completed' && c.created_at) {
          const date = new Date(c.created_at);
          const cMonth = date.getMonth();
          const cYear = date.getFullYear();
          
          for (let idx = 0; idx < 4; idx++) {
            if (cMonth === last4Months[idx].index && cYear === last4Months[idx].year) {
              monthCounts[idx]++;
              break;
            }
          }
        }
      });

      const records: MonthlyRecord[] = last4Months.map((m, idx) => ({
        name: m.name,
        count: monthCounts[idx]
      }));
      setMonthlyRecords(records);

      // 3. Delay reasons distribution calculation
      const overdueList = certList.filter(c => c.status !== 'Completed' && c.sla_age_days > slaThreshold);
      setTotalOverdue(overdueList.length);
      if (overdueList.length > 0) {
        const total = overdueList.length;
        const counts = { assessor: 0, mismatch: 0, printing: 0 };
        
        overdueList.forEach(c => {
          if (c.status === 'Pending') counts.assessor++;
          else if (c.status === 'Processing') counts.mismatch++;
          else if (c.status === 'Printing') counts.printing++;
          else counts.assessor++;
        });

        setPctAssessor(Math.round((counts.assessor / total) * 100));
        setPctMismatch(Math.round((counts.mismatch / total) * 100));
        setPctPrinting(Math.round((counts.printing / total) * 100));
      }

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const changePeriod = (label: string) => {
    setActivePeriod(label);
    alert(`Updating operational analytics charts for: ${label} (Mockup)`);
    setPeriodDropdownOpen(false);
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = () => setPeriodDropdownOpen(false);
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  return (
    <DashboardLayout pageTitle="Reports & Analytics">
      {/* Page Header */}
      <section className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">System Analytics</h2>
          <p className="text-sm text-slate-500 mt-1">Operational SLA performance metrics and statistics.</p>
        </div>
        <div className="flex gap-3">
          <div className="relative inline-block text-left">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPeriodDropdownOpen(!periodDropdownOpen);
              }}
              className="cms-btn-secondary flex items-center gap-2 h-10"
            >
              <span className="material-symbols-outlined text-[18px]">calendar_today</span>
              <span>{activePeriod}</span>
              <span className="material-symbols-outlined text-sm">expand_more</span>
            </button>
            {periodDropdownOpen && (
              <div className="absolute right-0 mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-30 text-left">
                {['Last 7 Days', 'Last 30 Days', 'Last 6 Months'].map(label => (
                  <button
                    key={label}
                    onClick={() => changePeriod(label)}
                    className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => window.print()} className="cms-btn-primary h-10 shadow-md shadow-blue-500/10">
            <span className="material-symbols-outlined text-[18px]">print</span>
            Export PDF
          </button>
        </div>
      </section>

      {loading ? (
        <div className="p-16 flex justify-center items-center bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
        </div>
      ) : trainings.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16 bg-white border border-slate-200 rounded-xl gap-4 shadow-sm w-full">
          <span className="material-symbols-outlined text-slate-350 text-6xl text-slate-400">bar_chart</span>
          <div>
            <h3 className="text-lg font-bold text-slate-800">No Reporting Data Available</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Once you import training agendas, enroll participants, and progress certificate stages, compliance and SLA efficiency logs will appear here.
            </p>
          </div>
          <button onClick={() => router.push('/trainings')} className="cms-btn-primary mt-2">
            Go to Training List
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Bar Chart Completed Certificates */}
          <div className="lg:col-span-7 cms-card flex flex-col gap-6 shadow-sm bg-white">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Monthly Completed Certificates</h3>
              <p className="text-xs text-slate-400 mt-0.5">Total count of ready certificates generated per month.</p>
            </div>
            
            {/* Custom SVG Bar Chart */}
            <div className="w-full h-64 bg-slate-50 rounded-xl border border-slate-100 p-4 flex flex-col justify-between">
              <div className="flex-grow flex items-end justify-between px-6 pt-4 h-full relative">
                {/* Grid lines */}
                <div className="absolute inset-x-0 bottom-0 h-px bg-slate-200"></div>
                <div className="absolute inset-x-0 bottom-1/4 h-px border-t border-dashed border-slate-200"></div>
                <div className="absolute inset-x-0 bottom-2/4 h-px border-t border-dashed border-slate-200"></div>
                <div className="absolute inset-x-0 bottom-3/4 h-px border-t border-dashed border-slate-200"></div>

                {monthlyRecords.map((m, idx) => {
                  const maxVal = Math.max(...monthlyRecords.map(r => r.count), 1);
                  const isLast = idx === 3;
                  const val = m.count;
                  
                  // Compute proportional height
                  const ht = val > 0 ? Math.max(20, Math.round((val / maxVal) * 160)) : 6;
                  
                  return (
                    <div key={idx} className="flex flex-col items-center gap-2 z-10 w-[45px]">
                      <span className={`text-[10px] font-bold ${isLast ? 'text-blue-700' : 'text-slate-700'}`}>
                        {val}
                      </span>
                      <div
                        style={{ height: `${ht}px` }}
                        className={`w-full transition-all duration-300 rounded-t cursor-pointer ${
                          val > 0
                            ? isLast
                              ? 'bg-blue-600 shadow-lg shadow-blue-500/20'
                              : 'bg-slate-800 hover:bg-slate-900'
                            : 'bg-slate-200 cursor-not-allowed'
                        }`}
                      ></div>
                    </div>
                  );
                })}
              </div>
              
              {/* Labels */}
              <div className="flex justify-between px-6 pt-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {monthlyRecords.map((m, idx) => (
                  <span key={idx} className="w-[45px] text-center">{m.name}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Delay Reasons progress metrics */}
          <div className="lg:col-span-5 cms-card flex flex-col gap-6 shadow-sm bg-white h-full">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">SLA Delay Reason Distribution</h3>
              <p className="text-xs text-slate-400 mt-0.5">Identified root causes of processing breaches.</p>
            </div>
            <div className="flex flex-col gap-4">
              {totalOverdue === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-10 text-slate-400 gap-2 select-none h-full">
                  <span className="material-symbols-outlined text-3xl">verified</span>
                  <p className="text-xs font-semibold text-slate-700">No SLA breaches recorded</p>
                  <p className="text-[10px] text-slate-400">All certificates are within compliance bounds.</p>
                </div>
              ) : (
                <>
                  {/* Reason 1 */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-xs font-semibold text-slate-700">
                      <span>Waiting for External Assessor Signatures</span>
                      <span>{pctAssessor}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full transition-all duration-300" style={{ width: `${pctAssessor}%` }}></div>
                    </div>
                  </div>
                  {/* Reason 2 */}
                  <div className="flex flex-col gap-1.5 mt-2">
                    <div className="flex justify-between text-xs font-semibold text-slate-700">
                      <span>Verification Data Mismatch Errors</span>
                      <span>{pctMismatch}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-slate-700 rounded-full transition-all duration-300" style={{ width: `${pctMismatch}%` }}></div>
                    </div>
                  </div>
                  {/* Reason 3 */}
                  <div className="flex flex-col gap-1.5 mt-2">
                    <div className="flex justify-between text-xs font-semibold text-slate-700">
                      <span>Printing Hardware Failures / Queue</span>
                      <span>{pctPrinting}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full transition-all duration-300" style={{ width: `${pctPrinting}%` }}></div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Table: PIC Efficiency Metrics */}
          <div className="lg:col-span-12 cms-card p-0 overflow-hidden shadow-sm bg-white border border-slate-200">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-800 text-sm">PIC SLA Completion Efficiency</h3>
              <p className="text-xs text-slate-400 mt-0.5">Tracking individual coordinator response age.</p>
            </div>
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-4">PIC Name</th>
                    <th className="px-6 py-4">Assigned Batches</th>
                    <th className="px-6 py-4">Avg Response (Days)</th>
                    <th className="px-6 py-4">Overdue Rate</th>
                    <th className="px-6 py-4">Target compliance</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-slate-100 text-slate-800">
                  {picMetrics.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center text-slate-400 font-semibold">
                        No PIC logs recorded.
                      </td>
                    </tr>
                  ) : (
                    picMetrics.map((pic, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-3 font-semibold text-slate-900">{pic.name}</td>
                        <td className="px-6 py-3">{pic.batches} batches</td>
                        <td className="px-6 py-3">{pic.avgAge} days</td>
                        <td className={`px-6 py-3 ${pic.overdueClass} font-bold`}>{pic.overdueRate}%</td>
                        <td className="px-6 py-3">
                          <span className={`cms-badge ${pic.complianceClass}`}>{pic.complianceRate}% Compliant</span>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <button
                            onClick={() => alert(`Message drafted to ${pic.name}.`)}
                            className="text-blue-600 hover:text-blue-700 text-xs font-semibold flex items-center justify-end gap-1 w-full"
                          >
                            <span className="material-symbols-outlined text-sm">mail</span> Contact PIC
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
