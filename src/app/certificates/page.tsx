'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { DB, Certificate } from '@/lib/db';
import ConfirmationModal from '@/components/ConfirmationModal';

function CertificatesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Data states
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [trainFilter, setTrainFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  
  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
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

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await DB.getCertificates();
      setCertificates(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Sync URL search parameters
  useEffect(() => {
    const filterVal = searchParams.get('filter');
    if (filterVal === 'pending') {
      setStateFilter('Pending');
    } else if (filterVal === 'overdue') {
      // Set to all states except Completed, and handle overdue filter logic
      setStateFilter('Overdue');
    }
  }, [searchParams]);

  useEffect(() => {
    const handleOutsideClick = () => setActiveMenuId(null);
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // Bulk Actions
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredCerts.map(c => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(i => i !== id));
    }
  };

  const handleDeleteCert = (id: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Delete Certificate',
      message: 'Are you sure you want to delete this certificate from this local view session?',
      confirmLabel: 'Delete',
      type: 'danger',
      onConfirm: () => {
        setCertificates(prev => prev.filter(c => c.id !== id));
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        alert('Certificate deleted from this local view session.');
      }
    });
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setTrainFilter('');
    setTypeFilter('');
    setStateFilter('');
  };

  // Export report
  const handleExport = () => {
    let csv = "Participant,Training,Type,Status,Age,PIC\n";
    filteredCerts.forEach(c => {
      const pic = c.trainings?.pic || '-';
      csv += `"${c.participants?.name}","${c.trainings?.program_name} ${c.trainings?.batch_code}","${c.certificate_type}","${c.status}",${c.sla_age_days},"${pic}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "bki-certificates-report.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter calculation
  const slaThreshold = typeof window !== 'undefined' ? parseInt(localStorage.getItem('sys_sla') || '4', 10) : 4;

  const filteredCerts = certificates.filter(c => {
    const pName = c.participants?.name || '';
    const tName = c.trainings?.program_name || '';
    const tBatch = c.trainings?.batch_code || '';
    const text = `${pName} ${tName} ${tBatch}`.toLowerCase();
    
    const matchesSearch = text.includes(searchTerm.toLowerCase());
    const matchesTrain = !trainFilter || tName.toLowerCase().includes(trainFilter.toLowerCase());
    const matchesType = !typeFilter || c.certificate_type === typeFilter;
    
    let matchesState = true;
    if (stateFilter === 'Overdue') {
      matchesState = c.status !== 'Completed' && c.sla_age_days > slaThreshold;
    } else if (stateFilter) {
      matchesState = c.status === stateFilter;
    }

    return matchesSearch && matchesTrain && matchesType && matchesState;
  });

  // Extract unique training codes for dropdown
  const uniqueTrainings = Array.from(new Set(certificates.map(c => c.trainings?.program_name.split(' ')[0] || '')));

  return (
    <DashboardLayout pageTitle="Certificate Monitoring">
      {/* Page Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Certificate Tracking</h2>
          <p className="text-sm text-slate-500 mt-1">Monitor the lifecycle and status of all issued certificates.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleExport} className="cms-btn-secondary">
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export
          </button>
          <button onClick={() => router.push('/trainings?openModal=true')} className="cms-btn-primary">
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Batch
          </button>
        </div>
      </div>

      {/* Filters with Search Integrated */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 flex gap-4 items-center flex-wrap shadow-sm">
        <div className="flex items-center gap-2 text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
          <span className="material-symbols-outlined text-[18px]">filter_list</span>
          Filters:
        </div>
        
        {/* Search bar inside table filter section */}
        <div className="relative w-full md:w-60">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 transition-all text-slate-800"
            placeholder="Search certificates..."
            type="text"
          />
        </div>

        <select
          value={trainFilter}
          onChange={(e) => setTrainFilter(e.target.value)}
          className="h-9 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-700 px-3 py-1.5 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 cursor-pointer min-w-[140px]"
        >
          <option value="">All Trainings</option>
          {uniqueTrainings.map(t => t && <option key={t} value={t}>{t}</option>)}
        </select>
        
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-9 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-700 px-3 py-1.5 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 cursor-pointer min-w-[140px]"
        >
          <option value="">All Types</option>
          <option value="Qualification">Qualification</option>
          <option value="Attendance">Attendance</option>
        </select>

        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="h-9 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-700 px-3 py-1.5 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 cursor-pointer min-w-[140px]"
        >
          <option value="">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Processing">Processing</option>
          <option value="Printing">Printing</option>
          <option value="Completed">Completed</option>
          <option value="Overdue">Overdue</option>
        </select>

        <button onClick={handleClearFilters} className="ml-auto text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline">
          Clear Filters
        </button>
      </div>

      {/* Data Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm mb-8">
        {loading ? (
          <div className="p-16 flex justify-center items-center">
            <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <div className="table-scroll overflow-x-auto w-full">
            <table className="w-full text-left border-collapse bg-white">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="p-4 w-12 text-center">
                    <input
                      checked={filteredCerts.length > 0 && selectedIds.length === filteredCerts.length}
                      onChange={handleSelectAll}
                      className="rounded border-slate-350 text-blue-600 focus:ring-blue-500 border-slate-200 cursor-pointer"
                      type="checkbox"
                    />
                  </th>
                  <th className="p-4">Participant</th>
                  <th className="p-4">Training</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Age (Days)</th>
                  <th className="p-4">PIC</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredCerts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400 text-sm font-semibold">
                      No certificates found.
                    </td>
                  </tr>
                ) : (
                  filteredCerts.map(c => {
                    const isOverdue = c.sla_age_days > slaThreshold && c.status !== 'Completed';
                    const initials = (c.trainings?.pic || 'AD').substring(0, 2).toUpperCase();

                    return (
                      <tr key={c.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="p-4 text-center">
                          <input
                            checked={selectedIds.includes(c.id)}
                            onChange={(e) => handleSelectRow(c.id, e.target.checked)}
                            className="row-checkbox rounded border-slate-350 text-blue-600 focus:ring-blue-500 border-slate-200 cursor-pointer"
                            type="checkbox"
                          />
                        </td>
                        <td className="p-4 font-semibold text-slate-900">{c.participants?.name}</td>
                        <td className="p-4 text-slate-650 font-medium">{c.trainings?.program_name} {c.trainings?.batch_code}</td>
                        <td className="p-4">
                          {c.certificate_type === 'Qualification' ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase tracking-wider select-none">
                              <span className="material-symbols-outlined text-[10px] font-bold">workspace_premium</span>
                              Qualification
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-teal-50 text-teal-700 border border-teal-100 uppercase tracking-wider select-none">
                              <span className="material-symbols-outlined text-[10px] font-bold">assignment_turned_in</span>
                              Attendance
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          {c.status === 'Completed' ? (
                            <span className="cms-badge cms-badge-completed">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse"></span>
                              Completed
                            </span>
                          ) : c.status === 'Printing' ? (
                            <span className="cms-badge cms-badge-processing">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>
                              Printing
                            </span>
                          ) : c.status === 'Processing' ? (
                            <span className="cms-badge cms-badge-processing">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5"></span>
                              Processing QC
                            </span>
                          ) : (
                            <span className="cms-badge cms-badge-pending">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5"></span>
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          {isOverdue ? (
                            <div className="flex items-center gap-2">
                              <span className="text-red-655 font-bold">{c.sla_age_days} days</span>
                              <span className="material-symbols-outlined text-red-500 text-base" title="Overdue">warning</span>
                            </div>
                          ) : (
                            <span className="text-slate-500 font-medium">{c.sla_age_days} days</span>
                          )}
                        </td>
                        <td className="p-4 text-slate-650 font-medium flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-600 shrink-0">
                            {initials}
                          </div>
                          <span>{c.trainings?.pic || '-'}</span>
                        </td>
                        <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="relative inline-block text-left">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(activeMenuId === c.id ? null : c.id);
                              }}
                              className="row-actions-btn text-slate-400 hover:text-slate-700 p-1.5 rounded transition-colors focus:outline-none"
                            >
                              <span className="material-symbols-outlined text-[18px]">more_vert</span>
                            </button>
                            {activeMenuId === c.id && (
                              <div className="absolute right-0 mt-1 w-36 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-30 text-left">
                                <button
                                  onClick={() => router.push(`/trainings/${c.training_id}`)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                                >
                                  <span className="material-symbols-outlined text-sm">visibility</span> View Batch
                                </button>
                                <button
                                  onClick={() => alert(`Email PIC for ${c.participants?.name} is sent.`)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                                >
                                  <span className="material-symbols-outlined text-sm">mail</span> Email PIC
                                </button>
                                <hr className="border-slate-100 my-1" />
                                <button
                                  onClick={() => handleDeleteCert(c.id)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50"
                                >
                                  <span className="material-symbols-outlined text-sm">delete</span> Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <ConfirmationModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmLabel={confirmConfig.confirmLabel}
        type={confirmConfig.type}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </DashboardLayout>
  );
}

export default function CertificatesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    }>
      <CertificatesContent />
    </Suspense>
  );
}
