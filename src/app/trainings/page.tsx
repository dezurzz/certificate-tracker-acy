'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { DB, Training, Certificate } from '@/lib/db';
import { normalizeAgendaCSV, CSVBatch } from '@/lib/csv';
import { trainingSchema, sanitizeString } from '@/lib/safety';
import ConfirmationModal from '@/components/ConfirmationModal';

function TrainingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Data State
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [spinnerMsg, setSpinnerMsg] = useState('');

  // Filtering States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [picFilter, setPicFilter] = useState('');
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [deptFilter, setDeptFilter] = useState('');
  const [locFilter, setLocFilter] = useState('');
  const [slaFilter, setSlaFilter] = useState('');

  // Selection States (Bulk Actions)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Modal States
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingTraining, setEditingTraining] = useState<Training | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [parsedBatches, setParsedBatches] = useState<CSVBatch[]>([]);
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

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formBatch, setFormBatch] = useState('');
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');
  const [formPic, setFormPic] = useState('');

  // Dropdown states per row (action menus)
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Load Data
  const loadData = async () => {
    setLoading(true);
    try {
      const trainList = await DB.getTrainings();
      const certList = await DB.getCertificates();
      setTrainings(trainList);
      setCertificates(certList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Check query params to open modal
    if (searchParams.get('openModal') === 'true') {
      openAddModal();
    }
  }, [searchParams]);

  // Click outside to close menus
  useEffect(() => {
    const handleOutsideClick = () => setActiveMenuId(null);
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // Time ago helper
  const getTimeAgo = (dateStr?: string) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  };

  // CRUD actions
  const openAddModal = () => {
    setEditingTraining(null);
    setFormName('');
    setFormBatch('');
    setFormStart('');
    setFormEnd('');
    setFormPic('');
    setFormModalOpen(true);
  };

  const openEditModal = (t: Training) => {
    setEditingTraining(t);
    setFormName(t.program_name);
    setFormBatch(t.batch_code);
    setFormStart(t.start_date);
    setFormEnd(t.end_date);
    // Find PIC from field, handling potential older properties
    const picVal = (t as any).pic || '';
    setFormPic(picVal);
    setFormModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Safety sanitization
    const cleanName = sanitizeString(formName);
    const cleanBatch = sanitizeString(formBatch);
    const cleanPic = sanitizeString(formPic);

    // Validate inputs using safety schemas
    const validation = trainingSchema.safeParse({
      program_name: cleanName,
      batch_code: cleanBatch,
      start_date: formStart,
      end_date: formEnd,
      pic: cleanPic,
      status: editingTraining ? editingTraining.status : 'Processing'
    });

    if (!validation.success) {
      alert(validation.error.issues.map((err: any) => err.message).join('\n'));
      return;
    }

    setSpinnerMsg(editingTraining ? "Saving changes..." : "Creating training...");
    try {
      if (editingTraining) {
        await DB.updateTraining(editingTraining.id, {
          program_name: cleanName,
          batch_code: cleanBatch,
          start_date: formStart,
          end_date: formEnd,
          location: editingTraining.location,
          status: editingTraining.status,
          ...({ pic: cleanPic } as any) // support custom mock fields
        });
        alert('Training batch updated successfully!');
      } else {
        await DB.insertTraining({
          program_name: cleanName,
          batch_code: cleanBatch,
          start_date: formStart,
          end_date: formEnd,
          location: 'Jakarta Training Center',
          status: 'Processing',
          ...({ pic: cleanPic } as any) // support custom mock fields
        });
        alert('New training batch created successfully!');
      }
      setFormModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error(err);
      alert('Action failed: ' + err?.message);
    } finally {
      setSpinnerMsg('');
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Delete Training Batch',
      message: 'Are you sure you want to delete this training batch and all associated certificates? This action is permanent and cannot be undone.',
      confirmLabel: 'Delete',
      type: 'danger',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        setSpinnerMsg("Deleting batch...");
        try {
          await DB.deleteTraining(id);
          alert('Training batch deleted successfully.');
          loadData();
        } catch (err: any) {
          console.error(err);
          alert('Failed to delete training batch: ' + err?.message);
        } finally {
          setSpinnerMsg('');
        }
      }
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    
    setConfirmConfig({
      isOpen: true,
      title: 'Bulk Delete Batches',
      message: `Are you sure you want to delete the ${selectedIds.length} selected training batch(es) and all associated certificates? This action is permanent and cannot be undone.`,
      confirmLabel: 'Delete All',
      type: 'danger',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        setSpinnerMsg(`Deleting ${selectedIds.length} batches...`);
        try {
          for (const id of selectedIds) {
            await DB.deleteTraining(id);
          }
          alert('Selected batches deleted successfully.');
          setSelectedIds([]);
          loadData();
        } catch (err: any) {
          console.error(err);
          alert('Failed to delete selected batches: ' + err?.message);
        } finally {
          setSpinnerMsg('');
        }
      }
    });
  };

  // CSV Import actions
  const handleCSVFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const batches = normalizeAgendaCSV(text);
        if (batches && batches.length > 0) {
          setParsedBatches(batches);
          setImportModalOpen(false);
          setPreviewModalOpen(true);
        } else {
          alert('Could not parse any training records. Please check that headers match the BKI CSV template.');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleSyncCSVToDB = async () => {
    setSpinnerMsg("Syncing to database...");
    try {
      const existingTrainings = await DB.getTrainings();
      
      for (const batch of parsedBatches) {
        // Safe check for duplicates
        let training = existingTrainings.find(t => 
          t.program_name.toLowerCase().trim() === batch.program_name.toLowerCase().trim() && 
          t.batch_code === batch.batch_code
        );

        if (!training) {
          training = await DB.insertTraining({
            program_name: batch.program_name,
            batch_code: batch.batch_code,
            service_type: batch.service_type,
            learning_method: batch.learning_method,
            start_date: batch.start_date,
            end_date: batch.end_date,
            location: batch.location,
            status: 'Completed'
          });
        }

        for (const p of batch.participants) {
          // Upsert participant
          const participant = await DB.upsertParticipant({
            name: p.name,
            company: p.company,
            registration_number: p.registration_number
          });

          // Insert certificates if present in CSV row
          if (p.cert_kehadiran) {
            await DB.insertCertificate({
              training_id: training.id,
              participant_id: participant.id,
              certificate_type: 'Attendance',
              certificate_number: p.cert_kehadiran,
              status: 'Pending',
              evaluation_result: p.evaluasi
            });
          }

          if (p.cert_kualifikasi) {
            await DB.insertCertificate({
              training_id: training.id,
              participant_id: participant.id,
              certificate_type: 'Qualification',
              certificate_number: p.cert_kualifikasi,
              status: 'Pending',
              evaluation_result: p.evaluasi
            });
          }
        }
      }
      
      alert('All batches normalized and synced to database successfully!');
      setPreviewModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error(err);
      alert('Sync failed: ' + err?.message);
    } finally {
      setSpinnerMsg('');
    }
  };

  const downloadCSVTemplate = () => {
    const headers = "No Urut Proyek,Jenis Layanan,Metode Belajar Menghajar,Tanggal Sesuai Jadwal,Pemohon,Obyek/Nama Pelatihan,No Registrasi Peserta,Nama,Perusahaan,No Sertifikat Kehadiran,Hasil Evaluasi,No Sertifikat Kualifikasi\n";
    const row1 = "1,PUBLIC TRAINING,OFFLINE,02-04 FEBRUARI,PRIBADI,INTERNAL AUDITOR ISM CODE 113,0001,ASFUL FIQI FEBRIANTO,PRIBADI,0001-01-S1-ACY/001/A01-L12/PB/2026,Lulus,0001-01-S2-ACY/001/A01-L12/PB/2026\n";
    const row2 = ",,,,,INTERNAL AUDITOR ISM CODE 113,0002,HARDI KADIRAN,PT. PRIMA BUANA GEMA BAHARI,0002-01-S1-ACY/001/A01-L12/PB/2026,Lulus,0002-01-S2-ACY/001/A01-L12/PB/2026\n";
    const row3 = "2,PUBLIC TRAINING,OFFLINE,02-06 FEBRUARI,PRIBADI,MARINE SURVEYOR 92,0008,DAVID REXY PANIRUAN SIMATUPANG,PRIBADI,0008-01-S1-ACY/002/A13-L12/PB/2026,Lulus,0008-01-S2-ACY/002/A13-L12/PB/2026\n";

    const blob = new Blob([headers + row1 + row2 + row3], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "bki-import-template.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle selection checkboxes
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredTrainings.map(t => t.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(item => item !== id));
    }
  };

  // Filter computation
  const filteredTrainings = trainings.filter(t => {
    const matchesSearch = t.program_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.batch_code.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = !statusFilter || t.status === statusFilter;
    const matchesPic = !picFilter || ((t as any).pic || '-').toLowerCase().includes(picFilter.toLowerCase());
    
    let matchesDate = true;
    if (dateFilter) {
      const year = dateFilter.substring(0, 4);
      matchesDate = t.start_date.includes(year) || t.end_date.includes(year);
    }

    return matchesSearch && matchesStatus && matchesPic && matchesDate;
  });

  return (
    <DashboardLayout pageTitle="Training List">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Trainings</h2>
          <p className="text-sm text-slate-500 mt-1">Manage and monitor all training programs.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setImportModalOpen(true)} className="cms-btn-secondary h-10 shadow-sm">
            <span className="material-symbols-outlined text-[18px]">upload_file</span>
            Import Agenda CSV
          </button>
          <button onClick={openAddModal} className="cms-btn-primary h-10 shadow-md shadow-blue-500/10">
            <span className="material-symbols-outlined text-[18px]">add</span>
            Add Training
          </button>
        </div>
      </div>

      {/* Filters & Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col shadow-sm mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between w-full">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Search */}
            <div className="relative w-full md:w-64">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 transition-all text-slate-850"
                placeholder="Search trainings..."
                type="text"
              />
            </div>

            {/* Status */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-700 px-3 py-0 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 min-w-[130px] appearance-none cursor-pointer"
            >
              <option value="">All Status</option>
              <option value="Completed">Completed</option>
              <option value="Processing">Processing</option>
            </select>

            {/* Date */}
            <input
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-700 px-3 py-1.5 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 cursor-pointer"
              type="date"
            />

            {/* PIC */}
            <select
              value={picFilter}
              onChange={(e) => setPicFilter(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-700 px-3 py-0 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 min-w-[130px] appearance-none cursor-pointer"
            >
              <option value="">All PICs</option>
              <option value="Andi">Andi</option>
              <option value="Budi">Budi</option>
              <option value="System Admin">System Admin</option>
            </select>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <button onClick={() => setShowMoreFilters(!showMoreFilters)} className="cms-btn-secondary h-9 py-0">
              <span className="material-symbols-outlined text-[18px]">filter_list</span>
              More Filters
            </button>
          </div>
        </div>

        {/* More Filters secondary row */}
        {showMoreFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100 w-full animate-in fade-in duration-200">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Department</label>
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="cms-input h-9 py-0 cursor-pointer text-slate-700"
              >
                <option value="">All Departments</option>
                <option value="marine">Marine Services</option>
                <option value="industrial">Industrial Academy</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Location</label>
              <select
                value={locFilter}
                onChange={(e) => setLocFilter(e.target.value)}
                className="cms-input h-9 py-0 cursor-pointer text-slate-700"
              >
                <option value="">All Locations</option>
                <option value="jakarta">Jakarta Training Center</option>
                <option value="surabaya">Surabaya Hub</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">SLA Priority</label>
              <select
                value={slaFilter}
                onChange={(e) => setSlaFilter(e.target.value)}
                className="cms-input h-9 py-0 cursor-pointer text-slate-700"
              >
                <option value="">All Priorities</option>
                <option value="normal">Normal (14 Days)</option>
                <option value="urgent">Urgent (7 Days)</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col mb-8">
        {loading ? (
          <div className="p-16 flex justify-center items-center bg-white">
            <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <div className="table-scroll overflow-x-auto w-full">
            <table className="w-full text-left border-collapse bg-white">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-6 py-4 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={filteredTrainings.length > 0 && selectedIds.length === filteredTrainings.length}
                      onChange={handleSelectAll}
                      className="rounded border-slate-250 text-blue-600 focus:ring-blue-500/15 cursor-pointer"
                    />
                  </th>
                  <th className="text-[11px] font-semibold text-slate-500 px-6 py-4 uppercase tracking-wider whitespace-nowrap">Training Name</th>
                  <th className="text-[11px] font-semibold text-slate-500 px-6 py-4 uppercase tracking-wider whitespace-nowrap">Batch</th>
                  <th className="text-[11px] font-semibold text-slate-500 px-6 py-4 uppercase tracking-wider whitespace-nowrap">Date</th>
                  <th className="text-[11px] font-semibold text-slate-500 px-6 py-4 uppercase tracking-wider whitespace-nowrap text-right">Participants</th>
                  <th className="text-[11px] font-semibold text-slate-500 px-6 py-4 uppercase tracking-wider whitespace-nowrap">Certificate Progress</th>
                  <th className="text-[11px] font-semibold text-slate-500 px-6 py-4 uppercase tracking-wider whitespace-nowrap">PIC</th>
                  <th className="text-[11px] font-semibold text-slate-500 px-6 py-4 uppercase tracking-wider whitespace-nowrap text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTrainings.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400 text-sm font-semibold">
                      No training batches found matching filters.
                    </td>
                  </tr>
                ) : (
                  filteredTrainings.map(t => {
                    const initials = ((t as any).pic || 'AD').substring(0, 2).toUpperCase();
                    const start = new Date(t.start_date);
                    const end = new Date(t.end_date);
                    const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
                    const dateText = start.toLocaleDateString('en-GB', { day: '2-digit' }) + '-' + end.toLocaleDateString('en-GB', options);

                    // Filter certificates and compute actual participants & progress
                    const batchCerts = certificates.filter(c => c.training_id === t.id);
                    const uniquePartIds = Array.from(new Set(batchCerts.map(c => c.participant_id)));
                    const participantCount = uniquePartIds.length;

                    // Helper to get progress weight based on status
                    const getProgressWeight = (status: string) => {
                      switch (status) {
                        case 'Pending': return 25;
                        case 'Processing': return 50;
                        case 'Printing': return 75;
                        case 'Completed': return 100;
                        default: return 0;
                      }
                    };

                    // Attendance stats
                    const attCerts = batchCerts.filter(c => c.certificate_type === 'Attendance');
                    const attProgressSum = attCerts.reduce((sum, c) => sum + getProgressWeight(c.status), 0);
                    const attPct = attCerts.length > 0 ? Math.round(attProgressSum / attCerts.length) : 0;

                    // Qualification stats
                    const qualCerts = batchCerts.filter(c => c.certificate_type === 'Qualification');
                    const qualProgressSum = qualCerts.reduce((sum, c) => sum + getProgressWeight(c.status), 0);
                    const qualPct = qualCerts.length > 0 ? Math.round(qualProgressSum / qualCerts.length) : 0;

                    // Last modifier info
                    const sortedCerts = [...batchCerts].filter(c => c.updated_at).sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime());
                    const latestCert = sortedCerts[0];
                    const lastModifier = latestCert ? (latestCert.updated_by || latestCert.printed_by || latestCert.sent_by || null) : null;
                    const lastModTime = latestCert ? latestCert.updated_at : null;

                    return (
                      <tr
                        key={t.id}
                        className="hover:bg-slate-50/70 transition-colors group h-14 cursor-pointer animate-in fade-in duration-200"
                        onClick={() => router.push(`/trainings/${t.id}`)}
                      >
                        <td className="px-6 py-3 w-12 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(t.id)}
                            onChange={(e) => handleSelectRow(t.id, e.target.checked)}
                            className="training-select-checkbox rounded border-slate-200 text-blue-600 focus:ring-blue-500/15 cursor-pointer"
                          />
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap">
                          <div className="text-sm font-semibold text-slate-900">{t.program_name}</div>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap">
                          <div className="text-xs font-mono font-semibold text-slate-500">{t.batch_code}</div>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap">
                          <div className="text-xs text-slate-500">{dateText}</div>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-right">
                          <div className="text-sm text-slate-800 font-semibold">{participantCount}</div>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap">
                          <div className="flex flex-col gap-1 min-w-[130px] select-none">
                            {/* ATT Progress */}
                            <div className="flex items-center justify-between text-[9px] leading-none">
                              <span className="text-slate-500 font-bold uppercase tracking-wider scale-95 origin-left">ATT</span>
                              <span className="font-extrabold text-teal-600">{attPct}%</span>
                            </div>
                            <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-teal-600 rounded-full transition-all duration-300" style={{ width: `${attPct}%` }}></div>
                            </div>
                            
                            {/* QUAL Progress */}
                            <div className="flex items-center justify-between text-[9px] leading-none mt-1">
                              <span className="text-slate-500 font-bold uppercase tracking-wider scale-95 origin-left">QUAL</span>
                              <span className="font-extrabold text-indigo-600">{qualPct}%</span>
                            </div>
                            <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-600 rounded-full transition-all duration-300" style={{ width: `${qualPct}%` }}></div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 shrink-0">
                              {initials}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs text-slate-700 font-semibold truncate">{(t as any).pic || '-'}</span>
                              {lastModifier && lastModTime && (
                                <span className="text-[9px] text-slate-400 leading-none">
                                  by {lastModifier} &middot; {getTimeAgo(lastModTime)}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="relative inline-block text-left">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(activeMenuId === t.id ? null : t.id);
                              }}
                              className="row-actions-btn text-slate-400 hover:text-slate-600 p-1.5 rounded transition-colors focus:outline-none"
                            >
                              <span className="material-symbols-outlined text-[18px]">more_vert</span>
                            </button>
                            {activeMenuId === t.id && (
                              <div className="absolute right-0 mt-1 w-36 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-30 text-left">
                                <button
                                  onClick={() => router.push(`/trainings/${t.id}`)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                                >
                                  <span className="material-symbols-outlined text-sm">visibility</span> View Detail
                                </button>
                                <button
                                  onClick={() => openEditModal(t)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                                >
                                  <span className="material-symbols-outlined text-sm">edit</span> Edit Batch
                                </button>
                                <hr className="border-slate-100 my-1" />
                                <button
                                  onClick={() => handleDelete(t.id)}
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

        {/* Pagination Footer */}
        <div className="border-t border-slate-200 bg-white px-6 py-4 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Showing <span className="font-medium text-slate-800">1</span> to <span className="font-medium text-slate-800">{filteredTrainings.length}</span> of <span className="font-medium text-slate-800">{filteredTrainings.length}</span> results
          </div>
          <div className="flex gap-1">
            <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 disabled:opacity-40" disabled>
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-xs font-semibold">1</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 disabled:opacity-40" disabled>
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* CSV IMPORT MODAL */}
      {importModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-4" onClick={() => setImportModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-white">
              <h3 className="text-base font-bold text-slate-800">Import Agenda CSV</h3>
              <button className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors" onClick={() => setImportModalOpen(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              {/* Drag-n-drop simulated area */}
              <div
                onClick={() => document.getElementById('csv-file-input')?.click()}
                className="border-2 border-dashed border-slate-200 hover:border-blue-500 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors group bg-white"
              >
                <span className="material-symbols-outlined text-4xl text-slate-400 group-hover:text-blue-500 transition-colors mb-2">upload_file</span>
                <p className="text-sm font-semibold text-slate-700">Click to upload Agenda CSV</p>
                <p className="text-xs text-slate-400 mt-1">Accepts BKI formatted CSV (Max 5MB)</p>
                <input
                  type="file"
                  id="csv-file-input"
                  className="hidden"
                  accept=".csv"
                  onChange={handleCSVFileSelect}
                />
              </div>
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 flex gap-2.5 items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400 text-sm">download</span>
                  <span className="text-xs font-semibold text-slate-700">BKI Agenda Template</span>
                </div>
                <button onClick={downloadCSVTemplate} className="text-xs font-bold text-blue-600 hover:underline">Download CSV</button>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              <button className="cms-btn-secondary" onClick={() => setImportModalOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* CSV NORMALIZATION PREVIEW MODAL */}
      {previewModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-white">
              <div>
                <h3 className="text-base font-bold text-slate-800">Review & Normalization Mapping</h3>
                <p className="text-xs text-slate-500 mt-0.5">Please review and edit details before syncing to the database.</p>
              </div>
              <button className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors" onClick={() => setPreviewModalOpen(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="p-6 flex-grow flex flex-col gap-6 overflow-y-auto bg-white">
              {parsedBatches.map((batch, batchIndex) => (
                <div key={batchIndex} className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex flex-col gap-4">
                  <h4 className="font-bold text-slate-850 text-slate-800 text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-600 text-lg">school</span>
                    Training Program Batch Details (#{batchIndex + 1})
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Program Name</label>
                      <input
                        className="cms-input py-1.5 text-xs font-semibold"
                        value={batch.program_name}
                        onChange={(e) => {
                          const updated = [...parsedBatches];
                          updated[batchIndex].program_name = e.target.value;
                          setParsedBatches(updated);
                        }}
                        type="text"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Start Date</label>
                        <input
                          className="cms-input py-1.5 text-xs font-semibold"
                          value={batch.start_date}
                          onChange={(e) => {
                            const updated = [...parsedBatches];
                            updated[batchIndex].start_date = e.target.value;
                            setParsedBatches(updated);
                          }}
                          type="date"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">End Date</label>
                        <input
                          className="cms-input py-1.5 text-xs font-semibold"
                          value={batch.end_date}
                          onChange={(e) => {
                            const updated = [...parsedBatches];
                            updated[batchIndex].end_date = e.target.value;
                            setParsedBatches(updated);
                          }}
                          type="date"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Attendee List & Certificates</label>
                    <div className="overflow-x-auto max-h-48 border border-slate-200 rounded-lg table-scroll">
                      <table className="w-full text-left border-collapse text-xs bg-white">
                        <thead>
                          <tr className="bg-slate-100 border-b border-slate-200">
                            <th className="p-2 font-bold text-slate-600">Name</th>
                            <th className="p-2 font-bold text-slate-600">Company</th>
                            <th className="p-2 font-bold text-slate-600">Cert. Kehadiran</th>
                            <th className="p-2 font-bold text-slate-600">Cert. Kualifikasi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {batch.participants.map((p, pIndex) => (
                            <tr key={pIndex}>
                              <td className="p-2 font-semibold text-slate-900">{p.name}</td>
                              <td className="p-2 text-slate-500">{p.company}</td>
                              <td className="p-2 font-mono text-[10px] text-slate-500">{p.cert_kehadiran || '-'}</td>
                              <td className="p-2 font-mono text-[10px] text-slate-500">{p.cert_kualifikasi || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Detected {parsedBatches.length} Batch(es)</span>
              <div className="flex gap-3">
                <button className="cms-btn-secondary" onClick={() => setPreviewModalOpen(false)}>Cancel</button>
                <button onClick={handleSyncCSVToDB} className="cms-btn-primary">Confirm & Sync to Database</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT FORM MODAL */}
      {formModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-4" onClick={() => setFormModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-full border border-slate-200 animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-white">
              <div>
                <h3 className="text-base font-bold text-slate-800">{editingTraining ? 'Edit Training Batch' : 'Add New Training'}</h3>
                <p className="text-xs text-slate-500 mt-0.5">Enter details to create or modify a training batch.</p>
              </div>
              <button className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors" onClick={() => setFormModalOpen(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="flex-grow flex flex-col overflow-y-auto">
              <div className="p-6 flex-grow flex flex-col gap-4 bg-white">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider" htmlFor="trainingName">TRAINING NAME <span className="text-red-500">*</span></label>
                  <input
                    className="cms-input"
                    id="trainingName"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Advanced Structural Analysis"
                    type="text"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider" htmlFor="batchNumber">BATCH CODE <span className="text-red-500">*</span></label>
                  <input
                    className="cms-input font-mono"
                    id="batchNumber"
                    value={formBatch}
                    onChange={(e) => setFormBatch(e.target.value)}
                    placeholder="e.g. BTH-2024-01"
                    type="text"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider" htmlFor="startDate">START DATE <span className="text-red-500">*</span></label>
                    <input
                      className="cms-input text-slate-700"
                      id="startDate"
                      value={formStart}
                      onChange={(e) => setFormStart(e.target.value)}
                      type="date"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider" htmlFor="endDate">END DATE <span className="text-red-500">*</span></label>
                    <input
                      className="cms-input text-slate-700"
                      id="endDate"
                      value={formEnd}
                      onChange={(e) => setFormEnd(e.target.value)}
                      type="date"
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider" htmlFor="picSelect">PERSON IN CHARGE (PIC) <span className="text-red-500">*</span></label>
                  <input
                    className="cms-input"
                    id="picSelect"
                    value={formPic}
                    onChange={(e) => setFormPic(e.target.value)}
                    placeholder="e.g. Budi Santoso"
                    type="text"
                    required
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 shrink-0">
                <button className="cms-btn-secondary" type="button" onClick={() => setFormModalOpen(false)}>Cancel</button>
                <button className="cms-btn-primary" type="submit">
                  {editingTraining ? 'Save Changes' : 'Create Training'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3.5 rounded-full shadow-2xl flex items-center gap-4 z-50 transform translate-y-0 opacity-100 transition-all duration-300">
          <span className="text-xs font-semibold text-slate-300">{selectedIds.length} batches selected</span>
          <div className="h-4 w-px bg-slate-700"></div>
          <button onClick={handleBulkDelete} className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 font-bold uppercase tracking-wider cursor-pointer">
            <span className="material-symbols-outlined text-sm">delete</span> Delete Selected
          </button>
        </div>
      )}

      {/* Global Spinner Overlay */}
      {spinnerMsg && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] z-50 flex items-center justify-center">
          <div className="bg-white px-6 py-4 rounded-xl shadow-lg border border-slate-200 flex items-center gap-3 animate-in zoom-in-95 duration-150">
            <span className="animate-spin inline-block w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full"></span>
            <span className="text-sm font-semibold text-slate-800">{spinnerMsg}</span>
          </div>
        </div>
      )}

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

export default function TrainingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    }>
      <TrainingsContent />
    </Suspense>
  );
}
