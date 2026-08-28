'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { DB, Training, Certificate, CertificateHistory } from '@/lib/db';
import { useAuth } from '@/context/AuthContext';

interface ActivityItem {
  type: string;
  title: string;
  desc: string;
  time: Date;
  dotColor: string;
  badgeHtml: React.ReactNode;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [greeting, setGreeting] = useState('Good Morning');
  const [todayDate, setTodayDate] = useState('');
  
  // KPI Stats
  const [completedTrainings, setCompletedTrainings] = useState(0);
  const [pendingCerts, setPendingCerts] = useState(0);
  const [overdueCerts, setOverdueCerts] = useState(0);
  const [completionRate, setCompletionRate] = useState(100);

  // Pipeline Stats
  const [pipePending, setPipePending] = useState(0);
  const [pipeProcessing, setPipeProcessing] = useState(0);
  const [pipePrinting, setPipePrinting] = useState(0);
  const [pipeShipping, setPipeShipping] = useState(0);
  const [pipeCompleted, setPipeCompleted] = useState(0);
  
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  // New States for Enrichment
  const [monthlyRecords, setMonthlyRecords] = useState<{ name: string; count: number }[]>([]);
  const [activeBatches, setActiveBatches] = useState<(Training & { totalCerts: number; completedCount: number; percentage: number })[]>([]);
  const [overdueList, setOverdueList] = useState<Certificate[]>([]);

  async function loadData() {
    try {
      const trainList = await DB.getTrainings();
      const certList = await DB.getCertificates();
      
      setTrainings(trainList);
      setCertificates(certList);

      // Retrieve SLA Threshold dynamically
      const slaThreshold = typeof window !== 'undefined' ? parseInt(localStorage.getItem('sys_sla') || '4', 10) : 4;

      // Calculate KPIs
      const compTrain = trainList.filter(t => t.status === 'Completed').length;
      const pendCert = certList.filter(c => c.status === 'Pending').length;
      const overCert = certList.filter(c => c.status !== 'Completed' && c.sla_age_days > slaThreshold).length;
      const totalCert = certList.length;
      const compCert = certList.filter(c => c.status === 'Completed').length;
      const rate = totalCert > 0 ? Math.round((compCert / totalCert) * 100) : 100;

      setCompletedTrainings(compTrain);
      setPendingCerts(pendCert);
      setOverdueCerts(overCert);
      setCompletionRate(rate);

      // Calculate Pipeline stages
      const pPend = certList.filter(c => c.status === 'Pending').length;
      const pProc = certList.filter(c => c.status === 'Processing').length;
      const pPrint = certList.filter(c => c.status === 'Printing').length;
      const pShip = certList.filter(c => c.status === 'Shipping').length;
      const pComp = compCert;

      setPipePending(pPend);
      setPipeProcessing(pProc);
      setPipePrinting(pPrint);
      setPipeShipping(pShip);
      setPipeCompleted(pComp);

      // Monthly Completed Certificates (rolling 4 months)
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
      const records = last4Months.map((m, idx) => ({
        name: m.name,
        count: monthCounts[idx]
      }));
      setMonthlyRecords(records);

      // Active trainings progress
      const activeTrainingsList = trainList.filter(t => t.status !== 'Completed').slice(0, 5);
      const getProgressWeight = (status: string) => {
        switch (status) {
          case 'Pending': return 25;
          case 'Processing': return 50;
          case 'Printing': return 75;
          case 'Completed': return 100;
          default: return 0;
        }
      };
      const activeBatchesWithProgress = activeTrainingsList.map(t => {
        const tCerts = certList.filter(c => c.training_id === t.id);
        const totalCerts = tCerts.length;
        const completedCount = tCerts.filter(c => c.status === 'Completed').length;
        const progressSum = tCerts.reduce((sum, c) => sum + getProgressWeight(c.status), 0);
        const percentage = totalCerts > 0 ? Math.round(progressSum / totalCerts) : 0;
        return {
          ...t,
          totalCerts,
          completedCount,
          percentage
        };
      });
      setActiveBatches(activeBatchesWithProgress);

      // Actionable Overdue List
      const overdues = certList
        .filter(c => c.status !== 'Completed' && c.sla_age_days > slaThreshold)
        .sort((a, b) => b.sla_age_days - a.sla_age_days)
        .slice(0, 5);
      setOverdueList(overdues);

      const histories = await DB.getCertificateHistory();

      // Construct Activities
      const acts: ActivityItem[] = [];

      // Trainings creation events
      trainList.forEach(t => {
        acts.push({
          type: 'training',
          title: 'New batch created',
          desc: `${t.program_name} (${t.batch_code})`,
          time: t.created_at ? new Date(t.created_at) : new Date(t.start_date),
          dotColor: 'bg-blue-600',
          badgeHtml: <span className="cms-badge bg-blue-50 text-blue-700 border border-blue-100">Created</span>
        });
      });

      // Certificate drafts generated events
      certList.forEach(c => {
        const name = c.participants ? c.participants.name : 'Unknown';
        if (c.created_at) {
          acts.push({
            type: 'certificate_created',
            title: 'Certificate generated',
            desc: `${name} - ${c.certificate_type}`,
            time: new Date(c.created_at),
            dotColor: 'bg-slate-300',
            badgeHtml: <span className="cms-badge bg-slate-50 text-slate-500 border border-slate-100">Draft</span>
          });
        }
      });

      // Certificate status history updates
      histories.forEach(h => {
        const cert = certList.find(c => c.id === h.certificate_id);
        const name = cert?.participants ? cert.participants.name : 'Unknown';
        const certType = cert ? cert.certificate_type : 'Certificate';

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
          type: 'certificate_updated',
          title: `Certificate ${h.new_status.toLowerCase()}`,
          desc: `${name} (${certType}) status updated to ${h.new_status} by ${h.changed_by}`,
          time: new Date(h.created_at),
          dotColor: dotColor,
          badgeHtml: <span className={`cms-badge ${badgeClass}`}>{h.new_status}</span>
        });
      });

      // Sort descending by time
      acts.sort((a, b) => b.time.getTime() - a.time.getTime());
      setActivities(acts.slice(0, 4));

    } catch (err) {
      console.error('Failed to load dashboard statistics:', err);
    }
  }

  useEffect(() => {
    // Set greeting based on client time
    const hours = new Date().getHours();
    if (hours >= 12 && hours < 17) {
      setGreeting('Good Afternoon');
    } else if (hours >= 17) {
      setGreeting('Good Evening');
    } else {
      setGreeting('Good Morning');
    }

    // Set today's date formatted
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
    setTodayDate(new Date().toLocaleDateString('en-US', options));

    loadData();

    const handleDbUpdate = () => {
      loadData();
    };
    window.addEventListener('bki-db-update', handleDbUpdate);
    return () => {
      window.removeEventListener('bki-db-update', handleDbUpdate);
    };
  }, []);

  const downloadDashboardReport = () => {
    const csvContent = "Metric,Value\n" +
      `Training Completed,${completedTrainings}\n` +
      `Certificate Pending,${pendingCerts}\n` +
      `Overdue,${overdueCerts}\n` +
      `Completion Rate,${completionRate}%\n`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "bki-dashboard-report.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

    return dateInput.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const totalCerts = certificates.length;

  return (
    <DashboardLayout pageTitle="CMS Dashboard">
      {/* Page Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight mb-1">
            {greeting}, {user?.name || 'Admin'}
          </h2>
          <p className="text-sm text-slate-500 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">calendar_today</span>
            <span>{todayDate}</span>
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={downloadDashboardReport} className="cms-btn-secondary">
            <span className="material-symbols-outlined text-sm">download</span>
            Export Report
          </button>
          <Link href="/trainings?openModal=true" className="cms-btn-primary">
            <span className="material-symbols-outlined text-sm">add</span>
            New Batch
          </Link>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* KPI 1: Training Completed */}
        <Link href="/trainings" className="cms-card cms-card-interactive hover:border-slate-350 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                <span className="material-symbols-outlined">task_alt</span>
              </div>
              <span className="bg-green-50 text-green-700 border border-green-200 text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider font-bold">
                +12% Month
              </span>
            </div>
            <div>
              <h3 className="text-3xl font-bold text-slate-900 mb-1">{completedTrainings}</h3>
              <p className="text-sm text-slate-500 font-semibold">Training Completed</p>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-3 uppercase tracking-wide font-medium">Total batches finished</p>
        </Link>

        {/* KPI 2: Certificate Pending */}
        <Link href="/certificates?filter=pending" className="cms-card cms-card-interactive hover:border-slate-350 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                <span className="material-symbols-outlined">hourglass_empty</span>
              </div>
              <span className="cms-badge cms-badge-processing">Pending</span>
            </div>
            <div>
              <h3 className="text-3xl font-bold text-slate-900 mb-1">{pendingCerts}</h3>
              <p className="text-sm text-slate-500 font-semibold">Certificate Pending</p>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-3 uppercase tracking-wide font-medium">Requires verification queue</p>
        </Link>

        {/* KPI 3: Overdue */}
        <Link href="/certificates?filter=overdue" className="cms-card cms-card-interactive hover:border-slate-350 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                <span className="material-symbols-outlined">warning</span>
              </div>
              <span className="cms-badge cms-badge-overdue">Overdue</span>
            </div>
            <div>
              <h3 className="text-3xl font-bold text-slate-900 mb-1">{overdueCerts}</h3>
              <p className="text-sm text-slate-500 font-semibold">Overdue</p>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-3 uppercase tracking-wide font-medium">Exceeds standard SLA limits</p>
        </Link>

        {/* KPI 4: Completion Rate */}
        <div className="cms-card flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                <span className="material-symbols-outlined">query_stats</span>
              </div>
              <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider font-bold">
                Overall
              </span>
            </div>
            <div>
              <h3 className="text-3xl font-bold text-slate-900 mb-1">{completionRate}%</h3>
              <p className="text-sm text-slate-500 font-semibold">Completion Rate</p>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-3 uppercase tracking-wide font-medium">Delivered vs total tasks</p>
        </div>
      </div>

      {/* Main Grid: Pipeline and Output Trend Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Left Column: Certificate Pipeline */}
        <div className="cms-card lg:col-span-2 flex flex-col bg-white">
          <div className="flex justify-between items-center pb-4 border-b border-slate-200 mb-6 bg-white">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Certificate Process Pipeline</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Real-time load balancing tracker across process milestones.</p>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Milestones Overview</span>
          </div>

          <div className="flex flex-col gap-6 flex-grow justify-between">
            {/* Grid display of pipeline stages */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {/* Pending */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between min-h-[105px]">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-mono font-semibold text-slate-400">01</span>
                  <span className="material-symbols-outlined text-slate-400 text-sm">hourglass_empty</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800 mb-0.5">{pipePending}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Pending</p>
                </div>
              </div>

              {/* Processing */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between min-h-[105px]">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-mono font-semibold text-slate-400">02</span>
                  <span className="material-symbols-outlined text-blue-500 text-sm font-light">progress_activity</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800 mb-0.5">{pipeProcessing}</p>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Processing</p>
                </div>
              </div>

              {/* Printing */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between min-h-[105px]">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-mono font-semibold text-slate-500">03</span>
                  <span className="material-symbols-outlined text-blue-400 text-sm">print</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800 mb-0.5">{pipePrinting}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Printing</p>
                </div>
              </div>

              {/* Shipping */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between min-h-[105px]">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-mono font-semibold text-slate-400">04</span>
                  <span className="material-symbols-outlined text-amber-500 text-sm font-light">local_shipping</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800 mb-0.5">{pipeShipping}</p>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Shipping</p>
                </div>
              </div>

              {/* Completed */}
              <div className="bg-green-50 border border-green-200 p-4 rounded-xl flex flex-col justify-between min-h-[105px]">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-mono font-semibold text-green-700">05</span>
                  <span className="material-symbols-outlined text-green-700 text-sm fill">done_all</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-900 mb-0.5">{pipeCompleted}</p>
                  <p className="text-[9px] font-bold text-green-700 uppercase tracking-wider">Completed</p>
                </div>
              </div>
            </div>

            {/* Progress Bar visualization */}
            <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-slate-100 mt-4">
              {totalCerts > 0 ? (
                <>
                  <div className="bg-slate-300 h-full" style={{ width: `${(pipePending / totalCerts) * 100}%` }} title={`Pending: ${pipePending}`}></div>
                  <div className="bg-blue-300 h-full" style={{ width: `${(pipeProcessing / totalCerts) * 100}%` }} title={`Processing: ${pipeProcessing}`}></div>
                  <div className="bg-slate-900 h-full" style={{ width: `${(pipePrinting / totalCerts) * 100}%` }} title={`Printing: ${pipePrinting}`}></div>
                  <div className="bg-amber-400 h-full" style={{ width: `${(pipeShipping / totalCerts) * 100}%` }} title={`Shipping: ${pipeShipping}`}></div>
                  <div className="bg-green-500 h-full" style={{ width: `${(pipeCompleted / totalCerts) * 100}%` }} title={`Completed: ${pipeCompleted}`}></div>
                </>
              ) : (
                <div className="bg-green-500 h-full w-full" title="No active certificates"></div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Monthly Output Trend Bar Chart */}
        <div className="cms-card flex flex-col gap-4 shadow-sm bg-white min-h-[220px]">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Monthly Output Trend</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Certificates completed per month.</p>
            </div>
            <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-wider font-semibold">4 Months Rollup</span>
          </div>
          
          <div className="flex-grow flex items-end justify-between px-6 pt-6 pb-2 h-full relative">
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
              const ht = val > 0 ? Math.max(12, Math.round((val / maxVal) * 90)) : 4;
              
              return (
                <div key={idx} className="flex flex-col items-center gap-1.5 z-10 w-[36px]">
                  <span className={`text-[9px] font-bold ${isLast ? 'text-blue-700' : 'text-slate-700'}`}>
                    {val}
                  </span>
                  <div
                    style={{ height: `${ht}px` }}
                    className={`w-full transition-all duration-300 rounded-t cursor-pointer ${
                      val > 0
                        ? isLast
                          ? 'bg-blue-600 shadow-md shadow-blue-500/20'
                          : 'bg-slate-800 hover:bg-slate-900'
                        : 'bg-slate-200 cursor-not-allowed'
                    }`}
                  ></div>
                  <span className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">{m.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Row 2 Grid: Actionable Overdue, Active Batches, and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Row 2 Left & Center (lg:col-span-2): Active Batches and Overdue Lists */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Active Batches Progress Tracker */}
          <div className="cms-card flex flex-col bg-white h-[350px]">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 mb-4 bg-white">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Active Batches Progress</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">Certificates completion rates for active training batches.</p>
              </div>
              <span className="text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold">In Progress</span>
            </div>
            
            <div className="overflow-y-auto flex-grow table-scroll pr-1">
              {activeBatches.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-12 text-slate-400 gap-2 h-full">
                  <span className="material-symbols-outlined text-3xl text-slate-400">inbox</span>
                  <p className="text-xs font-semibold text-slate-700">No active batches</p>
                  <p className="text-[9px] text-slate-400">All training batches are currently completed.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {activeBatches.map((b) => {
                    const isDone = b.percentage === 100;
                    return (
                      <div key={b.id} className="flex flex-col gap-2">
                        <div className="flex justify-between items-center text-left">
                          <div className="min-w-0 flex-grow pr-2">
                            <Link href={`/trainings/${b.id}`} className="text-xs font-bold text-slate-800 hover:text-blue-600 hover:underline truncate block">
                              {b.program_name} ({b.batch_code})
                            </Link>
                            <p className="text-[9px] text-slate-400 font-semibold mt-0.5">
                              Method: {b.learning_method} | PIC: {b.pic || 'Not Set'}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <span className={`text-xs font-bold ${isDone ? 'text-green-600' : 'text-slate-700'}`}>{b.percentage}%</span>
                            <p className="text-[9px] text-slate-400 font-semibold">{b.completedCount}/{b.totalCerts}</p>
                          </div>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${isDone ? 'bg-green-500' : 'bg-blue-600'}`}
                            style={{ width: `${b.percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Actionable Overdue List */}
          <div className="cms-card flex flex-col bg-white h-[350px]">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 mb-4 bg-white">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Actionable Overdue List</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">Certificates breaching standard SLA thresholds.</p>
              </div>
              <span className="text-[9px] font-bold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold">Immediate Action</span>
            </div>

            <div className="overflow-y-auto flex-grow table-scroll pr-1">
              {overdueList.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-12 text-slate-400 gap-2 h-full">
                  <span className="material-symbols-outlined text-3xl text-green-500">verified</span>
                  <p className="text-xs font-semibold text-slate-700">All caught up!</p>
                  <p className="text-[9px] text-slate-400">No overdue certificates in queue.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {overdueList.map((c) => {
                    const name = c.participants?.name || 'Unknown';
                    const program = `${c.trainings?.program_name} ${c.trainings?.batch_code}`;
                    return (
                      <div key={c.id} className="flex justify-between items-center p-3 rounded-lg border border-red-100 bg-red-50/10 hover:bg-red-50/20 transition-all gap-3">
                        <div className="text-left min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-800 truncate">{name}</p>
                          <p className="text-[10px] text-slate-500 truncate mt-0.5">{program}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[9px] font-bold text-red-600 bg-red-50 border border-red-100 px-1.5 py-0.2 rounded uppercase">
                              {c.sla_age_days}d overdue
                            </span>
                            <span className="text-[9px] text-slate-400 font-semibold">{c.certificate_type}</span>
                          </div>
                        </div>
                        <div className="shrink-0">
                          <select
                            value={c.status}
                            onChange={async (e) => {
                              const nextStatus = e.target.value;
                              try {
                                await DB.updateCertificateStatus(c.id, nextStatus);
                                loadData();
                              } catch (err) {
                                console.error('Failed to update certificate status:', err);
                              }
                            }}
                            className="text-[10px] font-bold bg-white border border-slate-200 rounded px-1.5 py-1 text-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          >
                            <option value="Pending">Pending</option>
                            <option value="Processing">Processing</option>
                            <option value="Printing">Printing</option>
                            <option value="Shipping">Shipping</option>
                            <option value="Completed">Completed</option>
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 2 Right Column: Recent Activity */}
        <div className="cms-card flex flex-col h-[350px] p-0 overflow-hidden bg-white">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center sticky top-0 z-10">
            <h3 className="font-bold text-slate-800 text-sm">Recent Activity</h3>
            <Link className="text-xs font-semibold text-blue-600 hover:underline" href="/history-logs">View All</Link>
          </div>

          <div className="overflow-y-auto p-4 flex-grow table-scroll bg-white">
            {activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-12 text-slate-400 gap-2 h-full">
                <span className="material-symbols-outlined text-3xl">history</span>
                <p className="text-xs font-semibold text-slate-700">No recent activity</p>
                <p className="text-[10px] text-slate-400">Actions will be logged here</p>
              </div>
            ) : (
              <div className="relative before:absolute before:inset-y-0 before:left-3 before:w-px before:bg-slate-200">
                {activities.map((act, index) => (
                  <div key={index} className="relative pl-8 mb-6 animate-in fade-in slide-in-from-bottom-1 duration-150">
                    <div className={`absolute left-[8px] top-1.5 w-2 h-2 rounded-full ${act.dotColor} ring-4 ring-white`}></div>
                    <p className="text-sm text-slate-700">
                      {act.title}: <span dangerouslySetInnerHTML={{ __html: act.desc }}></span>
                    </p>
                    <div className="mt-1.5">{act.badgeHtml}</div>
                    <span className="text-[10px] text-slate-400 block mt-2 font-semibold uppercase tracking-wider">
                      {formatRelativeTime(act.time)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
