'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { useCan } from '@/context/AuthContext';
import { DB, Training, Certificate, Participant, CertificateHistory } from '@/lib/db';
import { sanitizeString } from '@/lib/safety';
import ConfirmationModal from '@/components/ConfirmationModal';
import Modal from '@/components/Modal';
import Button from '@/components/Button';
import PageHeader from '@/components/PageHeader';
import LoadError from '@/components/LoadError';
import Tabs from '@/components/Tabs';
import { CertStatusBadge, CertTypeBadge } from '@/components/StatusBadge';
import { notify } from '@/lib/notify';
import { useT, useLanguage } from '@/i18n/LanguageContext';
import { certStatusLabel, certTypeLabel } from '@/i18n/labels';
import { useSlaDays } from '@/lib/settings';
import { Skeleton, TableSkeletonRows, KanbanCardsSkeleton, ListRowsSkeleton } from '@/components/Skeleton';
import { getErrorMessage } from '@/lib/errors';
import { useFlip } from '@/lib/useFlip';
import { cmpText } from '@/lib/sort';
import { printFieldsFor } from '@/lib/certStatus';

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
  const t = useT();
  const can = useCan();
  const canWrite = can('data.write');
  const noWriteHint = canWrite ? undefined : t('Peran Anda hanya bisa melihat data');
  const slaThreshold = useSlaDays();
  const { locale } = useLanguage();
  
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
  const [loadError, setLoadError] = useState<string | null>(null);
  // Certificates being moved right now (id -> target status). The card is already drawn in its new column; a reload that
  // lands before the server has saved the move must not pull it back, so loaded rows are overridden with these.
  const pendingMoves = useRef(new Map<string, string>());
  const [syncing, setSyncing] = useState<Set<string>>(() => new Set());
  const hasLoaded = useRef(false);
  const boardRef = useRef<HTMLDivElement>(null);

  // Tab State
  const [activeTab, setActiveTab] = useState<'overview' | 'participants' | 'certificates' | 'activity'>('overview');

  // Search States
  const [partSearchTerm, setPartSearchTerm] = useState('');

  const [editBatchModalOpen, setEditBatchModalOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
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
  const [emailAddresses, setEmailAddresses] = useState<string[]>([]);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');

  // Form Fields - Certificate details
  const [activeCert, setActiveCert] = useState<Certificate | null>(null);
  const [certStatusSelect, setCertStatusSelect] = useState('Pending');

  // Load batch details
  // Only the very first load shows skeletons; every later refresh swaps the data in place so the board never flashes.
  const loadBatchDetails = async () => {
    if (!trainingId) return;
    if (!hasLoaded.current) setLoading(true);
    setLoadError(null);
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
        setEditPic(match.pic || '');
      }

      const certList = await DB.getCertificates();
      const batchCerts = certList
        .filter(c => c.training_id === trainingId)
        .map(c => (pendingMoves.current.has(c.id) ? { ...c, status: pendingMoves.current.get(c.id) as string } : c));
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
      hasLoaded.current = true;
    } catch (e) {
      setLoadError(getErrorMessage(e));
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (trainingId) {
      loadBatchDetails();
    }

    // Several writes in a row (a bulk move, an import) raise several events: reload once, shortly after the last one
    let timer: ReturnType<typeof setTimeout> | undefined;
    const handleDbUpdate = () => {
      clearTimeout(timer);
      timer = setTimeout(() => loadBatchDetails(), 250);
    };
    window.addEventListener('bki-db-update', handleDbUpdate);
    return () => {
      clearTimeout(timer);
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
        pic: sanitizeString(editPic)
      });
      notify.success(t('Detail training diperbarui'));
      setEditBatchModalOpen(false);
      loadBatchDetails();
    } catch (err) {
      console.error(err);
      notify.error(t('Gagal memperbarui'), getErrorMessage(err));
    }
  };

  const openEmailModalBulk = () => {
    const withEmail = participantList.filter(p => p.email);
    if (withEmail.length === 0) {
      notify.warning(t('Belum ada alamat email peserta'), t('Tambahkan email peserta terlebih dahulu.'));
      return;
    }
    const missing = participantList.length - withEmail.length;
    setEmailAddresses(withEmail.map(p => p.email as string));
    setEmailRecipients(
      t('{length} peserta', { length: withEmail.length }) + (missing > 0 ? ` (${missing} without email are skipped)` : '')
    );
    setEmailSubject('BKI Academy: Course Completed & Certificate Status');
    setEmailMessage(t('Yth. Peserta,\n\nKami informasikan bahwa proses sertifikat untuk batch training "{program_name}" yang baru Anda ikuti telah dimulai.\n\nSalam hormat,\nBKI Academy Support', { program_name: currentTraining?.program_name }));
    setEmailModalOpen(true);
  };

  const openEmailModalSingle = (participant: Participant) => {
    if (!participant.email) {
      notify.warning(t('Peserta belum punya alamat email'), participant.name);
      return;
    }
    setEmailAddresses([participant.email]);
    setEmailRecipients(`${participant.name} <${participant.email}>`);
    setEmailSubject('BKI Academy: Certificate Delivery Notification');
    setEmailMessage(t('Yth. {name},\n\nKami ingin menginformasikan status pengiriman sertifikat kualifikasi Anda.\n\nSalam hormat,\nBKI Academy Support', { name: participant.name }));
    setEmailModalOpen(true);
  };

  // Opens the user's mail app with everything filled in (no server-side mail yet).
  // Several recipients go in BCC so participants don't see each other's address.
  const handleSendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams({ subject: emailSubject, body: emailMessage });
    const query = params.toString().replace(/\+/g, '%20');
    const url =
      emailAddresses.length === 1
        ? `mailto:${encodeURIComponent(emailAddresses[0])}?${query}`
        : `mailto:?bcc=${emailAddresses.map(encodeURIComponent).join(',')}&${query}`;
    window.location.href = url;
    notify.success(t('Draf email dibuka di aplikasi email'));
    setEmailModalOpen(false);
    setEmailSubject('');
    setEmailMessage('');
  };

  const handleRemoveParticipant = (id: string) => {
    setConfirmConfig({
      isOpen: true,
      title: t('Hapus Peserta'),
      message: t('Hapus peserta ini beserta sertifikatnya dari batch ini? Data peserta global tetap disimpan.'),
      confirmLabel: t('Keluarkan'),
      type: 'danger',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        try {
          await DB.removeParticipantFromTraining(id, currentTraining?.id || trainingId);
          setParticipantList(prev => prev.filter(p => p.id !== id));
          setCertificates(prev => prev.filter(c => c.participant_id !== id));
          notify.success(t('Peserta dihapus dari batch ini'));
        } catch (err) {
          notify.error(t('Gagal menghapus peserta'), err);
        }
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

  /**
   * Moves certificates to another column. The cards move at once (optimistic) and animate there, a small spinner shows
   * until the server confirmed, and if it refuses the cards go back and an error is shown. Returns whether it saved.
   */
  const moveCertificates = async (ids: string[], target: string): Promise<boolean> => {
    const movable = certificates.filter(c => ids.includes(c.id) && c.status !== target && !pendingMoves.current.has(c.id));
    if (movable.length === 0) return true;
    const before = new Map(movable.map(c => [c.id, c]));
    const moveIds = [...before.keys()];

    moveIds.forEach(id => pendingMoves.current.set(id, target));
    setSyncing(prev => new Set([...prev, ...moveIds]));
    const nowIso = new Date().toISOString();
    setCertificates(prev => prev.map(c => (before.has(c.id) ? { ...c, status: target, updated_at: nowIso, ...printFieldsFor(target, '', nowIso) } as Certificate : c)));

    let saved = false;
    try {
      await DB.updateCertificatesStatus(moveIds, target);
      saved = true;
    } catch (err) {
      console.error(err);
      setCertificates(prev => prev.map(c => before.get(c.id) ?? c));
      notify.error(t('Gagal memperbarui status'), getErrorMessage(err));
      void loadBatchDetails(); // show what the server really has
    } finally {
      moveIds.forEach(id => pendingMoves.current.delete(id));
      setSyncing(prev => {
        const next = new Set(prev);
        moveIds.forEach(id => next.delete(id));
        return next;
      });
      // on success the database layer raised a change event, which refreshes the counters and the activity log once
    }
    return saved;
  };

  const handleDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const id = draggedCertId || e.dataTransfer.getData("text/plain");
    setIsDragging(false);
    setDraggedCertId(null);
    if (!id) return;
    void moveCertificates([id], newStatus);
  };

  const columns = ['Pending', 'Processing', 'Printing', 'Completed'];
  // Cards in a fixed order (participant, then type): a card that moves lands in a predictable slot, and the order does not
  // jump when the server returns rows in a different physical order after an update.
  const sortedCerts = useMemo(
    () => [...certificates].sort((a, b) => cmpText(a.participants?.name, b.participants?.name) || cmpText(a.certificate_type, b.certificate_type)),
    [certificates]
  );
  // changes whenever a card changes column or the order of a column changes: the board animates on exactly that
  const flipKey = useMemo(() => sortedCerts.map(c => `${c.id}:${c.status}`).join('|'), [sortedCerts]);
  useFlip(boardRef, loading ? 'loading' : flipKey);

  const handleBulkShift = async (col: string, dir: 'left' | 'right', type: 'All' | 'Attendance' | 'Qualification') => {
    const idx = columns.indexOf(col);
    const targetCol = dir === 'left' ? columns[idx - 1] : columns[idx + 1];
    if (!targetCol) return;

    const targetCards = certificates.filter(c => {
      if (c.status !== col) return false;
      if (type === 'All') return true;
      return c.certificate_type === type;
    });

    const whatLabel = type === 'All' ? t('sertifikat') : type === 'Attendance' ? t('sertifikat kehadiran') : t('sertifikat kualifikasi');

    if (targetCards.length === 0) {
      notify.info(t('Tidak ada {what} di kolom ini.', { what: whatLabel }));
      return;
    }

    setConfirmConfig({
      isOpen: true,
      title: t('Pindahkan Sertifikat Sekaligus'),
      message: t('Yakin ingin memindahkan {count} {what} dari "{from}" ke "{to}"?', { count: targetCards.length, what: whatLabel, from: certStatusLabel(t, col), to: certStatusLabel(t, targetCol) }),
      confirmLabel: t('Pindahkan Semua'),
      type: 'warning',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        setActiveBulkMenu(null);
        const saved = await moveCertificates(targetCards.map(c => c.id), targetCol);
        if (saved) notify.success(t('{count} {what} dipindahkan ke {to}', { count: targetCards.length, what: whatLabel, to: certStatusLabel(t, targetCol) }));
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
    const target = certStatusSelect;
    setCertDetailsModalOpen(false); // the card moves on the board right away; no waiting on a dialog
    const saved = await moveCertificates([activeCert.id], target);
    if (saved) notify.success(t('Status sertifikat diperbarui ke: {status}', { status: certStatusLabel(t, target) }));
  };

  const handleAddParticipantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartName.trim() || !newPartCompany.trim() || !newPartRegNum.trim()) {
      notify.warning(t('Isi Nama, Perusahaan, dan Nomor Registrasi/ID.'));
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

      notify.success(t('Peserta dan sertifikat terpilih berhasil didaftarkan'));
      
      // Reset form
      setNewPartName('');
      setNewPartCompany('');
      setNewPartRegNum('');
      setNewPartEmail('');
      setAddParticipantModalOpen(false);

      // Reload UI
      await loadBatchDetails();
    } catch (err) {
      console.error(err);
      notify.error(t('Gagal menambahkan peserta'), getErrorMessage(err));
    }
  };

  // Date formatter
  const formatDateStr = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const formatDateTime = (dateObj?: Date | string) => {
    if (!dateObj) return '';
    const d = typeof dateObj === 'string' ? new Date(dateObj) : dateObj;
    return d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getStatusBadge = (status: string) =>
    status ? <CertStatusBadge status={status} /> : <span className="text-xs text-slate-500">-</span>;

  // Build Audit Logs list
  const getAuditTimeline = () => {
    if (!currentTraining) return [];
    const entries: AuditEntry[] = [];

    // Training created
    if (currentTraining.created_at) {
      entries.push({
        time: new Date(currentTraining.created_at),
        color: 'bg-blue-600',
        title: t('Batch training dibuat'),
        detail: t('Batch training "{program_name}" ({batch_code}) dimulai.', { program_name: currentTraining.program_name, batch_code: currentTraining.batch_code }),
        by: currentTraining.pic || 'System'
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
          title: t('Draf sertifikat dibuat'),
          detail: `${name} (${certNum}) - ${certTypeLabel(t, c.certificate_type)}`,
          by: 'System'
        });
      }
    });

    // Certificate status history updates
    certificateHistories.forEach(h => {
      const cert = certificates.find(c => c.id === h.certificate_id);
      const name = cert?.participants ? cert.participants.name : 'Unknown';
      const certNum = cert ? (cert.certificate_number || cert.id) : h.certificate_id;

      let color = 'bg-blue-500';
      if (h.new_status === 'Completed') color = 'bg-emerald-500';
      else if (h.new_status === 'Pending') color = 'bg-slate-400';

      entries.push({
        time: new Date(h.created_at),
        color: color,
        title: t('Sertifikat diperbarui ke {status}', { status: certStatusLabel(t, h.new_status) }),
        detail: t('{name} ({number}) - status berubah dari {from} ke {to}.', { name, number: certNum, from: certStatusLabel(t, h.previous_status), to: certStatusLabel(t, h.new_status) }),
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
      <div className="space-y-6">
      <PageHeader
        before={
          <Link href="/trainings" className="inline-flex items-center gap-1 text-[13px] text-slate-500 hover:text-slate-900 transition-colors">
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_back</span>
            {t('Batch Training')}</Link>
        }
        title={currentTraining?.program_name || <Skeleton className="h-8 w-72 max-w-full" />}
        meta={currentTraining?.status && <CertStatusBadge status={currentTraining.status} />}
        description={
          loading && !currentTraining ? (
            <Skeleton className="h-4 w-96 max-w-full" />
          ) : (
          <span className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-slate-400" aria-hidden="true">tag</span>
              <span className="font-mono text-xs">{currentTraining?.batch_code}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-slate-400" aria-hidden="true">calendar_today</span>
              {formatDateStr(currentTraining?.start_date)} - {formatDateStr(currentTraining?.end_date)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-slate-400" aria-hidden="true">location_on</span>
              {currentTraining?.location || t('Jakarta Training Center')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-slate-400" aria-hidden="true">manage_accounts</span>
              {t('PIC:')} {currentTraining?.pic || t('Belum diatur')}
            </span>
          </span>
          )
        }
        actions={
          <>
            <Button variant="secondary" icon="edit" onClick={() => setEditBatchModalOpen(true)} disabled={!canWrite} title={noWriteHint}>{t('Ubah Detail')}</Button>
            <Button variant="primary" icon="download" onClick={handleExportRoster}>{t('Buat Laporan')}</Button>
          </>
        }
      />

      {loadError && <LoadError message={loadError} onRetry={loadBatchDetails} />}

      <Tabs
        value={activeTab}
        onChange={setActiveTab}
        items={[
          { id: 'overview', label: t('Ringkasan') },
          { id: 'participants', label: t('Peserta') },
          { id: 'certificates', label: t('Sertifikat'), count: loading ? undefined : pendingCertsCount, countTone: 'warning' },
          { id: 'activity', label: t('Log Aktivitas') },
        ]}
      />

      {/* Tabs Content */}
      <div id="tab-contents">
        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-150">
            {/* Stat Cards */}
            <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="cms-card flex flex-col justify-between">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-xs font-semibold text-slate-500">{t('Total Peserta')}</span>
                  <span className="material-symbols-outlined text-slate-400">groups</span>
                </div>
                {loading ? <Skeleton className="h-9 w-32" /> : (
<div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold text-slate-900">{totalParts}</span>
                  <span className="text-xs text-slate-500 font-medium">{t('Peserta terdaftar')}</span>
                </div>
)}
              </div>
              
              <div className="cms-card flex flex-col justify-between">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-xs font-semibold text-slate-500">{t('Progres Kualifikasi')}</span>
                  <span className="material-symbols-outlined text-slate-400">check_circle</span>
                </div>
                <div className="flex flex-col gap-2">
                  {loading ? <Skeleton className="h-9 w-32" /> : (
<div className="flex items-baseline gap-2">
                    <span className="text-3xl font-semibold text-slate-900">{qualPercent}%</span>
                    <span className="text-xs text-slate-500 font-medium">{passedQual}/{qualCerts.length} {t('Lulus')}</span>
                  </div>
)}
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full" style={{ width: `${qualPercent}%` }}></div>
                  </div>
                </div>
              </div>

              <div className="cms-card flex flex-col justify-between">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-xs font-semibold text-slate-500">{t('Tingkat Kehadiran')}</span>
                  <span className="material-symbols-outlined text-slate-400">event_available</span>
                </div>
                <div className="flex flex-col gap-2">
                  {loading ? <Skeleton className="h-9 w-32" /> : (
<div className="flex items-baseline gap-2">
                    <span className="text-3xl font-semibold text-slate-900">{displayAttPercent}%</span>
                    <span className="text-xs text-slate-500 font-medium">{displayAttPercent === 100 ? t('Sempurna') : t('Berjalan')}</span>
                  </div>
)}
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full" style={{ width: `${Math.min(attPercent, 100)}%` }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Table Preview */}
            <div className="lg:col-span-12 cms-card !p-0 overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-card">
                <h2 className="font-semibold text-slate-900 text-sm">{t('Progres peserta')}</h2>
                <button onClick={() => setActiveTab('participants')} className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1">
                  {t('Lihat Semua')} <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              </div>
              <div className="overflow-x-auto w-full">
                <table className="cms-table w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="h-10 px-4 text-[11px] font-semibold text-slate-500 align-middle">{t('Nama Peserta')}</th>
                      <th className="h-10 px-4 text-[11px] font-semibold text-slate-500 align-middle">{t('Nomor ID')}</th>
                      <th className="h-10 px-4 text-[11px] font-semibold text-slate-500 align-middle">{t('Status Kehadiran')}</th>
                      <th className="h-10 px-4 text-[11px] font-semibold text-slate-500 align-middle">{t('Status Kualifikasi')}</th>
                      <th className="h-10 px-4 text-[11px] font-semibold text-slate-500 align-middle text-right">{t('Tindakan')}</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm text-slate-800 divide-y divide-slate-100">
                    {loading ? (
                      <TableSkeletonRows columns={['w-36', 'w-24', { w: 'w-20', kind: 'badge' }, { w: 'w-20', kind: 'badge' }, { w: 'w-12', align: 'right' }]} rows={4} label={t('Memuat...')} />
                    ) : totalParts === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center bg-card">
                          <div className="flex flex-col items-center justify-center gap-3">
                            <span className="material-symbols-outlined text-4xl text-slate-400">groups</span>
                            <p className="text-sm font-semibold text-slate-700">{t('Belum ada peserta terdaftar di batch ini')}</p>
                            <p className="text-xs text-slate-500">{t('Impor daftar peserta untuk memulai.')}</p>
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
                              <button onClick={() => openEmailModalSingle(p)} className="text-blue-600 hover:text-blue-700 text-xs font-semibold flex items-center justify-end gap-1 w-full">
                                <span className="material-symbols-outlined text-sm">mail</span> {t('Email')}</button>
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
            <div className="flex flex-wrap justify-between items-center gap-3">
              <div className="flex items-center gap-3">
                <div className="relative w-72">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                  <input
                    value={partSearchTerm}
                    onChange={(e) => setPartSearchTerm(e.target.value)}
                    className="cms-input h-9 !pl-10 !text-[13px]"
                    aria-label={t('Cari peserta')}
                    placeholder={t('Cari peserta...')}
                    type="text"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="secondary" size="sm" icon="mail" onClick={openEmailModalBulk} className="!h-9">{t('Email Semua')}</Button>
                <Button variant="primary" size="sm" icon="person_add" onClick={() => setAddParticipantModalOpen(true)} disabled={!canWrite} title={noWriteHint} className="!h-9">{t('Tambah Peserta')}</Button>
              </div>
            </div>

            <div className="cms-card !p-0 overflow-hidden">
              <div className="table-scroll overflow-x-auto w-full">
                <table className="cms-table w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-[11px] font-semibold text-slate-500 px-6 py-4">{t('Nama')}</th>
                      <th className="text-[11px] font-semibold text-slate-500 px-6 py-4">{t('Nama Perusahaan')}</th>
                      <th className="text-[11px] font-semibold text-slate-500 px-6 py-4">{t('Nomor ID')}</th>
                      <th className="text-[11px] font-semibold text-slate-500 px-6 py-4">{t('Jabatan')}</th>
                      <th className="text-[11px] font-semibold text-slate-500 px-6 py-4">{t('Status kualifikasi')}</th>
                      <th className="text-[11px] font-semibold text-slate-500 px-6 py-4">{t('Status kehadiran')}</th>
                      <th className="text-[11px] font-semibold text-slate-500 px-6 py-4 text-right">{t('Tindakan')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[13px] text-slate-700">
                    {loading ? (
                      <TableSkeletonRows columns={['w-36', 'w-40', 'w-24', 'w-24', { w: 'w-20', kind: 'badge' }, { w: 'w-20', kind: 'badge' }, { w: '', kind: 'action' }]} rows={5} label={t('Memuat...')} />
                    ) : filteredParticipants.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center bg-card text-slate-500">
                          <p className="text-sm font-medium text-slate-900">{t('Peserta tidak ditemukan')}</p>
                          <p className="mt-1 text-xs">{t('Coba nama lain atau tambahkan peserta ke batch ini.')}</p>
                        </td>
                      </tr>
                    ) : (
                      filteredParticipants.map(p => {
                        const attCert = certificates.find(c => c.participant_id === p.id && c.certificate_type === 'Attendance');
                        const qualCert = certificates.find(c => c.participant_id === p.id && c.certificate_type === 'Qualification');
                        return (
                          <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-3 font-medium text-slate-900">{p.name}</td>
                            <td className="px-6 py-3 text-slate-600">{p.company || t('PRIBADI')}</td>
                            <td className="px-6 py-3 text-slate-500 font-mono text-xs">{p.registration_number || 'N/A'}</td>
                            <td className="px-6 py-3 text-slate-600">{t('Nama Peserta')}</td>
                            <td className="px-6 py-3">{qualCert ? getStatusBadge(qualCert.status) : '-'}</td>
                            <td className="px-6 py-3">{attCert ? getStatusBadge(attCert.status) : '-'}</td>
                            <td className="px-6 py-3 text-right">
                              <div className="flex gap-1 justify-end items-center">
                                <button onClick={() => openEmailModalSingle(p)} aria-label={t('Email {name}', { name: p.name })} title={t('Email')} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors">
                                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">mail</span>
                                </button>
                                {[qualCert, attCert].every(c => !c || can('delete.certificate', { ownerId: c.created_by })) && (
                                <button onClick={() => handleRemoveParticipant(p.id)} aria-label={t('Keluarkan {name}', { name: p.name })} title={t('Keluarkan')} className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors">
                                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">delete</span>
                                </button>
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
            </div>
          </div>
        )}

        {/* Tab 3: Certificates Kanban */}
        {activeTab === 'certificates' && (
          <div ref={boardRef} className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-in fade-in duration-150">
            {/* Columns */}
            {['Pending', 'Processing', 'Printing', 'Completed'].map(colStatus => {
              const cards = sortedCerts.filter(c => c.status === colStatus);
              return (
                <div key={colStatus} className="flex flex-col gap-3 bg-slate-100/70 p-3 rounded-xl min-h-[450px]">
                  <div className="flex justify-between items-center px-1 relative">
                    <span className="text-xs font-semibold text-slate-600">
                      {colStatus === 'Processing' ? t('Proses QC') : colStatus === 'Printing' ? t('Tercetak') : colStatus === 'Completed' ? t('Selesai / Terkirim') : colStatus}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {/* Left arrow button */}
                      {canWrite && colStatus !== 'Pending' && (
                        <button 
                          onClick={() => setActiveBulkMenu(activeBulkMenu?.col === colStatus && activeBulkMenu?.dir === 'left' ? null : { col: colStatus, dir: 'left' })}
                          className="w-6 h-6 rounded-md hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
                          title={t('Pindahkan ke kiri')}
                        >
                          <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                        </button>
                      )}
                      
                      <span className="bg-card text-slate-600 px-2 py-0.5 rounded-full text-[11px] font-medium tabular-nums border border-slate-200">
                        {cards.length}
                      </span>
                      
                      {/* Right arrow button */}
                      {canWrite && colStatus !== 'Completed' && (
                        <button 
                          onClick={() => setActiveBulkMenu(activeBulkMenu?.col === colStatus && activeBulkMenu?.dir === 'right' ? null : { col: colStatus, dir: 'right' })}
                          className="w-6 h-6 rounded-md hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
                          title={t('Pindahkan ke kanan')}
                        >
                          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                        </button>
                      )}
                    </div>

                    {/* Bulk menu dropdown */}
                    {activeBulkMenu?.col === colStatus && (
                      <div className="absolute right-0 top-7 z-30 bg-card border border-slate-200 rounded-lg shadow-lg p-1.5 flex flex-col gap-1 w-48 text-left animate-in fade-in slide-in-from-top-2 duration-150">
                        <p className="text-[11px] font-semibold text-slate-500 px-2 py-0.5">
                          {t('Geser')} {activeBulkMenu.dir === 'left' ? t('Kiri') : t('Kanan')}
                        </p>
                        <button 
                          onClick={() => handleBulkShift(colStatus, activeBulkMenu.dir, 'All')}
                          className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-[14px]">swap_horiz</span>
                          {t('Semua Sertifikat')}</button>
                        <button 
                          onClick={() => handleBulkShift(colStatus, activeBulkMenu.dir, 'Attendance')}
                          className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-[14px]">assignment_turned_in</span>
                          {t('Hanya Kehadiran')}</button>
                        <button 
                          onClick={() => handleBulkShift(colStatus, activeBulkMenu.dir, 'Qualification')}
                          className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-[14px]">workspace_premium</span>
                          {t('Hanya Kualifikasi')}</button>
                      </div>
                    )}
                  </div>
                  <div
                    onDragOver={handleDragOver}
                    onDrop={canWrite ? (e) => handleDrop(e, colStatus) : undefined}
                    className={`kanban-col-body flex-grow flex flex-col gap-2.5 rounded-lg transition-all duration-200 ${
                      isDragging ? 'bg-slate-200/50 border-2 border-dashed border-slate-300 p-2 min-h-[300px]' : ''
                    }`}
                  >
                    {loading ? (
                      <KanbanCardsSkeleton count={3} />
                    ) : cards.length === 0 ? (
                      <div className="border border-dashed border-slate-300 rounded-lg p-4 flex flex-col items-center justify-center text-center py-8 w-full select-none">
                        <span className="material-symbols-outlined text-slate-400 text-lg mb-1">inbox</span>
                        <p className="text-xs font-medium text-slate-600">{t('Kolom kosong')}</p>
                        <p className="text-[11px] text-slate-500">{t('Seret kartu ke sini')}</p>
                      </div>
                    ) : (
                      cards.map(c => {
                        const isOverdue = c.sla_age_days > slaThreshold && c.status !== 'Completed';
                        return (
                          <div
                            key={c.id}
                            data-flip-id={c.id}
                            data-syncing={syncing.has(c.id) || undefined}
                            aria-busy={syncing.has(c.id) || undefined}
                            draggable={canWrite && !syncing.has(c.id)}
                            onDragStart={canWrite && !syncing.has(c.id) ? (e) => handleDragStart(e, c.id) : undefined}
                            onDragEnd={canWrite ? handleDragEnd : undefined}
                            onClick={() => handleOpenCertDetails(c)}
                            className={`kanban-card transition-opacity duration-150 data-[syncing]:opacity-70 ${canWrite ? 'cursor-grab active:cursor-grabbing data-[syncing]:cursor-progress' : 'cursor-pointer'}`}
                          >
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <span className="text-[11px] font-mono text-slate-500">{c.certificate_number || 'N/A'}</span>
                              {syncing.has(c.id) && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-blue-600" role="status">
                                  <span className="material-symbols-outlined animate-spin text-[14px]" aria-hidden="true">progress_activity</span>
                                  {t('Menyimpan...')}
                                </span>
                              )}
                            </div>
                            <h4 className="font-medium text-slate-900 text-sm">{c.participants?.name || t('Tidak diketahui')}</h4>
                            <div className="mt-1.5">
                              <CertTypeBadge type={c.certificate_type} />
                            </div>
                            <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-100">
                              {colStatus === 'Completed' ? (
                                <>
                                  <span className="cms-badge cms-badge-success">{t('Siap / Terkirim')}</span>
                                </>
                              ) : isOverdue ? (
                                <>
                                  <span className="cms-badge cms-badge-danger">{t('Terlambat ({days} hr)', { days: c.sla_age_days })}</span>
                                </>
                              ) : (
                                <>
                                  <span className="text-[11px] text-slate-500 tabular-nums">{c.sla_age_days} {t('hari usia SLA')}</span>
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
            <div className="cms-card">
              <h2 className="font-semibold text-slate-900 text-sm mb-6">{t('Riwayat jejak audit')}</h2>
              {loading ? (
                <ListRowsSkeleton rows={4} withBar={false} />
              ) : auditTimeline.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-10 text-slate-500 gap-2">
                  <span className="material-symbols-outlined text-3xl text-slate-400" aria-hidden="true">history</span>
                  <p className="text-sm font-medium text-slate-900">{t('Belum ada aktivitas tercatat')}</p>
                  <p className="text-[11px] text-slate-500">{t('Aktivitas pada sertifikat akan muncul di sini.')}</p>
                </div>
              ) : (
                <div className="relative before:absolute before:inset-y-0 before:left-3 before:w-px before:bg-slate-200">
                  {auditTimeline.map((e, index) => (
                    <div key={index} className={`relative pl-8 ${index < auditTimeline.length - 1 ? 'mb-6' : ''}`}>
                      <div className={`absolute left-[8px] top-1.5 w-2 h-2 rounded-full ${e.color} ring-4 ring-card`}></div>
                      <p className="text-xs text-slate-500">
                        {formatDateTime(e.time)} - {e.by}
                      </p>
                      <p className="text-sm font-medium text-slate-900 mt-0.5">{e.title}</p>
                      <p className="text-xs text-slate-500 mt-1">{e.detail}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      </div>

      {/* EDIT BATCH DETAILS MODAL */}
      {editBatchModalOpen && (
        <Modal isOpen={true} onClose={() => setEditBatchModalOpen(false)} title={t('Ubah Detail Training')} dismissOnBackdrop onSubmit={handleSaveDetails} cancelLabel={t('Batal')} submitLabel={t('Simpan Perubahan')}>
<div className="flex flex-col gap-4">
<div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-slate-500">{t('Nama Program Training')}</label>
                <input className="cms-input" value={editName} onChange={(e) => setEditName(e.target.value)} type="text" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-slate-500">{t('Kode Batch')}</label>
                <input className="cms-input font-mono" value={editBatchCode} onChange={(e) => setEditBatchCode(e.target.value)} type="text" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-slate-500">{t('Tanggal Mulai')}</label>
                  <input className="cms-input text-slate-700" value={editStart} onChange={(e) => setEditStart(e.target.value)} type="date" required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-slate-500">{t('Tanggal Selesai')}</label>
                  <input className="cms-input text-slate-700" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} type="date" required />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-slate-500">{t('Lokasi / Tempat')}</label>
                <input className="cms-input" value={editLoc} onChange={(e) => setEditLoc(e.target.value)} type="text" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-slate-500">{t('Penanggung Jawab (PIC)')}</label>
                <input className="cms-input" value={editPic} onChange={(e) => setEditPic(e.target.value)} placeholder={t('mis. Ahmad Shafwan')} type="text" required />
              </div>
</div>
</Modal>
      )}

      {/* ADD PARTICIPANT MODAL */}
      {addParticipantModalOpen && (
        <Modal isOpen={true} onClose={() => setAddParticipantModalOpen(false)} title={t('Daftarkan Peserta Baru')} size="lg" dismissOnBackdrop onSubmit={handleAddParticipantSubmit} cancelLabel={t('Batal')} submitLabel={t('Daftarkan Peserta')}>
<div className="flex flex-col gap-4">
{/* Participant Details Section */}
              <div className="border-b border-slate-100 pb-3">
                <p className="text-[11px] font-semibold text-slate-500 mb-2">{t('Informasi Peserta')}</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5 col-span-2">
                    <label className="text-[11px] font-semibold text-slate-500">{t('Nama Lengkap')} <span className="text-red-500">*</span></label>
                    <input className="cms-input" value={newPartName} onChange={(e) => setNewPartName(e.target.value)} placeholder={t('mis. Ahmad Shafwan')} type="text" required />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-slate-500">{t('Perusahaan / Organisasi')} <span className="text-red-500">*</span></label>
                    <input className="cms-input" value={newPartCompany} onChange={(e) => setNewPartCompany(e.target.value)} placeholder={t('mis. Biro Klasifikasi Indonesia')} type="text" required />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-slate-500">{t('Nomor Registrasi / ID')} <span className="text-red-500">*</span></label>
                    <input className="cms-input font-mono" value={newPartRegNum} onChange={(e) => setNewPartRegNum(e.target.value)} placeholder="e.g. 0001" type="text" required />
                  </div>
                  <div className="flex flex-col gap-1.5 col-span-2">
                    <label className="text-[11px] font-semibold text-slate-500">{t('Alamat Email')}</label>
                    <input className="cms-input" value={newPartEmail} onChange={(e) => setNewPartEmail(e.target.value)} placeholder={t('mis. ahmad.shafwan@bki.co.id')} type="email" />
                  </div>
                </div>
              </div>

              {/* Certificate Details Section */}
              <div>
                <p className="text-[11px] font-semibold text-slate-500 mb-2">{t('Pembuatan Sertifikat')}</p>
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
                      <span className="text-xs font-semibold text-slate-700">{t('Buat Sertifikat Kehadiran')}</span>
                    </label>
                    {generateAttendance && (
                      <div className="flex flex-col gap-1.5 mt-1">
                        <label className="text-[11px] font-semibold text-slate-500">{t('Nomor Sertifikat')}</label>
                        <input 
                          className="cms-input font-mono bg-card" 
                          value={attendanceNumber} 
                          onChange={(e) => setAttendanceNumber(e.target.value)} 
                          placeholder={t('Otomatis dari sertifikat terakhir')}
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
                      <span className="text-xs font-semibold text-slate-700">{t('Buat Sertifikat Kualifikasi')}</span>
                    </label>
                    {generateQualification && (
                      <div className="flex flex-col gap-1.5 mt-1">
                        <label className="text-[11px] font-semibold text-slate-500">{t('Nomor Sertifikat')}</label>
                        <input 
                          className="cms-input font-mono bg-card" 
                          value={qualificationNumber} 
                          onChange={(e) => setQualificationNumber(e.target.value)} 
                          placeholder={t('Otomatis dari sertifikat terakhir')}
                          type="text" 
                        />
                      </div>
                    )}
                  </div>

                  {/* Evaluation Result Dropdown */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-slate-500">{t('Hasil Evaluasi Awal')}</label>
                    <select 
                      value={newPartEvaluation} 
                      onChange={(e) => setNewPartEvaluation(e.target.value)}
                      className="cms-input py-2 text-slate-700"
                    >
                      <option value="Lulus">{t('Lulus')}</option>
                      <option value="Belum Lulus">{t('Belum Lulus')}</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Actions */}
</div>
</Modal>
      )}

      {/* EMAIL COMPOSITION MODAL */}
      {emailModalOpen && (
        <Modal isOpen={true} onClose={() => setEmailModalOpen(false)} title={t('Tulis Pesan Email')} description={t('Membuka draf di aplikasi email Anda.')} size="lg" dismissOnBackdrop onSubmit={handleSendEmail} cancelLabel={t('Batal')} submitLabel={t('Buka di Aplikasi Email')}>
<div className="flex flex-col gap-4">
<div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-slate-500">{t('Penerima')}</label>
                <input className="cms-input bg-slate-50 text-slate-500 font-medium" value={emailRecipients} readOnly type="text" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-slate-500">{t('Subjek')}</label>
                <input className="cms-input" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder={t('Baris subjek')} type="text" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-slate-500">{t('Isi Pesan')}</label>
                <textarea className="cms-input h-32 resize-none" value={emailMessage} onChange={(e) => setEmailMessage(e.target.value)} placeholder={t('Yth. para peserta, ...')} required></textarea>
              </div>
</div>
</Modal>
      )}

      {/* CERTIFICATE DETAIL MODAL */}
      {certDetailsModalOpen && activeCert && (
        <Modal isOpen={true} onClose={() => setCertDetailsModalOpen(false)} title={t('Detail Status Sertifikat')} description={activeCert.certificate_number || activeCert.id} dismissOnBackdrop>
<div className="flex flex-col gap-5">
              {/* Participant Details */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500">{t('Nama Peserta')}</p>
                  <p className="text-sm font-semibold text-slate-800">{activeCert.participants?.name}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-500">{t('Tipe Sertifikat')}</p>
                  <p className="text-sm font-semibold text-slate-800">{activeCert.certificate_type}</p>
                </div>
              </div>

              {/* Timeline Checklist */}
              <div>
                <p className="text-[11px] font-semibold text-slate-500 mb-3">{t('Progres Alur Kerja')}</p>
                <div className="flex flex-col gap-3 relative before:absolute before:inset-y-0 before:left-3.5 before:w-0.5 before:bg-slate-200 pl-1">
                  
                  {/* Step 1: Generated */}
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center border border-emerald-200 z-10 shrink-0">
                      <span className="material-symbols-outlined text-[16px] font-semibold">check</span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800">{t('Dibuat & Template Terbentuk')}</p>
                      <p className="text-[11px] text-slate-500">{t('Selesai pada')} {formatDateTime(activeCert.created_at)}</p>
                    </div>
                  </div>

                  {/* Step 2: Quality Control (QC) */}
                  <div className={`flex items-center gap-3 ${activeCert.status === 'Pending' ? 'opacity-50' : ''}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center border z-10 shrink-0 ${
                      activeCert.status === 'Pending' 
                        ? 'bg-slate-100 text-slate-400 border-slate-200' 
                        : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                    }`}>
                      <span className="material-symbols-outlined text-[16px] font-semibold">
                        {activeCert.status === 'Pending' ? 'hourglass_empty' : 'check'}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800">{t('Kontrol Kualitas (QC)')}</p>
                      <p className="text-[11px] text-slate-500">
                        {activeCert.status === 'Pending' ? t('Menunggu antrean QC') : t('Selesai')}
                      </p>
                    </div>
                  </div>

                  {/* Step 3: Printed */}
                  <div className={`flex items-center gap-3 ${['Pending', 'Processing'].includes(activeCert.status) ? 'opacity-50' : ''}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center border z-10 shrink-0 ${
                      activeCert.printed_at
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                        : activeCert.status === 'Printing'
                          ? 'bg-blue-100 text-blue-600 border-blue-200'
                          : 'bg-slate-100 text-slate-400 border-slate-200'
                    }`}>
                      <span className="material-symbols-outlined text-[16px]">
                        {activeCert.printed_at ? 'check' : 'print'}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800">{t('Dicetak & Pemeriksaan Fisik')}</p>
                      {activeCert.printed_at ? (
                        <p className="text-[11px] text-slate-500">
                          {t('Dicetak pada')} {formatDateTime(activeCert.printed_at)} {t('oleh')} {activeCert.printed_by}
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-500">
                          {activeCert.status === 'Printing' ? t('Pencetakan sedang berlangsung') : t('Menunggu Antrean Cetak')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Step 4: Shipped */}
                  <div className={`flex items-center gap-3 ${activeCert.status !== 'Completed' ? 'opacity-50' : ''}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center border z-10 shrink-0 ${
                      activeCert.sent_at
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                        : activeCert.status === 'Completed'
                          ? 'bg-blue-100 text-blue-600 border-blue-200'
                          : 'bg-slate-100 text-slate-400 border-slate-200'
                    }`}>
                      <span className="material-symbols-outlined text-[16px]">
                        {activeCert.sent_at ? 'check' : 'local_shipping'}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800">{t('Ditandatangani & Dikirim')}</p>
                      {activeCert.sent_at ? (
                        <p className="text-[11px] text-slate-500">
                          {t('Dikirim pada')} {formatDateTime(activeCert.sent_at)} {t('oleh')} {activeCert.sent_by}
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-500">
                          {activeCert.status === 'Completed' ? t('Menunggu konfirmasi pengiriman akhir') : t('Menunggu tanda tangan & pengiriman')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Update action dropdown */}
              {canWrite && (
              <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                <label className="text-[11px] font-semibold text-slate-500" htmlFor="cert-status-select">
                  {t('Perbarui Status Tahap')}</label>
                <div className="flex gap-2">
                  <select
                    id="cert-status-select"
                    value={certStatusSelect}
                    onChange={(e) => setCertStatusSelect(e.target.value)}
                    className="cms-input flex-1 py-2 text-slate-700"
                  >
                    <option value="Pending">{t('Template Menunggu')}</option>
                    <option value="Processing">{t('Proses QC')}</option>
                    <option value="Printing">{t('Cetak / Tanda Tangan')}</option>
                    <option value="Completed">{t('Selesai / Terkirim')}</option>
                  </select>
                  <button onClick={handleUpdateCertStatus} className="cms-btn-primary py-2 cursor-pointer">
                    {t('Perbarui')}</button>
                </div>
              </div>
              )}
            </div>
</Modal>
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
