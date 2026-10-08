// Checks the training-agenda CSV import (src/lib/csv.ts). Run: npm run csv:check
// Optional: pass a CSV path to print how that file is read: node scripts/check-csv.mjs "path/to/file.csv"
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const load = async (rel) => {
  const src = readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
  return js;
};
// csv.ts imports ./safety (which pulls in zod): inline a copy of sanitizeString instead of importing the module
const safetyJs = (await load('../src/lib/safety.ts')).replace(/import \{ z \} from 'zod';/, '').replace(/export const trainingSchema[\s\S]*$/, '');
const csvJs = (await load('../src/lib/csv.ts')).replace(/import \{ sanitizeString \} from '\.\/safety';/, '');
const C = await import('data:text/javascript;base64,' + Buffer.from(safetyJs.replace(/export function/g, 'function') + '\n' + csvJs).toString('base64'));

let failed = 0, total = 0;
const eq = (name, got, want) => {
  total++;
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) { failed++; console.error(`FAIL ${name}\n  got  ${g}\n  want ${w}`); }
};

if (process.argv[2]) {
  const { batches, repairedRows } = C.normalizeAgendaCSVWithReport(readFileSync(process.argv[2], 'utf8'));
  console.log(`repaired rows: ${repairedRows}`);
  batches.forEach((b, i) => {
    console.log(`#${i + 1} ${b.program_name} | ${b.batch_code} | ${b.start_date} → ${b.end_date} | ${b.participants.length} participants`);
    b.participants.forEach(p => console.log(`   ${p.registration_number} | ${p.name} | ${p.company} | ${p.cert_kehadiran} | ${p.cert_kualifikasi} | ${p.evaluasi}`));
  });
  process.exit(0);
}

const HEAD = 'No Urut Proyek,Jenis Layanan,Metode Belajar Menghajar,Tanggal Sesuai Jadwal,Pemohon,Obyek/Nama Pelatihan,No Registrasi Peserta,Nama,Perusahaan,No Sertifikat Kehadiran,Hasil Evaluasi,No Sertifikat Kualifikasi';

// ---- low level splitting
eq('quoted comma stays in one cell', C.splitCSVRows('a,"b, c",d'), [['a', 'b, c', 'd']]);
eq('escaped quote', C.splitCSVRows('a,"say ""hi""",c'), [['a', 'say "hi"', 'c']]);
eq('line break inside quotes', C.splitCSVRows('a,"x\ny",c\nd,e,f'), [['a', 'x\ny', 'c'], ['d', 'e', 'f']]);
eq('CRLF and BOM', C.splitCSVRows('﻿a,b\r\nc,d\r\n'), [['a', 'b'], ['c', 'd']]);
eq('semicolon delimiter detected', C.splitCSVRows('a;b;c\n1;2,5;3'), [['a', 'b', 'c'], ['1', '2,5', '3']]);

// ---- the real-world layout: batch columns on the first row only, titles with commas, continuation rows short by 2 cells
const messy = [
  HEAD,
  '1,IN HOUSE TRAINING,OFFLINE,21 - 25 SEPTEMBER,PT CONTOH,MARINE SURVEYOR,679,A.A. CONTOH SATU,PT CONTOH,0679-02-S1-ACY/041/A13-L12/P8/2026,Lulus,0679-02-S2-ACY/041/A13-L12/P8/2026',
  ',,,MARINE SURVEYOR,680,BUDI TEST,PT CONTOH,0680-02-S1-ACY/041/A13-L12/P8/2026,Lulus,0680-02-S2-ACY/041/A13-L12/P8/2026',
  ',,,MARINE SURVEYOR,681,"CAPT. CONTOH, S.SI.T, M.M.TR",PT CONTOH,0681-02-S1-ACY/041/A13-L12/P8/2026,Lulus,0681-02-S2-ACY/041/A13-L12/P8/2026',
  ',,,MARINE SURVEYOR,682,"WULAN CONTOH .S.SIT , M MAR ENG",PT CONTOH,0682-02-S1-ACY/041/A13-L12/P8/2026,Lulus,0682-02-S2-ACY/041/A13-L12/P8/2026',
  '',
].join('\n');
const r = C.normalizeAgendaCSVWithReport(messy);
eq('messy: one batch', r.batches.length, 1);
eq('messy: batch details', [r.batches[0].program_name, r.batches[0].start_date, r.batches[0].end_date, r.batches[0].service_type, r.batches[0].batch_code], ['MARINE SURVEYOR', '2026-09-21', '2026-09-25', 'IN HOUSE TRAINING', 'Batch 1']);
eq('messy: three short rows were realigned', r.repairedRows, 3);
eq('messy: all participants kept in the right columns', r.batches[0].participants.map(p => [p.registration_number, p.name, p.company, p.evaluasi]), [
  ['679', 'A.A. CONTOH SATU', 'PT CONTOH', 'Lulus'], ['680', 'BUDI TEST', 'PT CONTOH', 'Lulus'],
  ['681', 'CAPT. CONTOH, S.SI.T, M.M.TR', 'PT CONTOH', 'Lulus'], ['682', 'WULAN CONTOH .S.SIT , M MAR ENG', 'PT CONTOH', 'Lulus'],
]);
eq('messy: certificate numbers land in the certificate columns', [r.batches[0].participants[1].cert_kehadiran, r.batches[0].participants[1].cert_kualifikasi], ['0680-02-S1-ACY/041/A13-L12/P8/2026', '0680-02-S2-ACY/041/A13-L12/P8/2026']);

// ---- a correct template (12 columns on every row) is untouched
const clean = [
  HEAD,
  '1,PUBLIC TRAINING,OFFLINE,02-04 FEBRUARI,PRIBADI,AUDITOR,0001,SATU,PRIBADI,K1,Lulus,Q1',
  ',,,,,AUDITOR,0002,DUA,PT X,K2,Lulus,Q2',
  '2,PUBLIC TRAINING,OFFLINE,02-06 FEBRUARI,PRIBADI,SURVEYOR,0003,TIGA,PRIBADI,K3,Lulus,Q3',
].join('\n');
const c = C.normalizeAgendaCSVWithReport(clean);
eq('clean: nothing repaired', c.repairedRows, 0);
eq('clean: two batches with their participants', c.batches.map(b => [b.program_name, b.participants.length]), [['AUDITOR', 2], ['SURVEYOR', 1]]);

// ---- continuation rows with a blank program inherit the previous batch (forward fill)
const fill = [HEAD, '1,PUBLIC TRAINING,OFFLINE,02-04 FEBRUARI,PRIBADI,AUDITOR,0001,SATU,PRIBADI,K1,Lulus,Q1', ',,,,,,0002,DUA,PT X,K2,Lulus,Q2'].join('\n');
eq('forward fill: blank program joins the previous batch', C.normalizeAgendaCSV(fill).map(b => [b.program_name, b.participants.map(p => p.name)]), [['AUDITOR', ['SATU', 'DUA']]]);
const noProgram = [HEAD, ',,,,,,0002,DUA,PT X,K2,Lulus,Q2'].join('\n');
eq('forward fill: nothing to inherit means the row is skipped', C.normalizeAgendaCSV(noProgram), []);

// ---- a new program on a continuation row starts a new batch instead of joining the previous one
const twoPrograms = [HEAD, '1,PUBLIC TRAINING,OFFLINE,02-04 FEBRUARI,PRIBADI,AUDITOR,0001,SATU,PRIBADI,K1,Lulus,Q1', ',,,,,SURVEYOR,0002,DUA,PT X,K2,Lulus,Q2'].join('\n');
eq('a different program is a different batch', C.normalizeAgendaCSV(twoPrograms).map(b => b.program_name), ['AUDITOR', 'SURVEYOR']);

// ---- BOM on the header must not break the first column
const bom = '﻿' + clean;
eq('BOM: project numbers still read', C.normalizeAgendaCSV(bom).map(b => b.projectNo), ['1', '2']);

// ---- text is stored as typed, not HTML-escaped
const amp = [HEAD, "1,PUBLIC TRAINING,OFFLINE,02-04 FEBRUARI,PRIBADI,AUDITOR,0001,O'NEIL,JOB PERTAMINA MEDCO E&P,K1,Lulus,Q1"].join('\n');
eq('ampersand and apostrophe are kept as typed', C.normalizeAgendaCSV(amp)[0].participants[0], { name: "O'NEIL", company: 'JOB PERTAMINA MEDCO E&P', registration_number: '0001', cert_kehadiran: 'K1', cert_kualifikasi: 'Q1', evaluasi: 'Lulus' });
eq('formula characters are still neutralised', C.normalizeAgendaCSV([HEAD, '1,X,OFFLINE,02-04 FEBRUARI,P,AUDITOR,1,=CMD(),P,K,Lulus,Q'].join('\n'))[0].participants[0].name, "'=CMD()");

// ---- same name, different registration numbers are different people
const same = [HEAD, '1,X,OFFLINE,02-04 FEBRUARI,P,AUDITOR,1,BUDI,PT A,K1,Lulus,Q1', ',,,,,AUDITOR,2,BUDI,PT B,K2,Lulus,Q2'].join('\n');
eq('same name with different registration numbers is kept twice', C.normalizeAgendaCSV(same)[0].participants.length, 2);

if (failed) { console.error(`${failed} csv checks FAILED`); process.exit(1); }
console.log(`csv: all ${total} checks passed`);
