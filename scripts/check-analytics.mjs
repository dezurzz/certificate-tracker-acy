// Checks src/lib/analytics.ts against a small hand-computed fixture.
// Run: npm run analytics:check
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const source = readFileSync(fileURLToPath(new URL('../src/lib/analytics.ts', import.meta.url)), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const A = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const insightsSource = readFileSync(fileURLToPath(new URL('../src/lib/executive/insights.ts', import.meta.url)), 'utf8');
const insightsJs = ts.transpileModule(insightsSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const I = await import('data:text/javascript;base64,' + Buffer.from(insightsJs).toString('base64'));
const ageSource = readFileSync(fileURLToPath(new URL('../src/lib/certAge.ts', import.meta.url)), 'utf8');
const ageJs = ts.transpileModule(ageSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const AGE = await import('data:text/javascript;base64,' + Buffer.from(ageJs).toString('base64'));
const statusSource = readFileSync(fileURLToPath(new URL('../src/lib/certStatus.ts', import.meta.url)), 'utf8');
const statusJs = ts.transpileModule(statusSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const ST = await import('data:text/javascript;base64,' + Buffer.from(statusJs).toString('base64'));
const copySource = readFileSync(fileURLToPath(new URL('../src/lib/executive/insightCopy.ts', import.meta.url)), 'utf8');
const copyJs = ts.transpileModule(copySource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const C_ = await import('data:text/javascript;base64,' + Buffer.from(copyJs).toString('base64'));

let failed = 0;
let total = 0;
const eq = (name, got, want) => {
  total++;
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
  L('L1', 'Selesai Training', '2026-09-02', { confirmed_seats: 4, source: 'WA Bisnis', program_name: 'A' }),
  L('L2', 'Terdaftar', '2026-09-05', { confirmed_seats: 5, source: 'Website', program_name: 'A' }),
  L('L3', 'Batal', '2026-09-10', { cancel_reason: 'Anggaran dibatalkan', source: 'WA Bisnis', program_name: 'B' }),
  L('L4', 'Waiting List', '2026-09-12', { waiting_reason: 'Reschedule', confirmed_seats: 3, source: 'Referral', program_name: 'B', next_follow_up_date: '2026-10-10' }),
  L('L5', 'Baru', '2026-09-20', { source: 'Website', program_name: 'C', next_follow_up_date: '2026-10-01' }),
  L('L6', 'Batal', '2026-09-25', { cancel_reason: ' anggaran  dibatalkan ', source: 'WA Bisnis', program_name: 'C' }),
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
const C = (id, status, age, training, participant, extra = {}) => ({ id, status, sla_age_days: age, training_id: training, participant_id: participant, created_at: '2026-08-01T00:00:00Z', ...extra });
const certs = [
  C('c1', 'Completed', 3, 't1', 'p1', { updated_at: '2026-09-28T00:00:00Z' }),
  C('c2', 'Printing', 10, 't1', 'p2'),
  C('c3', 'Processing', 8, 't1', 'p3'),
  C('c4', 'Pending', 2, 't2', 'p4'),
  C('c5', 'Completed', 20, 't2', 'p1', { updated_at: '2026-09-28T00:00:00Z' }),
];
const s = A.computeSla(certs, 7);
eq('sla totals', [s.total, s.completed, s.open, s.overdue], [5, 2, 3, 2]);
eq('sla rates', [s.overdueRate, s.compliance, s.avgOpenAge], [66.7, 40, 6.7]);
eq('sla status', s.statusCounts, { Pending: 1, Processing: 1, Printing: 1, Completed: 2 });
eq('sla overdueByStage', s.overdueByStage, { Pending: 0, Processing: 1, Printing: 1 });
eq('sla no certs', A.computeSla([], 7).overdueRate, 0);

// ---- lead diagnostics
eq('sources', A.computeSourceBreakdown(leads, activities, sept), [
  { source: 'WA Bisnis', leads: 3, registered: 1, rate: 33.3 },
  { source: 'Website', leads: 2, registered: 1, rate: 50 },
  { source: 'Referral', leads: 1, registered: 1, rate: 100 },
]);
eq('programs', A.computeProgramBreakdown(leads, activities, sept), [
  { program: 'A', leads: 2, seats: 4, registered: 2, rate: 100 },
  { program: 'B', leads: 2, seats: 4, registered: 1, rate: 50 },
  { program: 'C', leads: 2, seats: 4, registered: 0, rate: 0 },
]);
eq('median days to register', A.medianDaysToRegister(leads, activities, sept), { median: 3.1, n: 3 });
eq('median with no registrations', A.medianDaysToRegister(leads, activities, { from: '2020-01-01', to: '2020-01-31' }), { median: null, n: 0 });
eq('stale leads', A.computeStaleLeads(leads, activities, '2026-10-05', 7), { open: 3, stale: 3, overdueFollowUps: 1, oldestDays: 96 });
eq('stale leads with a long threshold', A.computeStaleLeads(leads, activities, '2026-10-05', 30).stale, 1);
eq('average batch size', A.averageBatchSize(certs), 2.5);
eq('average batch size unknown', A.averageBatchSize([]), null);
eq('waiting opportunity', A.computeWaitingOpportunity(leads, 2.5), { leads: 1, seats: 2, batches: 0.8, topProgram: 'B', topProgramSeats: 2 });
eq('sla compliant count', s.compliant, 2);
eq('waiting opportunity without batch size', A.computeWaitingOpportunity(leads, null).batches, null);

// ---- certificate diagnostics
const augsep = { from: '2026-08-01', to: '2026-09-30' };
const hist0 = [
  { certificate_id: 'c1', new_status: 'Completed', created_at: '2026-09-15T00:00:00Z' },
  { certificate_id: 'c5', new_status: 'Completed', created_at: '2026-08-20T00:00:00Z' },
];
const flow = A.computeCertFlow(certs, hist0, augsep, '2026-10-05');
eq('flow monthly', flow.monthly, [{ month: '2026-08', inflow: 5, outflow: 1 }, { month: '2026-09', inflow: 0, outflow: 1 }]);
eq('flow totals', [flow.inflowInRange, flow.outflowInRange, flow.backlog], [5, 2, 3]);
eq('flow pace', [flow.weeklyRate, flow.daysToClear, flow.backlogGrowing], [0.3, 84, true]);
eq('flow with no movement', A.computeCertFlow(certs, hist0, { from: '2020-01-01', to: '2020-02-01' }, '2026-10-05').backlogGrowing, null);
eq('flow no recent completions', A.computeCertFlow(certs, hist0, augsep, '2027-03-01').daysToClear, null);
eq('aging sla 7', A.computeAgingBuckets(certs, 7), { open: 3, withinSla: 1, upTo2x: 2, over2x: 0, oldestDays: 10 });
eq('aging sla 4', A.computeAgingBuckets(certs, 4), { open: 3, withinSla: 1, upTo2x: 1, over2x: 1, oldestDays: 10 });
const stageHist = [
  { certificate_id: 'X', new_status: 'Pending', created_at: '2026-09-01T00:00:00Z' },
  { certificate_id: 'X', new_status: 'Processing', created_at: '2026-09-03T00:00:00Z' },
  { certificate_id: 'X', new_status: 'Printing', created_at: '2026-09-08T00:00:00Z' },
  { certificate_id: 'X', new_status: 'Completed', created_at: '2026-09-09T00:00:00Z' },
  { certificate_id: 'Y', new_status: 'Printing', created_at: '2026-09-05T00:00:00Z' }, // arrives out of order
  { certificate_id: 'Y', new_status: 'Pending', created_at: '2026-09-02T00:00:00Z' },
  { certificate_id: 'Y', new_status: 'Processing', created_at: '2026-09-04T00:00:00Z' },
];
eq('stage durations', A.computeStageDurations(stageHist), [
  { stage: 'Pending', avgDays: 2, n: 2 },
  { stage: 'Processing', avgDays: 3, n: 2 },
  { stage: 'Printing', avgDays: 1, n: 1 },
]);
eq('stage durations without history', A.computeStageDurations([]), [
  { stage: 'Pending', avgDays: 0, n: 0 }, { stage: 'Processing', avgDays: 0, n: 0 }, { stage: 'Printing', avgDays: 0, n: 0 },
]);

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


// ---- insight engine (executive dashboard)
const baseInput = () => ({
  targets: { conversionPct: 40, cancelMaxPct: 25, slaCompliancePct: 90, staleDays: 7, minSample: 5 },
  slaDays: 4,
  funnel: {
    total: 10, registered: 7, registerRate: 70, cancelled: 1, cancelRate: 10, cancelReasons: [{ reason: 'Anggaran', count: 1 }],
    steps: [
      { stage: 'Baru', reached: 10, pctOfPrevious: 100 }, { stage: 'Jadwal Ditawarkan', reached: 9, pctOfPrevious: 90 },
      { stage: 'Link Terkirim', reached: 8, pctOfPrevious: 88.9 }, { stage: 'Terdaftar', reached: 7, pctOfPrevious: 87.5 },
      { stage: 'Selesai Training', reached: 5, pctOfPrevious: 71.4 },
    ],
  },
  cur: { leadsIn: 10, certsCompleted: 100 }, prev: { leadsIn: 8, certsCompleted: 80 },
  sources: [{ source: 'WA Bisnis', leads: 5, rate: 40 }, { source: 'Website', leads: 5, rate: 40 }],
  medianDays: { median: 5, n: 5 },
  stale: { open: 3, stale: 0, overdueFollowUps: 0, oldestDays: 0 },
  waiting: { leads: 0, seats: 0, batches: null, topProgram: null, topProgramSeats: 0 },
  sla: { total: 276, open: 196, overdue: 0, compliance: 100, compliant: 276, overdueByStage: { Pending: 0, Processing: 0, Printing: 0 } },
  aging: { open: 196, withinSla: 196, upTo2x: 0, over2x: 0, oldestDays: 3 },
  pipeline: { total: 276, notPrinted: 176, printed: 20, completed: 80, open: 196, printedShareOfOpen: 10.2, oldestPrintedDays: 2 },
  flow: { backlog: 196, weeklyRate: 70, daysToClear: 20, inflowInRange: 10, outflowInRange: 80, backlogGrowing: false },
  stages: [{ stage: 'Pending', avgDays: 2, n: 10 }, { stage: 'Processing', avgDays: 2.2, n: 10 }, { stage: 'Printing', avgDays: 2.1, n: 10 }],
});
const codes = list => list.map(i => `${i.code}:${i.severity}`).sort();
const find = (list, code) => list.find(i => i.code === code);

const healthy = I.buildInsights(baseInput());
eq('healthy: findings', codes(healthy), ['backlog:good', 'cancel_rate:good', 'conversion:good', 'demand_trend:good', 'sla_compliance:good', 'throughput_trend:good']);
eq('healthy: overall', I.overallStatus(healthy), 'healthy');
eq('healthy: no decisions', I.decisionsNeeded(healthy), []);
eq('healthy: key findings are 3 of them', I.keyFindings(healthy).length, 3);

const bad = baseInput();
bad.funnel = {
  ...bad.funnel, registered: 2, registerRate: 20, cancelled: 6, cancelRate: 60,
  cancelReasons: [{ reason: 'Anggaran', count: 4 }, { reason: 'Provider lain', count: 2 }],
  steps: [
    { stage: 'Baru', reached: 10, pctOfPrevious: 100 }, { stage: 'Jadwal Ditawarkan', reached: 4, pctOfPrevious: 40 },
    { stage: 'Link Terkirim', reached: 3, pctOfPrevious: 75 }, { stage: 'Terdaftar', reached: 2, pctOfPrevious: 66.7 },
    { stage: 'Selesai Training', reached: 1, pctOfPrevious: 50 },
  ],
};
const risky = I.buildInsights(bad);
eq('risky: conversion', find(risky, 'conversion'), { code: 'conversion', area: 'leads', severity: 'risk', impact: 2, params: { rate: 20, target: 40, total: 10, registered: 2, lostLeads: 2, prevRate: null, deltaPts: null, bestSource: 'WA Bisnis', bestSourceRate: 40 } });
eq('risky: biggest leak is Baru -> Jadwal Ditawarkan', find(risky, 'funnel_leak').params, { from: 'Baru', to: 'Jadwal Ditawarkan', lost: 6, dropPct: 60, fromReached: 10, shareOfLosses: 75 });
eq('risky: leak is a risk at >= 50% drop', find(risky, 'funnel_leak').severity, 'risk');
eq('risky: cancel reason named when cancelled >= minSample', find(risky, 'cancel_rate').params, { rate: 60, max: 25, cancelled: 6, topReason: 'Anggaran', topReasonCount: 4, topReasonShare: 67, secondReason: 'Provider lain', secondReasonCount: 2, excess: 4, total: 10 });
eq('risky: overall needs action', I.overallStatus(risky), 'action');
eq('risky: decisions are risks, biggest first', I.decisionsNeeded(risky).map(i => i.code), ['funnel_leak', 'cancel_rate', 'conversion']);
eq('risky: risks outrank good news', risky.slice(0, 3).every(i => i.severity === 'risk'), true);

const near = baseInput(); near.funnel = { ...near.funnel, registered: 4, registerRate: 36 };
eq('conversion within 5 pts of target is a watch item', find(I.buildInsights(near), 'conversion').severity, 'watch');
const noReason = baseInput(); noReason.funnel = { ...noReason.funnel, cancelled: 3, cancelRate: 30 };
eq('cancel reason hidden below minSample', find(I.buildInsights(noReason), 'cancel_rate').params.topReason, null);

const thin = baseInput(); thin.funnel = { ...thin.funnel, total: 3 }; thin.sla = { ...thin.sla, total: 2 }; thin.prev = { leadsIn: 1, certsCompleted: 1 };
thin.flow = { ...thin.flow, backlog: 0 }; thin.stale = { open: 0, stale: 0, overdueFollowUps: 0, oldestDays: 0 };
const thinList = I.buildInsights(thin);
eq('low sample: only "not enough data" notes', codes(thinList), ['low_sample_cert:info', 'low_sample_leads:info']);
eq('low sample: overall is insufficient', I.overallStatus(thinList), 'insufficient');

const demand = baseInput(); demand.cur = { leadsIn: 6, certsCompleted: 100 };
eq('demand down 25% is a risk', find(I.buildInsights(demand), 'demand_trend').severity, 'risk');
const demandSmall = baseInput(); demandSmall.cur = { leadsIn: 8, certsCompleted: 100 }; demandSmall.prev = { leadsIn: 8, certsCompleted: 80 };
eq('flat demand produces no demand insight', find(I.buildInsights(demandSmall), 'demand_trend'), undefined);
const demandNoBase = baseInput(); demandNoBase.prev = { leadsIn: 3, certsCompleted: 80 };
eq('demand trend ignored when the previous period is too small', find(I.buildInsights(demandNoBase), 'demand_trend'), undefined);

const w = baseInput(); w.waiting = { leads: 2, seats: 6, batches: 0.4, topProgram: 'K3 Migas', topProgramSeats: 4 };
eq('waiting list opportunity', find(I.buildInsights(w), 'waiting_opportunity').params, { leads: 2, seats: 6, batches: 0.4, topProgram: 'K3 Migas', topProgramSeats: 4 });

for (const [stale, open, sev] of [[2, 4, 'risk'], [1, 8, 'watch'], [1, 40, 'info']]) {
  const x = baseInput(); x.stale = { open, stale, overdueFollowUps: 1, oldestDays: 30 };
  eq(`idle leads ${stale}/${open}`, find(I.buildInsights(x), 'stale_leads').severity, sev);
}

const gap = baseInput(); gap.sources = [{ source: 'WA Bisnis', leads: 6, rate: 10 }, { source: 'Website', leads: 6, rate: 30 }, { source: 'Event', leads: 2, rate: 100 }];
eq('source gap ignores sources below minSample', find(I.buildInsights(gap), 'source_gap').params, { best: 'Website', bestRate: 30, worst: 'WA Bisnis', worstRate: 10, worstLeads: 6, extra: 1 });
const noGap = baseInput(); noGap.sources = [{ source: 'A', leads: 6, rate: 30 }, { source: 'B', leads: 6, rate: 20 }];
eq('no source gap under 2x', find(I.buildInsights(noGap), 'source_gap'), undefined);

const slow = baseInput(); slow.medianDays = { median: 25, n: 6 };
eq('slow conversion', find(I.buildInsights(slow), 'slow_conversion').severity, 'watch');

for (const [compliance, sev] of [[95, 'good'], [85, 'watch'], [70, 'risk']]) {
  const x = baseInput(); x.sla = { ...x.sla, compliance, overdue: 5 };
  eq(`SLA compliance ${compliance}%`, find(I.buildInsights(x), 'sla_compliance').severity, sev);
}
const aged = baseInput(); aged.aging = { open: 10, withinSla: 4, upTo2x: 4, over2x: 2, oldestDays: 13 };
eq('aging beyond 2x SLA is a risk', find(I.buildInsights(aged), 'overdue_aging'), { code: 'overdue_aging', area: 'cert', severity: 'risk', impact: 10, params: { over2x: 2, upTo2x: 4, open: 10, slaDays: 4, oldestDays: 13 } });
const aged2 = baseInput(); aged2.aging = { open: 10, withinSla: 6, upTo2x: 4, over2x: 0, oldestDays: 6 };
eq('aging within 2x SLA is a watch item', find(I.buildInsights(aged2), 'overdue_aging').severity, 'watch');

for (const [days, growing, sev] of [[null, false, 'risk'], [70, false, 'risk'], [40, false, 'watch'], [20, true, 'watch'], [20, false, 'good']]) {
  const x = baseInput(); x.flow = { ...x.flow, daysToClear: days, backlogGrowing: growing };
  eq(`backlog days=${days} growing=${growing}`, find(I.buildInsights(x), 'backlog').severity, sev);
}

const bn = baseInput(); bn.stages = [{ stage: 'Pending', avgDays: 1, n: 10 }, { stage: 'Processing', avgDays: 4, n: 10 }, { stage: 'Printing', avgDays: 1.5, n: 10 }];
eq('bottleneck by measured time', find(I.buildInsights(bn), 'bottleneck').params, { stage: 'Processing', avgDays: 4, n: 10, otherAvgDays: 1.5, mode: 'duration', count: null, shareOfTotal: 62 });
const tiny = baseInput(); tiny.stages = [{ stage: 'Pending', avgDays: 0, n: 10 }, { stage: 'Processing', avgDays: 0.9, n: 10 }, { stage: 'Printing', avgDays: 0, n: 10 }];
eq('no bottleneck when every stage takes under a day', find(I.buildInsights(tiny), 'bottleneck'), undefined);
const bn2 = baseInput(); bn2.stages = [{ stage: 'Pending', avgDays: 1, n: 2 }, { stage: 'Processing', avgDays: 4, n: 2 }, { stage: 'Printing', avgDays: 1.5, n: 1 }];
bn2.sla = { ...bn2.sla, overdueByStage: { Pending: 0, Processing: 3, Printing: 1 } };
eq('bottleneck falls back to overdue counts when history is thin', find(I.buildInsights(bn2), 'bottleneck').params, { stage: 'Processing', avgDays: null, n: 0, otherAvgDays: null, mode: 'overdue', count: 3 });

const tp = baseInput(); tp.cur = { leadsIn: 10, certsCompleted: 50 };
eq('completions down 37.5%', find(I.buildInsights(tp), 'throughput_trend').severity, 'watch');

const mixed = baseInput(); mixed.sla = { ...mixed.sla, compliance: 85, overdue: 5 }; mixed.waiting = { leads: 1, seats: 3, batches: 0.3, topProgram: null, topProgramSeats: 0 }; mixed.demand = undefined;
mixed.stale = { open: 4, stale: 1, overdueFollowUps: 0, oldestDays: 9 };
eq('three watch items make "attention"', I.overallStatus(I.buildInsights(mixed)), 'attention');

// ---- specific parameters that make the wording data-driven
const prevF = baseInput(); prevF.funnel = { ...prevF.funnel, registered: 2, registerRate: 20 }; prevF.prevFunnel = { total: 8, registerRate: 37.5 };
const cv = find(I.buildInsights(prevF), 'conversion');
eq('conversion compares with the previous period', [cv.params.prevRate, cv.params.deltaPts], [37.5, -17.5]);
const prevSmall = baseInput(); prevSmall.prevFunnel = { total: 3, registerRate: 100 };
eq('previous period ignored below minSample', find(I.buildInsights(prevSmall), 'conversion').params.deltaPts, null);

const bk = baseInput(); bk.flow = { ...bk.flow, backlog: 196, weeklyRate: 7.3, daysToClear: 189, backlogGrowing: true };
eq('backlog: weekly rate needed to clear in 30 days', [find(I.buildInsights(bk), 'backlog').params.requiredWeeklyRate30, find(I.buildInsights(bk), 'backlog').params.paceFactor], [46, 6.3]);
const bk0 = baseInput(); bk0.flow = { ...bk0.flow, backlog: 20, weeklyRate: 0, daysToClear: null, backlogGrowing: true };
eq('backlog: no pace factor without completions', find(I.buildInsights(bk0), 'backlog').params.paceFactor, null);

const sl = baseInput(); sl.sla = { total: 100, open: 40, overdue: 30, compliance: 70, compliant: 70, overdueByStage: { Pending: 5, Processing: 20, Printing: 5 } };
const slp = find(I.buildInsights(sl), 'sla_compliance').params;
eq('sla: how far from the target', [slp.lateNow, slp.allowedLate, slp.worstStage, slp.worstStageCount], [30, 10, 'Processing', 20]);

const dn = baseInput(); dn.cur = { leadsIn: 6, certsCompleted: 100 }; dn.waiting = { leads: 2, seats: 5, batches: 0.5, topProgram: 'K3', topProgramSeats: 5 };
eq('demand trend names the biggest source and the waiting seats', [find(I.buildInsights(dn), 'demand_trend').params.topSource, find(I.buildInsights(dn), 'demand_trend').params.waitingSeats], ['WA Bisnis', 5]);

// ---- certificate age is computed from dates (the stored column is never updated)
const now = new Date('2026-10-07T12:00:00Z');
eq('age: open certificate counts until now', AGE.certificateAgeDays({ status: 'Printing', created_at: '2026-08-27T09:00:00Z' }, now), 41);
eq('age: completed certificate stops at completion', AGE.certificateAgeDays({ status: 'Completed', created_at: '2026-08-27T09:00:00Z', updated_at: '2026-08-31T09:00:00Z' }, now), 4);
eq('age: missing creation date is 0', AGE.certificateAgeDays({ status: 'Pending' }, now), 0);
eq('age: never negative', AGE.certificateAgeDays({ status: 'Completed', created_at: '2026-09-02T00:00:00Z', updated_at: '2026-09-01T00:00:00Z' }, now), 0);
eq('age: replaces the stale stored value', AGE.withComputedAge([{ status: 'Pending', created_at: '2026-10-05T00:00:00Z', sla_age_days: 0 }], now)[0].sla_age_days, 2);

// ---- what moving a certificate does to its print/send fields (null clears; undefined would keep the old value)
const T0 = '2026-10-09T08:00:00Z';
eq('status: Pending clears everything', ST.printFieldsFor('Pending', 'Dewi', T0), { printed_at: null, printed_by: null, sent_at: null, sent_by: null });
eq('status: Processing clears everything (moving back un-prints)', ST.printFieldsFor('Processing', 'Dewi', T0), { printed_at: null, printed_by: null, sent_at: null, sent_by: null });
eq('status: Printing is printed, not sent', ST.printFieldsFor('Printing', 'Dewi', T0), { printed_at: T0, printed_by: 'Dewi', sent_at: null, sent_by: null });
eq('status: Completed is printed and sent', ST.printFieldsFor('Completed', 'Dewi', T0), { printed_at: T0, printed_by: 'Dewi', sent_at: T0, sent_by: 'Dewi' });

// ---- print pipeline
const pc = (id, status, printed) => ({ id, status, sla_age_days: 0, printed_at: printed ?? null });
const pipe = A.computeCertPipeline([pc('a', 'Pending'), pc('b', 'Processing', '2026-09-20T00:00:00Z'), pc('c', 'Printing', '2026-09-25T10:00:00Z'), pc('d', 'Printing', '2026-10-03T10:00:00Z'), pc('e', 'Completed', '2026-09-01T00:00:00Z')], '2026-10-05');
eq('pipeline counts', pipe, { total: 5, notPrinted: 2, pending: 1, processing: 1, printed: 2, completed: 1, open: 4, printedShareOfOpen: 50, oldestPrintedDays: 10 });
eq('pipeline without certificates', A.computeCertPipeline([], '2026-10-05').printedShareOfOpen, 0);
const hold = baseInput(); hold.pipeline = { total: 276, notPrinted: 55, printed: 131, completed: 80, open: 186, printedShareOfOpen: 70.4, oldestPrintedDays: 22 };
eq('pipeline hold: mostly printed backlog is a risk', find(I.buildInsights(hold), 'pipeline_hold').severity, 'risk');
const hold2 = baseInput(); hold2.pipeline = { total: 100, notPrinted: 30, printed: 25, completed: 45, open: 55, printedShareOfOpen: 45.5, oldestPrintedDays: 3 };
eq('pipeline hold: 45% printed is a watch item', find(I.buildInsights(hold2), 'pipeline_hold').severity, 'watch');
eq('pipeline hold: not raised for a small share', find(I.buildInsights(baseInput()), 'pipeline_hold'), undefined);
const few = baseInput(); few.pipeline = { total: 20, notPrinted: 4, printed: 4, completed: 12, open: 8, printedShareOfOpen: 50, oldestPrintedDays: 2 };
eq('pipeline hold: ignored under minSample', find(I.buildInsights(few), 'pipeline_hold'), undefined);

// ---- the wording: every placeholder is filled and the text follows the data
const fakeT = (text, p = {}) => text.replace(/\{(\w+)\}/g, (_, k) => (k in p ? String(p[k]) : `{${k}}`));
const everything = baseInput();
Object.assign(everything, {
  funnel: bad.funnel, prevFunnel: { total: 9, registerRate: 44 }, cur: { leadsIn: 6, certsCompleted: 50 }, prev: { leadsIn: 10, certsCompleted: 100 },
  sources: gap.sources, medianDays: { median: 25, n: 6 },
  stale: { open: 10, stale: 4, overdueFollowUps: 2, oldestDays: 74 },
  waiting: { leads: 3, seats: 9, batches: 1.2, topProgram: 'K3 Migas', topProgramSeats: 6 },
  sla: { total: 100, open: 40, overdue: 30, compliance: 70, compliant: 70, overdueByStage: { Pending: 5, Processing: 20, Printing: 5 } },
  aging: { open: 40, withinSla: 20, upTo2x: 10, over2x: 10, oldestDays: 13 },
  pipeline: { total: 276, notPrinted: 55, printed: 131, completed: 80, open: 186, printedShareOfOpen: 70.4, oldestPrintedDays: 22 },
  flow: { backlog: 196, weeklyRate: 7.3, daysToClear: 189, inflowInRange: 276, outflowInRange: 80, backlogGrowing: true },
  stages: bn.stages,
});
const all = I.buildInsights(everything);
const leftovers = [];
for (const ins of all) {
  const c = C_.insightCopy(fakeT, ins);
  for (const [field, text] of Object.entries(c)) if (typeof text === 'string' && /\{\w+\}|undefined|NaN|null/.test(text)) leftovers.push(`${ins.code}.${field}: ${text}`);
}
eq('wording: every insight has all its figures filled in', leftovers, []);
eq('wording: every insight has headline, why and action', all.every(i => { const c = C_.insightCopy(fakeT, i); return c.headline && c.why && c.action; }), true);
eq('wording: all rule codes were exercised', [...new Set(all.map(i => i.code))].sort(),
  ['backlog', 'bottleneck', 'cancel_rate', 'conversion', 'demand_trend', 'funnel_leak', 'overdue_aging', 'pipeline_hold', 'slow_conversion', 'source_gap', 'sla_compliance', 'stale_leads', 'throughput_trend', 'waiting_opportunity'].sort());
eq('wording: decisions never repeat the action', all.every(i => { const c = C_.insightCopy(fakeT, i); return !c.decision || c.decision !== c.action; }), true);

const copyOf = (input, code) => C_.insightCopy(fakeT, find(I.buildInsights(input), code));
const bkText = copyOf(bk, 'backlog');
eq('wording: backlog states the pace needed', bkText.why.includes('46') && bkText.action.includes('46') && bkText.why.includes('6.3'), true);
const bkSmall = baseInput(); bkSmall.flow = { ...bkSmall.flow, backlog: 60, weeklyRate: 5, daysToClear: 84, backlogGrowing: true };
eq('wording: a different backlog gives different sentences', copyOf(bkSmall, 'backlog').action !== bkText.action, true);
const leakTo = to => { const x = baseInput(); x.funnel = { ...bad.funnel, steps: bad.funnel.steps.map(s => ({ ...s })) }; return C_.insightCopy(fakeT, { code: 'funnel_leak', area: 'leads', severity: 'risk', impact: 5, params: { from: 'Baru', to, lost: 5, dropPct: 50, fromReached: 10, shareOfLosses: 60 } }).action; };
eq('wording: the funnel action depends on the stage', new Set(['Jadwal Ditawarkan', 'Link Terkirim', 'Terdaftar', 'Selesai Training'].map(leakTo)).size, 4);
const stale2 = copyOf(everything, 'stale_leads');
eq('wording: stale leads name the oldest age', stale2.action.includes('74') && stale2.evidence.includes('74'), true);
eq('wording: waiting list names the biggest program', copyOf(everything, 'waiting_opportunity').action.includes('K3 Migas'), true);
eq('wording: the headline stays a conclusion with numbers', /\d/.test(copyOf(everything, 'conversion').headline), true);

if (failed) { console.error(`${failed} analytics checks FAILED`); process.exit(1); }
console.log(`analytics: all ${total} checks passed`);
