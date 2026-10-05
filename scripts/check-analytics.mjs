// Checks src/lib/analytics.ts against a small hand-computed fixture.
// Run: npm run analytics:check
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const source = readFileSync(fileURLToPath(new URL('../src/lib/analytics.ts', import.meta.url)), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const A = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));

let failed = 0;
const eq = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) { failed++; console.error(`FAIL ${name}\n  got  ${g}\n  want ${w}`); }
};

// ---- dates
const sept = { from: '2026-09-01', to: '2026-09-30' };
eq('rangeDays', A.rangeDays(sept), 30);
eq('previousRange', A.previousRange(sept), { from: '2026-08-02', to: '2026-08-31' });
eq('monthsInRange', A.monthsInRange({ from: '2026-07-15', to: '2026-09-02' }), ['2026-07', '2026-08', '2026-09']);
eq('monthsInRange across years', A.monthsInRange({ from: '2025-11-10', to: '2026-02-01' }), ['2025-11', '2025-12', '2026-01', '2026-02']);
eq('inRange edge from', A.inRange('2026-09-01T00:00:00Z', sept), true);
eq('inRange edge to', A.inRange('2026-09-30T23:59:59Z', sept), true);
eq('inRange outside', A.inRange('2026-10-01T00:00:00Z', sept), false);
eq('inRange missing', A.inRange(undefined, sept), false);
eq('lastDays(7)', A.lastDays(7, new Date(2026, 9, 5)), { from: '2026-09-29', to: '2026-10-05' });
eq('delta', A.delta(12, 10), { diff: 2, pct: 20 });
eq('delta from zero', A.delta(5, 0), { diff: 5, pct: null });
eq('delta decrease', A.delta(3, 4), { diff: -1, pct: -25 });

// ---- funnel
const L = (id, status, created, extra = {}) => ({ id, status, created_at: created + 'T08:00:00Z', estimated_seats: 2, ...extra });
const leads = [
  L('L1', 'Selesai Training', '2026-09-02', { confirmed_seats: 4 }),
  L('L2', 'Terdaftar', '2026-09-05', { confirmed_seats: 5 }),
  L('L3', 'Batal', '2026-09-10', { cancel_reason: 'Anggaran dibatalkan' }),
  L('L4', 'Waiting List', '2026-09-12', { waiting_reason: 'Reschedule', confirmed_seats: 3 }),
  L('L5', 'Baru', '2026-09-20'),
  L('L6', 'Batal', '2026-09-25', { cancel_reason: ' anggaran  dibatalkan ' }),
  L('L7', 'Terdaftar', '2026-08-15', { confirmed_seats: 2 }),
  L('L8', 'Baru', '2026-07-01'),
];
const act = (lead, status, day) => ({ lead_id: lead, new_status: status, created_at: day + 'T10:00:00Z' });
const activities = [
  act('L1', 'Jadwal Ditawarkan', '2026-09-03'), act('L1', 'Link Terkirim', '2026-09-04'), act('L1', 'Terdaftar', '2026-09-06'), act('L1', 'Selesai Training', '2026-09-20'),
  act('L2', 'Link Terkirim', '2026-09-06'), act('L2', 'Terdaftar', '2026-09-08'),
  act('L3', 'Jadwal Ditawarkan', '2026-09-11'), act('L3', 'Batal', '2026-09-15'),
  act('L4', 'Link Terkirim', '2026-09-13'), act('L4', 'Terdaftar', '2026-09-14'), act('L4', 'Waiting List', '2026-09-18'),
  act('L7', 'Terdaftar', '2026-08-16'),
  act('GHOST', 'Terdaftar', '2026-09-09'), // unknown lead: ignored
];
const f = A.computeFunnel(leads, activities, sept);
eq('funnel total', f.total, 6);
eq('funnel reached', f.steps.map(s => s.reached), [6, 4, 3, 3, 1]);
eq('funnel pctOfPrevious', f.steps.map(s => s.pctOfPrevious), [100, 66.7, 75, 100, 33.3]);
eq('funnel pctOfTotal', f.steps.map(s => s.pctOfTotal), [100, 66.7, 50, 50, 16.7]);
eq('funnel cancelled', [f.cancelled, f.cancelRate], [2, 33.3]);
eq('funnel waiting', f.waiting, 1);
eq('funnel registered', [f.registered, f.registerRate], [3, 50]);
eq('funnel completed', f.completed, 1);
eq('funnel seats', [f.estimatedSeats, f.confirmedSeats], [12, 12]);
eq('cancel reasons normalized', f.cancelReasons, [{ reason: 'Anggaran dibatalkan', count: 2 }]);
eq('waiting reasons', f.waitingReasons, [{ reason: 'Reschedule', count: 1 }]);
const empty = A.computeFunnel(leads, activities, { from: '2020-01-01', to: '2020-01-31' });
eq('empty funnel', [empty.total, empty.registerRate, empty.steps[0].pctOfPrevious], [0, 0, 0]);
const prev = A.computeFunnel(leads, activities, A.previousRange(sept));
eq('previous cohort', [prev.total, prev.registered], [1, 1]);

// ---- sla
const C = (id, status, age, pic, extra = {}) => ({ id, status, sla_age_days: age, trainings: { pic }, created_at: '2026-08-01T00:00:00Z', ...extra });
const certs = [
  C('c1', 'Completed', 3, 'A', { updated_at: '2026-09-28T00:00:00Z' }),
  C('c2', 'Printing', 10, 'A'),
  C('c3', 'Processing', 8, 'B'),
  C('c4', 'Pending', 2, 'B'),
  C('c5', 'Completed', 20, 'B', { updated_at: '2026-09-28T00:00:00Z' }),
];
const s = A.computeSla(certs, 7);
eq('sla totals', [s.total, s.completed, s.open, s.overdue], [5, 2, 3, 2]);
eq('sla rates', [s.overdueRate, s.compliance, s.avgOpenAge], [66.7, 40, 6.7]);
eq('sla status', s.statusCounts, { Pending: 1, Processing: 1, Printing: 1, Completed: 2 });
eq('sla overdueByStage', s.overdueByStage, { Pending: 0, Processing: 1, Printing: 1 });
eq('sla byPic', s.byPic, [
  { name: 'B', total: 3, completed: 1, overdue: 1, avgAge: 10, compliance: 33.3 },
  { name: 'A', total: 2, completed: 1, overdue: 1, avgAge: 6.5, compliance: 50 },
]);
eq('sla no certs', A.computeSla([], 7).overdueRate, 0);

// ---- completion + trend + summary
const histories = [
  { certificate_id: 'c1', new_status: 'Completed', created_at: '2026-09-15T00:00:00Z' },
  { certificate_id: 'c1', new_status: 'Completed', created_at: '2026-09-27T00:00:00Z' }, // later duplicate: first wins
  { certificate_id: 'c5', new_status: 'Completed', created_at: '2026-08-20T00:00:00Z' },
  { certificate_id: 'c2', new_status: 'Printing', created_at: '2026-09-10T00:00:00Z' },
];
const done = A.completionDates(certs, histories);
eq('completionDates c1 first event', done.get('c1'), '2026-09-15T00:00:00Z');
eq('completionDates c5 history beats updated_at', done.get('c5'), '2026-08-20T00:00:00Z');
eq('completionDates only completed', [...done.keys()].sort(), ['c1', 'c5']);
const trend = A.computeTrend(leads, activities, certs, histories, sept);
eq('trend sept', trend, [{ month: '2026-09', leadsIn: 6, registrations: 3, certsCompleted: 1 }]);
const trend2 = A.computeTrend(leads, activities, certs, histories, { from: '2026-08-01', to: '2026-09-30' });
eq('trend aug-sept', trend2, [
  { month: '2026-08', leadsIn: 1, registrations: 1, certsCompleted: 1 },
  { month: '2026-09', leadsIn: 6, registrations: 3, certsCompleted: 1 },
]);
const cur = A.summarizePeriod(leads, activities, certs, histories, sept);
const before = A.summarizePeriod(leads, activities, certs, histories, A.previousRange(sept));
eq('summary current', cur, { leadsIn: 6, registerRate: 50, cancelRate: 33.3, confirmedSeats: 12, certsCompleted: 1 });
eq('summary previous', before, { leadsIn: 1, registerRate: 100, cancelRate: 0, confirmedSeats: 2, certsCompleted: 1 });

if (failed) { console.error(`${failed} analytics checks FAILED`); process.exit(1); }
console.log('analytics: all checks passed');
