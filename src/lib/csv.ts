import { sanitizeString } from './safety';

export interface CSVParticipant {
  name: string;
  company: string;
  registration_number: string;
  cert_kehadiran: string;
  cert_kualifikasi: string;
  evaluasi: string;
}

export interface CSVBatch {
  projectNo: string;
  program_name: string;
  batch_code: string;
  service_type: string;
  learning_method: string;
  start_date: string;
  end_date: string;
  location: string;
  participants: CSVParticipant[];
}

// Custom CSV forward-fill parser engine
export function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split('\n');
  if (lines.length < 2) return [];
  
  // Extract headers
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows: Record<string, string>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Simple comma split (assuming no escaped commas inside quotes for MVP, matching original logic)
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row);
  }
  return rows;
}

export function resolveDatesFromText(text: string): { start: string; end: string } {
  const monthMap: Record<string, string> = {
    'januari': '01', 'februari': '02', 'maret': '03', 'april': '04',
    'mei': '05', 'juni': '06', 'juli': '07', 'agustus': '08',
    'september': '09', 'oktober': '10', 'november': '11', 'desember': '12'
  };
  
  const clean = text.toLowerCase().trim();
  const match = clean.match(/(\d+)\s*-\s*(\d+)\s+([a-z]+)/);
  if (match) {
    const startDay = match[1].padStart(2, '0');
    const endDay = match[2].padStart(2, '0');
    const monthName = match[3];
    const monthCode = monthMap[monthName] || '02';
    return {
      start: `2026-${monthCode}-${startDay}`,
      end: `2026-${monthCode}-${endDay}`
    };
  }
  return { start: '2026-02-02', end: '2026-02-04' };
}

export function normalizeAgendaCSV(text: string): CSVBatch[] {
  const rawRows = parseCSV(text);
  const batches: CSVBatch[] = [];

  rawRows.forEach(row => {
    const projectNo = row['No Urut Proyek'];
    // Apply sanitization for display/processing
    const programName = sanitizeString(row['Obyek/Nama Pelatihan'] || '');
    const scheduleDate = row['Tanggal Sesuai Jadwal'];

    if (!programName) return;

    let matchedBatch: CSVBatch | undefined;
    if (projectNo) {
      matchedBatch = batches.find(b => b.projectNo === projectNo);
    } else {
      matchedBatch = batches.slice().reverse().find(b => b.program_name === programName);
    }

    if (!matchedBatch) {
      let startDate = '2026-02-02';
      let endDate = '2026-02-04';
      if (scheduleDate) {
        const parsedDates = resolveDatesFromText(scheduleDate);
        startDate = parsedDates.start;
        endDate = parsedDates.end;
      }

      matchedBatch = {
        projectNo: projectNo || '',
        program_name: programName,
        batch_code: 'Batch ' + (projectNo || Date.now().toString().slice(-3)),
        service_type: sanitizeString(row['Jenis Layanan'] || 'PUBLIC TRAINING'),
        learning_method: sanitizeString(row['Metode Belajar Menghajar'] || 'OFFLINE'),
        start_date: startDate,
        end_date: endDate,
        location: 'Jakarta Training Center',
        participants: []
      };
      batches.push(matchedBatch);
    }

    const participantName = sanitizeString(row['Nama'] || '');
    if (participantName) {
      const dup = matchedBatch.participants.find(p => p.name === participantName);
      if (!dup) {
        matchedBatch.participants.push({
          name: participantName,
          company: sanitizeString(row['Perusahaan'] || 'PRIBADI'),
          registration_number: sanitizeString(row['No Registrasi Peserta'] || ''),
          cert_kehadiran: sanitizeString(row['No Sertifikat Kehadiran'] || ''),
          cert_kualifikasi: sanitizeString(row['No Sertifikat Kualifikasi'] || ''),
          evaluasi: sanitizeString(row['Hasil Evaluasi'] || 'Lulus')
        });
      }
    }
  });

  return batches;
}
