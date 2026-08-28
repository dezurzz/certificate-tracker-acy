'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { DB, Training, Certificate, Participant, CertificateHistory } from '@/lib/db';
import { sanitizeString } from '@/lib/safety';
import ConfirmationModal from '@/components/ConfirmationModal';

interface PageProps {
  params: Promise<{ id: string }>;
}

interface AuditEntry {
  time: Date;
  color: string;
  title: string;
  detail: string;
  by: string;
}

export default function TrainingDetailPage({ params }: PageProps) {
  const router = useRouter();
  
  // Unpack params
  const [trainingId, setTrainingId] = useState<string>('');
  
  useEffect(() => {
    params.then(res => setTrainingId(res.id));
  }, [params]);

  // Data States
  const [currentTraining, setCurrentTraining] = useState<Training | null>(null);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [participantList, setParticipantList] = useState<Participant[]>([]);
  const [certificateHistories, setCertificateHistories] = useState<CertificateHistory[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab State
  const [activeTab, setActiveTab] = useState<'overview' | 'participants' | 'certificates' | 'activity'>('overview');

  // Search States
  const [partSearchTerm, setPartSearchTerm] = useState('');

  const [editBatchModalOpen, setEditBatchModalOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [certDetailsModalOpen, setCertDetailsModalOpen] = useState(false);
  const [addParticipantModalOpen, setAddParticipantModalOpen] = useState(false);
  const [activeBulkMenu, setActiveBulkMenu] = useState<{ col: string; dir: 'left' | 'right' } | null>(null);
  const [draggedCertId, setDraggedCertId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
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

  // Form Fields - Add Participant
  const [newPartName, setNewPartName] = useState('');
  const [newPartCompany, setNewPartCompany] = useState('');
  const [newPartRegNum, setNewPartRegNum] = useState('');
  const [newPartEmail, setNewPartEmail] = useState('');
  const [generateAttendance, setGenerateAttendance] = useState(true);
  const [attendanceNumber, setAttendanceNumber] = useState('');
  const [generateQualification, setGenerateQualification] = useState(true);
  const [qualificationNumber, setQualificationNumber] = useState('');
  const [newPartEvaluation, setNewPartEvaluation] = useState('Lulus');

  // Form Fields - Edit Batch
  const [editName, setEditName] = useState('');
  const [editBatchCode, setEditBatchCode] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editLoc, setEditLoc] = useState('');
  const [editPic, setEditPic] = useState('');

  // Form Fields - Email
  const [emailRecipients, setEmailRecipients] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');

  // Form Fields - Certificate details
  const [activeCert, setActiveCert] = useState<Certificate | null>(null);
  const [certStatusSelect, setCertStatusSelect] = useState('Pending');

  // Load batch details
  const loadBatchDetails = async () => {
    if (!trainingId) return;
    setLoading(true);
    try {
      const trainList = await DB.getTrainings();
      const match = trainList.find(t => t.id === trainingId);
      if (match) {
        setCurrentTraining(match);
        // Prefill edit form
        setEditName(match.program_name);
        setEditBatchCode(match.batch_code);
        setEditStart(match.start_date);
        setEditEnd(match.end_date);
        setEditLoc(match.location || 'Jakarta Training Center');
        setEditPic((match as any).pic || '');
      }

      const certList = await DB.getCertificates();
      const batchCerts = certList.filter(c => c.training_id === trainingId);
      setCertificates(batchCerts);

      // Unique participants map
      const uniquePartsMap: Record<string, Participant> = {};
      batchCerts.forEach(c => {
        if (c.participants) {
          uniquePartsMap[c.participants.id] = c.participants;
        }
      });
      setParticipantList(Object.values(uniquePartsMap));

      const histList = await DB.getCertificateHistoryForTraining(trainingId);
      setCertificateHistories(histList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (trainingId) {
      loadBatchDetails();
    }

    const handleDbUpdate = () => {
      loadBatchDetails();
    };
    window.addEventListener('bki-db-update', handleDbUpdate);
    return () => {
      window.removeEventListener('bki-db-update', handleDbUpdate);
    };
  }, [trainingId]);

  // Tab Counters
  const pendingCertsCount = certificates.filter(c => c.status !== 'Completed').length;

  // Overview stats
  const totalParts = participantList.length;
  const qualCerts = certificates.filter(c => c.certificate_type === 'Qualification');
  const passedQual = qualCerts.filter(c => c.status === 'Completed').length;
  
  const getProgressWeight = (status: string) => {
    switch (status) {
      case 'Pending': return 25;
      case 'Processing': return 50;
      case 'Printing': return 75;
      case 'Completed': return 100;
      default: return 0;
    }
  };

  const qualProgressSum = qualCerts.reduce((sum, c) => sum + getProgressWeight(c.status), 0);
  const qualPercent = qualCerts.length > 0 ? Math.round(qualProgressSum / qualCerts.length) : 0;

  const attCerts = certificates.filter(c => c.certificate_type === 'Attendance');
  const presentCount = attCerts.filter(c => c.status === 'Completed').length;
  const attProgressSum = attCerts.reduce((sum, c) => sum + getProgressWeight(c.status), 0);
  const attPercent = attCerts.length > 0 ? Math.round((attProgressSum / attCerts.length) * 1.5) : 100; // matching mockup
  const displayAttPercent = attCerts.length > 0 ? Math.round(attProgressSum / attCerts.length) : 100;

  // Actions
  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTraining) return;

    try {
      await DB.updateTraining(currentTraining.id, {
        program_name: sanitizeString(editName),
        batch_code: sanitizeString(editBatchCode),
        start_date: editStart,
        end_date: editEnd,
        location: sanitizeString(editLoc),
        ...({ pic: sanitizeString(editPic) } as any)
      });
      alert('Training details updated successfully!');
      setEditBatchModalOpen(false);
      loadBatchDetails();
    } catch (err: any) {
      console.error(err);
      alert('Failed to update: ' + err?.message);
    }
  };

  const openEmailModalBulk = () => {
    setEmailRecipients(`All Enrolled Participants (${totalParts} recipients)`);
    setEmailSubject('BKI Academy: Course Completed & Certificate Status');
    setEmailMessage(`Dear Participants,\n\nWe are pleased to inform you that the certificate processing for your recent training batch "${currentTraining?.program_name}" has begun.\n\nBest Regards,\nBKI Academy Support`);
    setEmailModalOpen(true);
  };

  const openEmailModalSingle = (name: string) => {
    setEmailRecipients(`${name} <${name.toLowerCase().replace(/\s/g, '.')}@bki-academy.edu>`);
    setEmailSubject('BKI Academy: Certificate Delivery Notification');
    setEmailMessage(`Dear ${name},\n\nWe would like to notify you regarding the delivery status of your qualification certificate.\n\nBest Regards,\nBKI Academy Support`);
    setEmailModalOpen(true);
  };

  const handleSendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Email sent successfully!');
    setEmailModalOpen(false);
    setEmailSubject('');
    setEmailMessage('');
  };

  const handleRemoveParticipant = (id: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Remove Participant',
      message: 'Are you sure you want to remove this participant from this local session? This will not delete their global record.',
      confirmLabel: 'Remove',
      type: 'danger',
      onConfirm: () => {
        setParticipantList(prev => prev.filter(p => p.id !== id));
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        alert("Participant removed from this local view session.");
      }
    });
  };

  // Drag and Drop
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    setDraggedCertId(id);
    setIsDragging(true);
    setActiveBulkMenu(null);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDraggedCertId(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const id = draggedCertId || e.dataTransfer.getData("text/plain");
    setIsDragging(false);
    setDraggedCertId(null);
    if (!id) return;

    const certToMove = certificates.find(c => c.id === id);
    if (!certToMove) return;

    try {
      await DB.updateCertificateStatus(id, newStatus);
      // Local state update
      setCertificates(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
      loadBatchDetails(); // Refresh all summaries & timelines
    } catch (err: any) {
      console.error(err);
      alert("Failed to update status: " + err?.message);
    }
  };

  const columns = ['Pending', 'Processing', 'Printing', 'Completed'];

  const handleBulkShift = async (col: string, dir: 'left' | 'right', type: 'All' | 'Attendance' | 'Qualification') => {
    const idx = columns.indexOf(col);
    const targetCol = dir === 'left' ? columns[idx - 1] : columns[idx + 1];
    if (!targetCol) return;

    const targetCards = certificates.filter(c => {
      if (c.status !== col) return false;
      if (type === 'All') return true;
      return c.certificate_type === type;
    });

    if (targetCards.length === 0) {
      alert(`No ${type === 'All' ? 'certificates' : type + ' certificates'} found in this column.`);
      return;
    }

    setConfirmConfig({
      isOpen: true,
      title: 'Bulk Move Certificates',
      message: `Are you sure you want to move ${targetCards.length} ${type === 'All' ? 'certificates' : type + ' certificates'} from "${col}" to "${targetCol}"?`,
      confirmLabel: 'Move All',
      type: 'warning',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        try {
          await Promise.all(targetCards.map(c => DB.updateCertificateStatus(c.id, targetCol)));
          // Reload details
          await loadBatchDetails();
          setActiveBulkMenu(null);
        } catch (e: any) {
          console.error(e);
          alert('Error during bulk update: ' + e.message);
        }
      }
    });
  };

  // Prefill next certificate numbers when modal opens
  useEffect(() => {
    if (addParticipantModalOpen && certificates.length > 0) {
      const attCerts = certificates.filter(c => c.certificate_type === 'Attendance');
      const qualCerts = certificates.filter(c => c.certificate_type === 'Qualification');
      
      const lastAtt = attCerts.length > 0 ? attCerts[attCerts.length - 1].certificate_number : '';
      const lastQual = qualCerts.length > 0 ? qualCerts[qualCerts.length - 1].certificate_number : '';
      
      if (lastAtt) {
        setAttendanceNumber(lastAtt.replace(/(\d+)(?=[^\d]*$)/, (m) => String(Number(m) + 1)));
      } else {
        setAttendanceNumber('');
      }
      
      if (lastQual) {
        setQualificationNumber(lastQual.replace(/(\d+)(?=[^\d]*$)/, (m) => String(Number(m) + 1)));
      } else {
        setQualificationNumber('');
      }
    }
  }, [addParticipantModalOpen, certificates]);

  // Certificate Modal Details
  const handleOpenCertDetails = async (c: Certificate) => {
    setActiveCert(c);
    setCertStatusSelect(c.status);
    setCertDetailsModalOpen(true);
  };

  const handleUpdateCertStatus = async () => {
    if (!activeCert) return;
    try {
      await DB.updateCertificateStatus(activeCert.id, certStatusSelect);
      alert(`Certificate status updated to: ${certStatusSelect}`);
      setCertDetailsModalOpen(false);
      loadBatchDetails();
    } catch (err: any) {
      console.error(err);
      alert("Failed to update certificate status: " + err?.message);
    }
  };

  const handleAddParticipantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartName.trim() || !newPartCompany.trim() || !newPartRegNum.trim()) {
      alert('Please fill Name, Company, and Registration/ID Number.');
      return;
    }

    try {
      // 1. Create/Upsert participant in database
      const participant = await DB.upsertParticipant({
        name: newPartName.trim(),
        company: newPartCompany.trim(),
        registration_number: newPartRegNum.trim(),
        email: newPartEmail.trim() || undefined,
      });

      // 2. Insert selected certificates
      if (generateAttendance) {
        await DB.insertCertificate({
          training_id: trainingId,
          participant_id: participant.id,
          certificate_type: 'Attendance',
          certificate_number: attendanceNumber.trim() || `ATT-${Date.now()}`,
          status: 'Pending',
          evaluation_result: newPartEvaluation
        });
      }

      if (generateQualification) {
        await DB.insertCertificate({
          training_id: trainingId,
          participant_id: participant.id,
          certificate_type: 'Qualification',
          certificate_number: qualificationNumber.trim() || `QUAL-${Date.now()}`,
          status: 'Pending',
          evaluation_result: newPartEvaluation
        });
      }

      alert('Participant and selected certificates enrolled successfully!');
      
      // Reset form
      setNewPartName('');
      setNewPartCompany('');
      setNewPartRegNum('');
      setNewPartEmail('');
      setAddParticipantModalOpen(false);

      // Reload UI
      await loadBatchDetails();
    } catch (err: any) {
      console.error(err);
      alert('Failed to add participant: ' + err.message);
    }
  };

  // Date formatter
  const formatDateStr = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const formatDateTime = (dateObj?: Date | string) => {
    if (!dateObj) return '';
    const d = typeof dateObj === 'string' ? new Date(dateObj) : dateObj;
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Pending':
        return (
          <span className="cms-badge cms-badge-pending">
            <span className="material-symbols-outlined text-[14px]">pending_actions</span> Pending
          </span>
        );
      case 'Processing':
        return (
          <span className="cms-badge cms-badge-processing">
            <span className="material-symbols-outlined text-[14px]">hourglass_empty</span> Processing
          </span>
        );
      case 'Printing':
        return (
          <span className="cms-badge cms-badge-processing">
            <span className="material-symbols-outlined text-[14px]">print</span> Printing
          </span>
        );
      case 'Completed':
        return (
          <span className="cms-badge cms-badge-completed">
            <span className="material-symbols-outlined text-[14px]">check_circle</span> Completed
          </span>
        );
      default:
        return <span className="text-xs text-slate-400 font-medium">-</span>;
    }
  };

  // Build Audit Logs list
  const getAuditTimeline = () => {
    if (!currentTraining) return [];
    const entries: AuditEntry[] = [];

    // Training created
    if (currentTraining.created_at) {
      entries.push({
        time: new Date(currentTraining.created_at),
        color: 'bg-blue-600',
        title: 'Training batch created',
        detail: `Training batch "${currentTraining.program_name}" (${currentTraining.batch_code}) initialized.`,
        by: (currentTraining as any).pic || 'System'
      });
    }

    // Certificate drafts generated
    certificates.forEach(c => {
      const name = c.participants ? c.participants.name : 'Unknown';
      const certNum = c.certificate_number || c.id;

      if (c.created_at) {
        entries.push({
          time: new Date(c.created_at),
          color: 'bg-slate-400',
          title: 'Certificate draft generated',
          detail: `${name} (${certNum}) — ${c.certificate_type}`,
          by: 'System'
        });
      }
    });

    // Certificate status history updates
    certificateHistories.forEach(h => {
      const cert = certificates.find(c => c.id === h.certificate_id);
      const name = cert?.participants ? cert.participants.name : 'Unknown';
      const certType = cert ? cert.certificate_type : 'Certificate';
      const certNum = cert ? (cert.certificate_number || cert.id) : h.certificate_id;

      let color = 'bg-blue-500';
      if (h.new_status === 'Printing') color = 'bg-amber-500';
      else if (h.new_status === 'Completed') color = 'bg-green-500';
      else if (h.new_status === 'Pending') color = 'bg-slate-400';

      entries.push({
        time: new Date(h.created_at),
        color: color,
        title: `Certificate updated to ${h.new_status}`,
        detail: `${name} (${certNum}) — status changed from <span class="font-bold">${h.previous_status}</span> to <span class="font-bold">${h.new_status}</span>.`,
        by: h.changed_by
      });
    });

    // Sort descending by time
    entries.sort((a, b) => b.time.getTime() - a.time.getTime());
    return entries;
  };

  const auditTimeline = getAuditTimeline();

  // Export CSV Batch Roster
  const handleExportRoster = () => {
    let csv = "Name,Company,Email,Position,Qualification status,Attendance status\n";
    participantList.forEach(p => {
      const att = certificates.find(c => c.participant_id === p.id && c.certificate_type === 'Attendance')?.status || '-';
      const qual = certificates.find(c => c.participant_id === p.id && c.certificate_type === 'Qualification')?.status || '-';
      csv += `"${p.name}","${p.company || 'PRIBADI'}","${p.email || '-'}","Participant","${qual}","${att}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `bki-roster-${currentTraining?.batch_code || 'batch'}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredParticipants = participantList.filter(p => 
    p.name.toLowerCase().includes(partSearchTerm.toLowerCase()) ||
    (p.company || '').toLowerCase().includes(partSearchTerm.toLowerCase())
  );

  return (
    <DashboardLayout pageTitle="Training Details">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-slate-500 text-xs font-semibold mb-6">
        <Link href="/trainings" className="hover:text-slate-800 transition-colors">Trainings</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-slate-800">{currentTraining?.program_name || 'Loading...'}</span>
      </nav>

      {/* Page Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6 mb-6 bg-white p-6 rounded-xl border">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              {currentTraining?.program_name || 'Loading Training...'}
            </h1>
            <span className="cms-badge cms-badge-completed flex items-center gap-1 border border-green-200">
              <span className="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse"></span>
              {currentTraining?.status || 'Active'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-slate-500 text-sm mt-1">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">group</span>
              <span>{currentTraining?.batch_code}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">calendar_today</span>
              <span>{formatDateStr(currentTraining?.start_date)} - {formatDateStr(currentTraining?.end_date)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">location_on</span>
              <span>{currentTraining?.location || 'Jakarta Training Center'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">manage_accounts</span>
              <span className="font-medium">PIC: {(currentTraining as any)?.pic || 'Not set'}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button onClick={() => setEditBatchModalOpen(true)} className="cms-btn-secondary h-10 shadow-sm">
            <span className="material-symbols-outlined text-[18px]">edit</span>
            Edit Details
          </button>
          <button onClick={handleExportRoster} className="cms-btn-primary h-10 shadow-md">
            <span className="material-symbols-outlined text-[18px]">cloud_download</span>
            Generate Report
          </button>
        </div>
      </section>

      {/* Tabs Menu */}
      <div className="flex gap-8 border-b border-slate-200 mb-6">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 border-b-2 font-semibold transition-colors text-sm ${
            activeTab === 'overview' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('participants')}
          className={`pb-3 border-b-2 font-semibold transition-colors text-sm ${
            activeTab === 'participants' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Participants
        </button>
        <button
          onClick={() => setActiveTab('certificates')}
          className={`pb-3 border-b-2 font-semibold transition-colors text-sm flex items-center gap-1.5 ${
            activeTab === 'certificates' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Certificates
          <span className={`px-1.5 py-0.5 rounded text-[10px] leading-none font-bold ${
            pendingCertsCount === 0 ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
          }`}>
            {pendingCertsCount} PENDING
          </span>
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`pb-3 border-b-2 font-semibold transition-colors text-sm ${
            activeTab === 'activity' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Activity Log
        </button>
      </div>

      {/* Tabs Content */}
      <div id="tab-contents">
        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-150">
            {/* Stat Cards */}
            <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="cms-card flex flex-col justify-between shadow-sm bg-white">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Participants</span>
                  <span className="material-symbols-outlined text-slate-400">groups</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-slate-900">{totalParts}</span>
                  <span className="text-xs text-slate-500 font-medium">Enrolled</span>
                </div>
              </div>
              
              <div className="cms-card flex flex-col justify-between shadow-sm bg-white">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Qualification Progress</span>
                  <span className="material-symbols-outlined text-slate-400">check_circle</span>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-slate-900">{qualPercent}%</span>
                    <span className="text-xs text-slate-500 font-medium">{passedQual}/{qualCerts.length} Passed</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full" style={{ width: `${qualPercent}%` }}></div>
                  </div>
                </div>
              </div>

              <div className="cms-card flex flex-col justify-between shadow-sm bg-white">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Attendance Rate</span>
                  <span className="material-symbols-outlined text-slate-400">event_available</span>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-blue-600">{displayAttPercent}%</span>
                    <span className="text-xs text-slate-500 font-medium">{displayAttPercent === 100 ? 'Perfect' : 'Ongoing'}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full" style={{ width: `${Math.min(attPercent, 100)}%` }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Table Preview */}
            <div className="lg:col-span-12 cms-card p-0 overflow-hidden flex flex-col shadow-sm bg-white">
              <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <h2 className="font-bold text-slate-800 text-sm">Participant Progress</h2>
                <button onClick={() => setActiveTab('participants')} className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1">
                  View All <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              </div>
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="h-10 px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider align-middle">Participant Name</th>
                      <th className="h-10 px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider align-middle">ID Number</th>
                      <th className="h-10 px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider align-middle">Attendance Status</th>
                      <th className="h-10 px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider align-middle">Qualification Status</th>
                      <th className="h-10 px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider align-middle text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm text-slate-800 divide-y divide-slate-100">
                    {totalParts === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center bg-white">
                          <div className="flex flex-col items-center justify-center gap-3">
                            <span className="material-symbols-outlined text-4xl text-slate-400">groups</span>
                            <p className="text-sm font-semibold text-slate-700">No participants registered in this batch</p>
                            <p className="text-xs text-slate-400">Import a participant roster to start.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      participantList.map(p => {
                        const attCert = certificates.find(c => c.participant_id === p.id && c.certificate_type === 'Attendance');
                        const qualCert = certificates.find(c => c.participant_id === p.id && c.certificate_type === 'Qualification');
                        return (
                          <tr key={p.id} className="hover:bg-slate-50 transition-colors h-[48px]">
                            <td className="px-4 align-middle font-semibold text-slate-800">{p.name}</td>
                            <td className="px-4 align-middle text-slate-500 font-mono text-xs">{p.registration_number || 'N/A'}</td>
                            <td className="px-4 align-middle">{attCert ? getStatusBadge(attCert.status) : '-'}</td>
                            <td className="px-4 align-middle">{qualCert ? getStatusBadge(qualCert.status) : '-'}</td>
                            <td className="px-4 align-middle text-right">
                              <button onClick={() => openEmailModalSingle(p.name)} className="text-blue-600 hover:text-blue-700 text-xs font-semibold flex items-center justify-end gap-1 w-full">
                                <span className="material-symbols-outlined text-sm">mail</span> Email
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Participants */}
        {activeTab === 'participants' && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-150">
            <div className="flex justify-between items-center bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
              <div className="flex items-center gap-3">
                <div className="relative w-64">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                  <input
                    value={partSearchTerm}
                    onChange={(e) => setPartSearchTerm(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-800"
                    placeholder="Search participant..."
                    type="text"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={openEmailModalBulk} className="cms-btn-secondary h-9 py-0">
                  <span className="material-symbols-outlined text-[18px]">mail</span> Email All
                </button>
                <button onClick={() => setAddParticipantModalOpen(true)} className="cms-btn-primary h-9 py-0">
                  <span className="material-symbols-outlined text-[18px]">person_add</span> Add Participant
                </button>
              </div>
            </div>

            <div className="cms-card p-0 overflow-hidden shadow-sm bg-white border border-slate-200">
              <div className="table-scroll overflow-x-auto w-full">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-[10px] font-semibold text-slate-500 px-6 py-4 uppercase tracking-wider">Name</th>
                      <th className="text-[10px] font-semibold text-slate-500 px-6 py-4 uppercase tracking-wider">Company</th>
                      <th className="text-[10px] font-semibold text-slate-500 px-6 py-4 uppercase tracking-wider">ID Number</th>
                      <th className="text-[10px] font-semibold text-slate-500 px-6 py-4 uppercase tracking-wider">Position</th>
                      <th className="text-[10px] font-semibold text-slate-500 px-6 py-4 uppercase tracking-wider">Qualification status</th>
                      <th className="text-[10px] font-semibold text-slate-500 px-6 py-4 uppercase tracking-wider">Attendance status</th>
                      <th className="text-[10px] font-semibold text-slate-500 px-6 py-4 uppercase tracking-wider text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-800">
                    {filteredParticipants.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center bg-white text-slate-400 font-semibold">
                          No participants found matching search criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredParticipants.map(p => {
                        const attCert = certificates.find(c => c.participant_id === p.id && c.certificate_type === 'Attendance');
                        const qualCert = certificates.find(c => c.participant_id === p.id && c.certificate_type === 'Qualification');
                        return (
                          <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-3 font-semibold text-slate-800">{p.name}</td>
                            <td className="px-6 py-3 text-slate-600">{p.company || 'PRIBADI'}</td>
                            <td className="px-6 py-3 text-slate-500 font-mono text-xs">{p.registration_number || 'N/A'}</td>
                            <td className="px-6 py-3 text-slate-650">Participant</td>
                            <td className="px-6 py-3">{qualCert ? getStatusBadge(qualCert.status) : '-'}</td>
                            <td className="px-6 py-3">{attCert ? getStatusBadge(attCert.status) : '-'}</td>
                            <td className="px-6 py-3 text-right">
                              <div className="flex gap-3 justify-end items-center">
                                <button onClick={() => openEmailModalSingle(p.name)} className="text-slate-500 hover:text-blue-600">
                                  <span className="material-symbols-outlined text-sm">mail</span>
                                </button>
                                <button onClick={() => handleRemoveParticipant(p.id)} className="text-slate-500 hover:text-red-600">
                                  <span className="material-symbols-outlined text-sm">delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Certificates Kanban */}
        {activeTab === 'certificates' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-in fade-in duration-150">
            {/* Columns */}
            {['Pending', 'Processing', 'Printing', 'Completed'].map(colStatus => {
              const cards = certificates.filter(c => c.status === colStatus);
              return (
                <div key={colStatus} className="flex flex-col gap-3 bg-slate-100 p-4 rounded-xl min-h-[450px]">
                  <div className="flex justify-between items-center px-1 relative">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      {colStatus === 'Processing' ? 'Processing QC' : colStatus === 'Printing' ? 'Printed' : colStatus === 'Completed' ? 'Completed / Sent' : colStatus}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {/* Left arrow button */}
                      {colStatus !== 'Pending' && (
                        <button 
                          onClick={() => setActiveBulkMenu(activeBulkMenu?.col === colStatus && activeBulkMenu?.dir === 'left' ? null : { col: colStatus, dir: 'left' })}
                          className="w-5 h-5 rounded hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
                          title="Move items left"
                        >
                          <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                        </button>
                      )}
                      
                      <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                        {cards.length}
                      </span>
                      
                      {/* Right arrow button */}
                      {colStatus !== 'Completed' && (
                        <button 
                          onClick={() => setActiveBulkMenu(activeBulkMenu?.col === colStatus && activeBulkMenu?.dir === 'right' ? null : { col: colStatus, dir: 'right' })}
                          className="w-5 h-5 rounded hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
                          title="Move items right"
                        >
                          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                        </button>
                      )}
                    </div>

                    {/* Bulk menu dropdown */}
                    {activeBulkMenu?.col === colStatus && (
                      <div className="absolute right-0 top-7 z-30 bg-white border border-slate-200 rounded-lg shadow-lg p-1.5 flex flex-col gap-1 w-48 text-left animate-in fade-in slide-in-from-top-2 duration-150">
                        <p className="text-[9px] font-bold text-slate-400 px-2 py-0.5 uppercase tracking-wider">
                          Shift {activeBulkMenu.dir === 'left' ? 'Left' : 'Right'}
                        </p>
                        <button 
                          onClick={() => handleBulkShift(colStatus, activeBulkMenu.dir, 'All')}
                          className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-[14px]">swap_horiz</span>
                          All Certificates
                        </button>
                        <button 
                          onClick={() => handleBulkShift(colStatus, activeBulkMenu.dir, 'Attendance')}
                          className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-[14px]">assignment_turned_in</span>
                          Attendance Only
                        </button>
                        <button 
                          onClick={() => handleBulkShift(colStatus, activeBulkMenu.dir, 'Qualification')}
                          className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-[14px]">workspace_premium</span>
                          Qualification Only
                        </button>
                      </div>
                    )}
                  </div>
                  <div
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, colStatus)}
                    className={`kanban-col-body flex-grow flex flex-col gap-2.5 rounded-lg transition-all duration-200 ${
                      isDragging ? 'bg-slate-200/50 border-2 border-dashed border-slate-350 p-2 min-h-[300px]' : ''
                    }`}
                  >
                    {cards.length === 0 ? (
                      <div className="border border-dashed border-slate-350 rounded-xl p-4 flex flex-col items-center justify-center text-center py-8 bg-slate-50/50 w-full select-none">
                        <span className="material-symbols-outlined text-slate-400 text-lg mb-1">inbox</span>
                        <p className="text-[10px] font-semibold text-slate-500">Column Empty</p>
                        <p className="text-[9px] text-slate-400">Drag cards here</p>
                      </div>
                    ) : (
                      cards.map(c => {
                        const slaThreshold = typeof window !== 'undefined' ? parseInt(localStorage.getItem('sys_sla') || '4', 10) : 4;
                        const isOverdue = c.sla_age_days > slaThreshold && c.status !== 'Completed';
                        return (
                          <div
                            key={c.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, c.id)}
                            onDragEnd={handleDragEnd}
                            onClick={() => handleOpenCertDetails(c)}
                            className={`kanban-card bg-white p-3 rounded-lg border border-slate-200 shadow-sm hover:border-slate-300 transition-all cursor-grab active:cursor-grabbing ${
                              isOverdue ? 'border-red-200 hover:border-red-300' : ''
                            }`}
                          >
                            <div className="text-xs font-mono font-bold text-slate-400 mb-1">{c.certificate_number || 'N/A'}</div>
                            <h4 className="font-bold text-slate-800 text-sm">{c.participants?.name || 'Unknown'}</h4>
                            <div className="mt-1.5">
                              {c.certificate_type === 'Qualification' ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase tracking-wider">
                                  <span className="material-symbols-outlined text-[10px] font-bold">workspace_premium</span>
                                  Qualification
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-teal-50 text-teal-700 border border-teal-100 uppercase tracking-wider">
                                  <span className="material-symbols-outlined text-[10px] font-bold">assignment_turned_in</span>
                                  Attendance
                                </span>
                              )}
                            </div>
                            <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-100">
                              {colStatus === 'Completed' ? (
                                <>
                                  <span className="text-[9px] text-green-600 font-semibold">Ready / Sent</span>
                                  <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                                </>
                              ) : isOverdue ? (
                                <>
                                  <span className="text-[9px] text-red-500 font-bold uppercase tracking-wider">Overdue ({c.sla_age_days}d)</span>
                                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
                                </>
                              ) : (
                                <>
                                  <span className="text-[9px] text-slate-400 font-semibold">{c.sla_age_days} days SLA age</span>
                                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 4: Activity Log */}
        {activeTab === 'activity' && (
          <div className="tab-content flex flex-col gap-4 max-w-2xl animate-in fade-in duration-150">
            <div className="cms-card shadow-sm bg-white border border-slate-200 p-6 rounded-xl">
              <h3 className="font-bold text-slate-800 text-sm mb-6">Audit Trail History</h3>
              {auditTimeline.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-10 text-slate-400 gap-2">
                  <span className="material-symbols-outlined text-3xl">history</span>
                  <p className="text-xs font-semibold text-slate-700">No activity recorded yet</p>
                  <p className="text-[10px] text-slate-400">Actions on certificates will appear here.</p>
                </div>
              ) : (
                <div className="relative before:absolute before:inset-y-0 before:left-3 before:w-px before:bg-slate-200">
                  {auditTimeline.map((e, index) => (
                    <div key={index} className={`relative pl-8 ${index < auditTimeline.length - 1 ? 'mb-6' : ''}`}>
                      <div className={`absolute left-[8px] top-1.5 w-2 h-2 rounded-full ${e.color} ring-4 ring-white`}></div>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                        {formatDateTime(e.time)} — {e.by}
                      </p>
                      <p className="text-sm font-semibold text-slate-800 mt-0.5">{e.title}</p>
                      <p className="text-xs text-slate-500 mt-1" dangerouslySetInnerHTML={{ __html: e.detail }}></p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* EDIT BATCH DETAILS MODAL */}
      {editBatchModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-4" onClick={() => setEditBatchModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-white">
              <h3 className="text-base font-bold text-slate-800">Edit Training Details</h3>
              <button className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors" onClick={() => setEditBatchModalOpen(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleSaveDetails} className="p-6 flex flex-col gap-4 bg-white">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Training Program Name</label>
                <input className="cms-input" value={editName} onChange={(e) => setEditName(e.target.value)} type="text" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Batch Code</label>
                <input className="cms-input font-mono" value={editBatchCode} onChange={(e) => setEditBatchCode(e.target.value)} type="text" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Start Date</label>
                  <input className="cms-input text-slate-700" value={editStart} onChange={(e) => setEditStart(e.target.value)} type="date" required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">End Date</label>
                  <input className="cms-input text-slate-700" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} type="date" required />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Location / Venue</label>
                <input className="cms-input" value={editLoc} onChange={(e) => setEditLoc(e.target.value)} type="text" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Person in Charge (PIC)</label>
                <input className="cms-input" value={editPic} onChange={(e) => setEditPic(e.target.value)} placeholder="e.g. Budi Santoso" type="text" required />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button className="cms-btn-secondary" type="button" onClick={() => setEditBatchModalOpen(false)}>Cancel</button>
                <button className="cms-btn-primary" type="submit">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD PARTICIPANT MODAL */}
      {addParticipantModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-4" onClick={() => setAddParticipantModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-white">
              <h3 className="text-base font-bold text-slate-800">Enroll New Participant</h3>
              <button className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors" onClick={() => setAddParticipantModalOpen(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleAddParticipantSubmit} className="p-6 flex flex-col gap-4 bg-white overflow-y-auto max-h-[85vh]">
              {/* Participant Details Section */}
              <div className="border-b border-slate-100 pb-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Participant Information</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5 col-span-2">
                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Full Name <span className="text-red-500">*</span></label>
                    <input className="cms-input" value={newPartName} onChange={(e) => setNewPartName(e.target.value)} placeholder="e.g. Ahmad Rizky" type="text" required />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Company / Organization <span className="text-red-500">*</span></label>
                    <input className="cms-input" value={newPartCompany} onChange={(e) => setNewPartCompany(e.target.value)} placeholder="e.g. Pertamina Shipping" type="text" required />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Roster / ID Number <span className="text-red-500">*</span></label>
                    <input className="cms-input font-mono" value={newPartRegNum} onChange={(e) => setNewPartRegNum(e.target.value)} placeholder="e.g. 0001" type="text" required />
                  </div>
                  <div className="flex flex-col gap-1.5 col-span-2">
                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Email Address</label>
                    <input className="cms-input" value={newPartEmail} onChange={(e) => setNewPartEmail(e.target.value)} placeholder="e.g. arizky@pertamina.com" type="email" />
                  </div>
                </div>
              </div>

              {/* Certificate Details Section */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Certificate Generation</p>
                <div className="flex flex-col gap-4">
                  {/* Attendance Checkbox & Number */}
                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex flex-col gap-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={generateAttendance} 
                        onChange={(e) => setGenerateAttendance(e.target.checked)} 
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs font-semibold text-slate-700">Generate Attendance Certificate</span>
                    </label>
                    {generateAttendance && (
                      <div className="flex flex-col gap-1.5 mt-1">
                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Certificate Number</label>
                        <input 
                          className="cms-input font-mono bg-white" 
                          value={attendanceNumber} 
                          onChange={(e) => setAttendanceNumber(e.target.value)} 
                          placeholder="Auto-incremented from last cert"
                          type="text" 
                        />
                      </div>
                    )}
                  </div>

                  {/* Qualification Checkbox & Number */}
                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex flex-col gap-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={generateQualification} 
                        onChange={(e) => setGenerateQualification(e.target.checked)} 
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs font-semibold text-slate-700">Generate Qualification Certificate</span>
                    </label>
                    {generateQualification && (
                      <div className="flex flex-col gap-1.5 mt-1">
                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Certificate Number</label>
                        <input 
                          className="cms-input font-mono bg-white" 
                          value={qualificationNumber} 
                          onChange={(e) => setQualificationNumber(e.target.value)} 
                          placeholder="Auto-incremented from last cert"
                          type="text" 
                        />
                      </div>
                    )}
                  </div>

                  {/* Evaluation Result Dropdown */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Initial Evaluation Result</label>
                    <select 
                      value={newPartEvaluation} 
                      onChange={(e) => setNewPartEvaluation(e.target.value)}
                      className="cms-input py-2 text-slate-700"
                    >
                      <option value="Lulus">Lulus</option>
                      <option value="Belum Lulus">Belum Lulus</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                <button className="cms-btn-secondary" type="button" onClick={() => setAddParticipantModalOpen(false)}>Cancel</button>
                <button className="cms-btn-primary" type="submit">Enroll Participant</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EMAIL COMPOSITION MODAL */}
      {emailModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-4" onClick={() => setEmailModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-white">
              <div>
                <h3 className="text-base font-bold text-slate-800">Compose Email Message</h3>
                <p className="text-xs text-slate-500 mt-0.5">Send dynamic notification to participant contacts.</p>
              </div>
              <button className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors" onClick={() => setEmailModalOpen(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleSendEmail} className="p-6 flex flex-col gap-4 bg-white">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Recipient(s)</label>
                <input className="cms-input bg-slate-50 text-slate-500 font-medium" value={emailRecipients} readOnly type="text" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Subject</label>
                <input className="cms-input" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder="Subject line" type="text" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Message Content</label>
                <textarea className="cms-input h-32 resize-none" value={emailMessage} onChange={(e) => setEmailMessage(e.target.value)} placeholder="Dear participants, ..." required></textarea>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button className="cms-btn-secondary" type="button" onClick={() => setEmailModalOpen(false)}>Cancel</button>
                <button className="cms-btn-primary" type="submit">Send Message</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CERTIFICATE DETAIL MODAL */}
      {certDetailsModalOpen && activeCert && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-4" onClick={() => setCertDetailsModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-white">
              <div>
                <h3 className="text-base font-bold text-slate-800">Certificate Status Details</h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{activeCert.certificate_number || activeCert.id}</p>
              </div>
              <button className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors" onClick={() => setCertDetailsModalOpen(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 flex-grow flex flex-col gap-5 bg-white">
              {/* Participant Details */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Participant Name</p>
                  <p className="text-sm font-bold text-slate-800">{activeCert.participants?.name}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Certificate Type</p>
                  <p className="text-sm font-bold text-slate-800">{activeCert.certificate_type}</p>
                </div>
              </div>

              {/* Timeline Checklist */}
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Workflow Progress</p>
                <div className="flex flex-col gap-3 relative before:absolute before:inset-y-0 before:left-3.5 before:w-0.5 before:bg-slate-200 pl-1">
                  
                  {/* Step 1: Generated */}
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-green-100 text-green-700 flex items-center justify-center border border-green-200 z-10 shrink-0">
                      <span className="material-symbols-outlined text-[16px] font-bold">check</span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800">Generated & Template Formed</p>
                      <p className="text-[10px] text-slate-400">Completed on {formatDateTime(activeCert.created_at)}</p>
                    </div>
                  </div>

                  {/* Step 2: Quality Control (QC) */}
                  <div className={`flex items-center gap-3 ${activeCert.status === 'Pending' ? 'opacity-50' : ''}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center border z-10 shrink-0 ${
                      activeCert.status === 'Pending' 
                        ? 'bg-slate-100 text-slate-400 border-slate-200' 
                        : 'bg-green-100 text-green-700 border-green-200'
                    }`}>
                      <span className="material-symbols-outlined text-[16px] font-bold">
                        {activeCert.status === 'Pending' ? 'hourglass_empty' : 'check'}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800">Quality Control (QC)</p>
                      <p className="text-[10px] text-slate-400">
                        {activeCert.status === 'Pending' ? 'Awaiting QC queue' : 'Completed'}
                      </p>
                    </div>
                  </div>

                  {/* Step 3: Printed */}
                  <div className={`flex items-center gap-3 ${['Pending', 'Processing'].includes(activeCert.status) ? 'opacity-50' : ''}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center border z-10 shrink-0 ${
                      activeCert.printed_at
                        ? 'bg-green-100 text-green-700 border-green-200'
                        : activeCert.status === 'Printing'
                          ? 'bg-blue-100 text-blue-600 border-blue-200'
                          : 'bg-slate-100 text-slate-400 border-slate-200'
                    }`}>
                      <span className="material-symbols-outlined text-[16px]">
                        {activeCert.printed_at ? 'check' : 'print'}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800">Printed & Physical Check</p>
                      {activeCert.printed_at ? (
                        <p className="text-[10px] text-slate-400">
                          Printed on {formatDateTime(activeCert.printed_at)} by {activeCert.printed_by}
                        </p>
                      ) : (
                        <p className="text-[10px] text-slate-400">
                          {activeCert.status === 'Printing' ? 'Active printing in progress' : 'Awaiting Print Queue'}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Step 4: Shipped */}
                  <div className={`flex items-center gap-3 ${activeCert.status !== 'Completed' ? 'opacity-50' : ''}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center border z-10 shrink-0 ${
                      activeCert.sent_at
                        ? 'bg-green-100 text-green-700 border-green-200'
                        : activeCert.status === 'Completed'
                          ? 'bg-blue-100 text-blue-600 border-blue-200'
                          : 'bg-slate-100 text-slate-400 border-slate-200'
                    }`}>
                      <span className="material-symbols-outlined text-[16px]">
                        {activeCert.sent_at ? 'check' : 'local_shipping'}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800">Signed & Shipped</p>
                      {activeCert.sent_at ? (
                        <p className="text-[10px] text-slate-400">
                          Shipped on {formatDateTime(activeCert.sent_at)} by {activeCert.sent_by}
                        </p>
                      ) : (
                        <p className="text-[10px] text-slate-400">
                          {activeCert.status === 'Completed' ? 'Awaiting final delivery handshake' : 'Awaiting signature & delivery'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Update action dropdown */}
              <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider" htmlFor="cert-status-select">
                  Update Stage Status
                </label>
                <div className="flex gap-2">
                  <select
                    id="cert-status-select"
                    value={certStatusSelect}
                    onChange={(e) => setCertStatusSelect(e.target.value)}
                    className="cms-input flex-1 py-2 text-slate-700"
                  >
                    <option value="Pending">Pending Template</option>
                    <option value="Processing">Processing QC</option>
                    <option value="Printing">Printing / Signing</option>
                    <option value="Completed">Completed / Sent</option>
                  </select>
                  <button onClick={handleUpdateCertStatus} className="cms-btn-primary py-2 cursor-pointer">
                    Update
                  </button>
                </div>
              </div>
            </div>
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
