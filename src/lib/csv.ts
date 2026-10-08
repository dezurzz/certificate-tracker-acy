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

/**
 * Splits CSV text into rows of cells (RFC 4180): quoted cells may contain commas, quotes ("") and line breaks,
 * a UTF-8 BOM and CRLF line endings are handled, and the delimiter (comma, semicolon or tab, as written by
 * spreadsheets in different locales) is detected from the header line.
 */
export function splitCSVRows(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '');
  const firstLine = (() => {
    let quoted = false;
    for (let i = 0; i < src.length; i++) {
      if (src[i] === '"') quoted = !quoted;
      else if (!quoted && (src[i] === '\n' || src[i] === '\r')) return src.slice(0, i);
    }
    return src;
  })();
  const count = (ch: string) => firstLine.split(ch).length - 1;
  const delimiter = [',', ';', '\t'].reduce((best, ch) => (count(ch) > count(best) ? ch : best), ',');

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const endCell = () => { row.push(cell); cell = ''; };
  const endRow = () => { endCell(); rows.push(row); row = []; };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '') {
      quoted = true;
    } else if (ch === delimiter) {
      endCell();
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      endRow();
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length > 0) endRow();
  return rows;
}

export interface CSVParseReport {
  rows: Record<string, string>[];
  /** Rows that were shorter than the header and were realigned (see below). */
  repairedRows: number;
}

/**
 * Header-keyed rows. A continuation row (first cell empty) that is SHORTER than the header has lost some of its
 * leading empty cells (typical when merged cells are exported from a spreadsheet): its data columns are still
 * intact at the right-hand end, so it is padded on the LEFT. Any other short row is padded on the right.
 */
export function parseCSVWithReport(text: string): CSVParseReport {
  const table = splitCSVRows(text).filter(r => r.some(c => c.trim() !== ''));
  if (table.length < 2) return { rows: [], repairedRows: 0 };
  const headers = table[0].map(h => h.trim());
  const rows: Record<string, string>[] = [];
  let repairedRows = 0;

  for (const raw of table.slice(1)) {
    let cells = raw.map(c => c.trim());
    if (cells.length < headers.length) {
      const missing = headers.length - cells.length;
      if (cells[0] === '') {
        cells = [...new Array<string>(missing).fill(''), ...cells];
        repairedRows++;
      } else {
        cells = [...cells, ...new Array<string>(missing).fill('')];
      }
    }
    const row: Record<string, string> = {};
    headers.forEach((header, index) => { row[header] = cells[index] || ''; });
    rows.push(row);
  }
  return { rows, repairedRows };
}

export function parseCSV(text: string): Record<string, string>[] {
  return parseCSVWithReport(text).rows;
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

export interface NormalizeReport {
  batches: CSVBatch[];
  /** Rows realigned because they lacked leading empty cells. */
  repairedRows: number;
}

export function normalizeAgendaCSV(text: string): CSVBatch[] {
  return normalizeAgendaCSVWithReport(text).batches;
}

export function normalizeAgendaCSVWithReport(text: string): NormalizeReport {
  const { rows: rawRows, repairedRows } = parseCSVWithReport(text);
  const batches: CSVBatch[] = [];
  // Forward fill: continuation rows leave the batch columns blank, so they inherit the previous batch's values
  const last = { projectNo: '', program: '', schedule: '', service: '', method: '' };

  rawRows.forEach(row => {
    const programName = sanitizeString(row['Obyek/Nama Pelatihan'] || '') || last.program;
    if (!programName) return;
    const sameProgram = programName === last.program;
    const projectNo = row['No Urut Proyek'] || (sameProgram ? last.projectNo : '');
    const scheduleDate = row['Tanggal Sesuai Jadwal'] || (sameProgram ? last.schedule : '');
    const service = row['Jenis Layanan'] || (sameProgram ? last.service : '');
    const method = row['Metode Belajar Menghajar'] || (sameProgram ? last.method : '');
    Object.assign(last, { projectNo, program: programName, schedule: scheduleDate, service, method });

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
        service_type: sanitizeString(service || 'PUBLIC TRAINING'),
        learning_method: sanitizeString(method || 'OFFLINE'),
        start_date: startDate,
        end_date: endDate,
        location: 'Jakarta Training Center',
        participants: []
      };
      batches.push(matchedBatch);
    }

    const participantName = sanitizeString(row['Nama'] || '');
    if (participantName) {
      const registration = sanitizeString(row['No Registrasi Peserta'] || '');
      const dup = matchedBatch.participants.find(p => p.name === participantName && p.registration_number === registration);
      if (!dup) {
        matchedBatch.participants.push({
          name: participantName,
          company: sanitizeString(row['Perusahaan'] || 'PRIBADI'),
          registration_number: registration,
          cert_kehadiran: sanitizeString(row['No Sertifikat Kehadiran'] || ''),
          cert_kualifikasi: sanitizeString(row['No Sertifikat Kualifikasi'] || ''),
          evaluasi: sanitizeString(row['Hasil Evaluasi'] || 'Lulus')
        });
      }
    }
  });

  return { batches, repairedRows };
}
