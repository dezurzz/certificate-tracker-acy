/**
 * Pure analytics for the executive dashboard: lead funnel, SLA performance and period trends.
 * No React, no i18n, no database: it takes plain rows, so it can be unit-checked
 * (`npm run analytics:check`) and reused by other reports.
 *
 * Dates are calendar days as 'YYYY-MM-DD' (first 10 chars of an ISO timestamp).
 */

export interface LeadLike {
  id: string;
  status: string;
  created_at: string;
  estimated_seats?: number;
  confirmed_seats?: number | null;
  waiting_reason?: string | null;
  cancel_reason?: string | null;
  source?: string;
  program_name?: string;
  next_follow_up_date?: string | null;
}
export interface ActivityLike {
  lead_id: string;
  new_status?: string | null;
  created_at: string;
}
export interface CertLike {
  id: string;
  status: string;
  sla_age_days: number;
  created_at?: string;
  updated_at?: string;
  training_id?: string;
  participant_id?: string;
  printed_at?: string | null;
}
export interface HistoryLike {
  certificate_id: string;
  new_status: string;
  previous_status?: string | null;
  created_at: string;
}

export interface DateRange {
  from: string;
  to: string;
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

export const dayKey = (iso?: string | null) => (iso ? iso.slice(0, 10) : '');

const toDate = (key: string) => new Date(key + 'T00:00:00Z');
const toKey = (d: Date) => d.toISOString().slice(0, 10);
const DAY_MS = 24 * 3600 * 1000;

export function inRange(iso: string | null | undefined, range: DateRange): boolean {
  const k = dayKey(iso);
  return k !== '' && k >= range.from && k <= range.to;
}

export function rangeDays(range: DateRange): number {
  return Math.round((toDate(range.to).getTime() - toDate(range.from).getTime()) / DAY_MS) + 1;
}

/** The period of the same length that ends the day before `range` starts. */
export function previousRange(range: DateRange): DateRange {
  const days = rangeDays(range);
  const prevTo = new Date(toDate(range.from).getTime() - DAY_MS);
  const prevFrom = new Date(prevTo.getTime() - (days - 1) * DAY_MS);
  return { from: toKey(prevFrom), to: toKey(prevTo) };
}

/** Last `days` days ending today (inclusive). */
export function lastDays(days: number, today = new Date()): DateRange {
  const to = toKey(new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())));
  const from = toKey(new Date(toDate(to).getTime() - (days - 1) * DAY_MS));
  return { from, to };
}

export function yearToDate(today = new Date()): DateRange {
  return {
    from: `${today.getFullYear()}-01-01`,
    to: toKey(new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))),
  };
}

/** Calendar months touched by the range, oldest first (at most `max`, keeping the most recent). */
export function monthsInRange(range: DateRange, max = 24): string[] {
  const out: string[] = [];
  let y = Number(range.from.slice(0, 4));
  let m = Number(range.from.slice(5, 7));
  const endY = Number(range.to.slice(0, 4));
  const endM = Number(range.to.slice(5, 7));
  while (y < endY || (y === endY && m <= endM)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out.slice(-max);
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

export interface Delta {
  diff: number;
  /** Percent change vs the previous value; null when the previous value is 0 (undefined growth). */
  pct: number | null;
}

export function delta(current: number, previous: number): Delta {
  const diff = current - previous;
  return { diff, pct: previous === 0 ? null : Math.round((diff / previous) * 1000) / 10 };
}

const pctOf = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

// ---------------------------------------------------------------------------
// Lead funnel
// ---------------------------------------------------------------------------

/** Linear part of the pipeline. Waiting List and Batal are side exits, not stages. */
export const FUNNEL_STAGES = ['Baru', 'Jadwal Ditawarkan', 'Link Terkirim', 'Terdaftar', 'Selesai Training'] as const;
export type FunnelStage = (typeof FUNNEL_STAGES)[number];

const stageIndex = (status?: string | null) => (status ? (FUNNEL_STAGES as readonly string[]).indexOf(status) : -1);
const REGISTERED = FUNNEL_STAGES.indexOf('Terdaftar');
const COMPLETED = FUNNEL_STAGES.indexOf('Selesai Training');

/**
 * Furthest funnel stage each lead ever reached: its current status and every status in its
 * activity log (so a lead that later went to Waiting List or Batal still counts for the stages it passed).
 */
export function maxStageByLead(leads: LeadLike[], activities: ActivityLike[]): Map<string, number> {
  const max = new Map<string, number>();
  leads.forEach(l => max.set(l.id, Math.max(0, stageIndex(l.status))));
  activities.forEach(a => {
    const cur = max.get(a.lead_id);
    if (cur === undefined) return;
    const idx = stageIndex(a.new_status);
    if (idx > cur) max.set(a.lead_id, idx);
  });
  return max;
}

export interface FunnelStep {
  stage: FunnelStage;
  reached: number;
  /** Share of all leads in the cohort. */
  pctOfTotal: number;
  /** Share of the previous stage (100 for the first). */
  pctOfPrevious: number;
}

export interface ReasonCount {
  reason: string;
  count: number;
}

export interface FunnelResult {
  total: number;
  steps: FunnelStep[];
  waiting: number;
  cancelled: number;
  cancelRate: number;
  registered: number;
  registerRate: number;
  completed: number;
  estimatedSeats: number;
  confirmedSeats: number;
  cancelReasons: ReasonCount[];
  waitingReasons: ReasonCount[];
}

function topReasons(values: (string | null | undefined)[], limit = 5): ReasonCount[] {
  const counts = new Map<string, { label: string; count: number }>();
  values.forEach(v => {
    const label = (v ?? '').trim().replace(/\s+/g, ' ');
    if (!label) return;
    const key = label.toLowerCase();
    const cur = counts.get(key);
    if (cur) cur.count++;
    else counts.set(key, { label, count: 1 });
  });
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map(c => ({ reason: c.label, count: c.count }));
}

/** Cohort funnel: the leads created inside `range`, followed through their whole history. */
export function computeFunnel(leads: LeadLike[], activities: ActivityLike[], range: DateRange): FunnelResult {
  const cohort = leads.filter(l => inRange(l.created_at, range));
  const maxStage = maxStageByLead(cohort, activities);
  const total = cohort.length;

  const steps: FunnelStep[] = FUNNEL_STAGES.map((stage, k) => {
    const reached = cohort.filter(l => (maxStage.get(l.id) ?? 0) >= k).length;
    return { stage, reached, pctOfTotal: pctOf(reached, total), pctOfPrevious: 0 };
  });
  steps.forEach((s, k) => {
    s.pctOfPrevious = k === 0 ? (total > 0 ? 100 : 0) : pctOf(s.reached, steps[k - 1].reached);
  });

  const cancelledLeads = cohort.filter(l => l.status === 'Batal');
  const waitingLeads = cohort.filter(l => l.status === 'Waiting List');
  const registeredLeads = cohort.filter(l => (maxStage.get(l.id) ?? 0) >= REGISTERED);

  return {
    total,
    steps,
    waiting: waitingLeads.length,
    cancelled: cancelledLeads.length,
    cancelRate: pctOf(cancelledLeads.length, total),
    registered: steps[REGISTERED].reached,
    registerRate: pctOf(steps[REGISTERED].reached, total),
    completed: steps[COMPLETED].reached,
    estimatedSeats: cohort.reduce((a, l) => a + (l.estimated_seats || 0), 0),
    confirmedSeats: registeredLeads.reduce((a, l) => a + (l.confirmed_seats || 0), 0),
    cancelReasons: topReasons(cancelledLeads.map(l => l.cancel_reason)),
    waitingReasons: topReasons(waitingLeads.map(l => l.waiting_reason)),
  };
}

// ---------------------------------------------------------------------------
// Certificates / SLA
// ---------------------------------------------------------------------------

export interface SlaResult {
  total: number;
  completed: number;
  open: number;
  overdue: number;
  /** Overdue share of the certificates still in progress. */
  overdueRate: number;
  /** Share of all certificates within the SLA threshold. */
  compliance: number;
  /** Number of certificates within the SLA threshold (what `compliance` is a share of). */
  compliant: number;
  avgOpenAge: number;
  statusCounts: { Pending: number; Processing: number; Printing: number; Completed: number };
  overdueByStage: { Pending: number; Processing: number; Printing: number };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function computeSla(certs: CertLike[], slaDays: number): SlaResult {
  const statusCounts = { Pending: 0, Processing: 0, Printing: 0, Completed: 0 };
  const overdueByStage = { Pending: 0, Processing: 0, Printing: 0 };
  const isOverdue = (c: CertLike) => c.status !== 'Completed' && c.sla_age_days > slaDays;

  certs.forEach(c => {
    const s = (c.status in statusCounts ? c.status : 'Pending') as keyof typeof statusCounts;
    statusCounts[s]++;
    if (isOverdue(c) && s !== 'Completed') overdueByStage[s]++;
  });

  const open = certs.filter(c => c.status !== 'Completed');
  const overdue = certs.filter(isOverdue).length;
  const compliant = certs.filter(c => c.sla_age_days <= slaDays).length;

  return {
    total: certs.length,
    completed: statusCounts.Completed,
    open: open.length,
    overdue,
    overdueRate: pctOf(overdue, open.length),
    compliance: pctOf(compliant, certs.length),
    compliant,
    avgOpenAge: open.length ? round1(open.reduce((a, c) => a + (c.sla_age_days || 0), 0) / open.length) : 0,
    statusCounts,
    overdueByStage,
  };
}

/** When each completed certificate was completed: its first Completed history event, else its last update. */
export function completionDates(certs: CertLike[], histories: HistoryLike[]): Map<string, string> {
  const firstCompleted = new Map<string, string>();
  histories.forEach(h => {
    if (h.new_status !== 'Completed') return;
    const cur = firstCompleted.get(h.certificate_id);
    if (!cur || h.created_at < cur) firstCompleted.set(h.certificate_id, h.created_at);
  });
  const out = new Map<string, string>();
  certs.forEach(c => {
    if (c.status !== 'Completed') return;
    const stamp = firstCompleted.get(c.id) || c.updated_at || c.created_at;
    if (stamp) out.set(c.id, stamp);
  });
  return out;
}

// ---------------------------------------------------------------------------
// Trend
// ---------------------------------------------------------------------------

export interface TrendPoint {
  /** 'YYYY-MM' */
  month: string;
  leadsIn: number;
  registrations: number;
  certsCompleted: number;
}

/** First time each lead became Terdaftar (activity log); leads with no such event are not counted. */
function registrationDates(activities: ActivityLike[], leadIds: Set<string>): Map<string, string> {
  const first = new Map<string, string>();
  activities.forEach(a => {
    if (a.new_status !== 'Terdaftar' || !leadIds.has(a.lead_id)) return; // ignore activities of deleted/unknown leads
    const cur = first.get(a.lead_id);
    if (!cur || a.created_at < cur) first.set(a.lead_id, a.created_at);
  });
  return first;
}

export function computeTrend(
  leads: LeadLike[],
  activities: ActivityLike[],
  certs: CertLike[],
  histories: HistoryLike[],
  range: DateRange
): TrendPoint[] {
  const months = monthsInRange(range);
  const points = new Map<string, TrendPoint>(months.map(m => [m, { month: m, leadsIn: 0, registrations: 0, certsCompleted: 0 }]));
  const bump = (iso: string | undefined, field: 'leadsIn' | 'registrations' | 'certsCompleted') => {
    if (!inRange(iso, range)) return;
    const p = points.get(dayKey(iso).slice(0, 7));
    if (p) p[field]++;
  };
  leads.forEach(l => bump(l.created_at, 'leadsIn'));
  registrationDates(activities, new Set(leads.map(l => l.id))).forEach(iso => bump(iso, 'registrations'));
  completionDates(certs, histories).forEach(iso => bump(iso, 'certsCompleted'));
  return months.map(m => points.get(m)!);
}

// ---------------------------------------------------------------------------
// Period summary (for current-vs-previous cards)
// ---------------------------------------------------------------------------

export interface PeriodSummary {
  leadsIn: number;
  registerRate: number;
  cancelRate: number;
  confirmedSeats: number;
  certsCompleted: number;
}

export function summarizePeriod(
  leads: LeadLike[],
  activities: ActivityLike[],
  certs: CertLike[],
  histories: HistoryLike[],
  range: DateRange
): PeriodSummary {
  const funnel = computeFunnel(leads, activities, range);
  let certsCompleted = 0;
  completionDates(certs, histories).forEach(iso => {
    if (inRange(iso, range)) certsCompleted++;
  });
  return {
    leadsIn: funnel.total,
    registerRate: funnel.registerRate,
    cancelRate: funnel.cancelRate,
    confirmedSeats: funnel.confirmedSeats,
    certsCompleted,
  };
}

// ---------------------------------------------------------------------------
// Leads: where demand comes from, how fast it converts, what is at risk
// ---------------------------------------------------------------------------

export interface SourceStat {
  source: string;
  leads: number;
  registered: number;
  /** Registered share of that source's leads (percent). */
  rate: number;
}

/** Cohort (leads created in `range`) split by lead source, biggest first. */
export function computeSourceBreakdown(leads: LeadLike[], activities: ActivityLike[], range: DateRange): SourceStat[] {
  const cohort = leads.filter(l => inRange(l.created_at, range));
  const maxStage = maxStageByLead(cohort, activities);
  const by = new Map<string, { leads: number; registered: number }>();
  cohort.forEach(l => {
    const key = (l.source || '').trim() || '-';
    const cur = by.get(key) ?? { leads: 0, registered: 0 };
    cur.leads++;
    if ((maxStage.get(l.id) ?? 0) >= REGISTERED) cur.registered++;
    by.set(key, cur);
  });
  return [...by.entries()]
    .map(([source, v]) => ({ source, leads: v.leads, registered: v.registered, rate: pctOf(v.registered, v.leads) }))
    .sort((a, b) => b.leads - a.leads || a.source.localeCompare(b.source));
}

export interface ProgramStat {
  program: string;
  leads: number;
  /** Seats requested (sum of estimated seats). */
  seats: number;
  registered: number;
  rate: number;
}

/** Cohort split by training program, biggest demand (seats) first. */
export function computeProgramBreakdown(leads: LeadLike[], activities: ActivityLike[], range: DateRange): ProgramStat[] {
  const cohort = leads.filter(l => inRange(l.created_at, range));
  const maxStage = maxStageByLead(cohort, activities);
  const by = new Map<string, { leads: number; seats: number; registered: number }>();
  cohort.forEach(l => {
    const key = (l.program_name || '').trim() || '-';
    const cur = by.get(key) ?? { leads: 0, seats: 0, registered: 0 };
    cur.leads++;
    cur.seats += l.estimated_seats || 0;
    if ((maxStage.get(l.id) ?? 0) >= REGISTERED) cur.registered++;
    by.set(key, cur);
  });
  return [...by.entries()]
    .map(([program, v]) => ({ program, leads: v.leads, seats: v.seats, registered: v.registered, rate: pctOf(v.registered, v.leads) }))
    .sort((a, b) => b.seats - a.seats || a.program.localeCompare(b.program));
}

/** Median days from a lead's creation to its first "Terdaftar" event (cohort leads that registered). */
export function medianDaysToRegister(leads: LeadLike[], activities: ActivityLike[], range: DateRange): { median: number | null; n: number } {
  const cohort = leads.filter(l => inRange(l.created_at, range));
  const registered = registrationDates(activities, new Set(cohort.map(l => l.id)));
  const days: number[] = [];
  cohort.forEach(l => {
    const when = registered.get(l.id);
    if (!when) return;
    const d = (new Date(when).getTime() - new Date(l.created_at).getTime()) / DAY_MS;
    if (d >= 0) days.push(d);
  });
  if (days.length === 0) return { median: null, n: 0 };
  days.sort((a, b) => a - b);
  const mid = Math.floor(days.length / 2);
  const median = days.length % 2 ? days[mid] : (days[mid - 1] + days[mid]) / 2;
  return { median: round1(median), n: days.length };
}

const OPEN_LEAD_STATUSES = ['Baru', 'Jadwal Ditawarkan', 'Link Terkirim', 'Waiting List'];

export interface StaleResult {
  /** Leads still being worked (not registered, finished or cancelled). */
  open: number;
  /** Open leads with no activity for more than `staleDays`. */
  stale: number;
  /** Open leads whose next follow-up date has already passed. */
  overdueFollowUps: number;
  /** Days since the most neglected stale lead was last touched (0 when none is stale). */
  oldestDays: number;
}

/** Current-state view (not period filtered). `today` is 'YYYY-MM-DD'. */
export function computeStaleLeads(leads: LeadLike[], activities: ActivityLike[], today: string, staleDays: number): StaleResult {
  const lastTouch = new Map<string, string>();
  leads.forEach(l => lastTouch.set(l.id, dayKey(l.created_at)));
  activities.forEach(a => {
    const cur = lastTouch.get(a.lead_id);
    const day = dayKey(a.created_at);
    if (cur !== undefined && day > cur) lastTouch.set(a.lead_id, day);
  });
  const open = leads.filter(l => OPEN_LEAD_STATUSES.includes(l.status));
  const ageDays = (day: string) => Math.round((toDate(today).getTime() - toDate(day).getTime()) / DAY_MS);
  const staleAges = open.map(l => ageDays(lastTouch.get(l.id) ?? dayKey(l.created_at))).filter(d => d > staleDays);
  return {
    open: open.length,
    stale: staleAges.length,
    overdueFollowUps: open.filter(l => !!l.next_follow_up_date && l.next_follow_up_date < today).length,
    oldestDays: staleAges.length ? Math.max(...staleAges) : 0,
  };
}

export interface WaitingOpportunity {
  leads: number;
  seats: number;
  /** Seats / average batch size: how many extra batches the waiting demand could fill. Null when batch size is unknown. */
  batches: number | null;
  /** Program with the most waiting seats (null when nothing waits or no program is named). */
  topProgram: string | null;
  topProgramSeats: number;
}

/** Average participants per batch, from the certificates (unique participants per training). Null when unknown. */
export function averageBatchSize(certs: CertLike[]): number | null {
  const by = new Map<string, Set<string>>();
  certs.forEach(c => {
    if (!c.training_id || !c.participant_id) return;
    by.set(c.training_id, (by.get(c.training_id) ?? new Set()).add(c.participant_id));
  });
  if (by.size === 0) return null;
  const total = [...by.values()].reduce((a, set) => a + set.size, 0);
  return round1(total / by.size);
}

export function computeWaitingOpportunity(leads: LeadLike[], avgBatchSize: number | null): WaitingOpportunity {
  const waiting = leads.filter(l => l.status === 'Waiting List');
  const seats = waiting.reduce((a, l) => a + (l.estimated_seats || 0), 0);
  const byProgram = new Map<string, number>();
  waiting.forEach(l => {
    const name = (l.program_name || '').trim();
    if (name) byProgram.set(name, (byProgram.get(name) ?? 0) + (l.estimated_seats || 0));
  });
  const top = [...byProgram.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return {
    leads: waiting.length,
    seats,
    batches: avgBatchSize && avgBatchSize > 0 ? round1(seats / avgBatchSize) : null,
    topProgram: top ? top[0] : null,
    topProgramSeats: top ? top[1] : 0,
  };
}

// ---------------------------------------------------------------------------
// Certificates: flow, backlog, aging and where time is spent
// ---------------------------------------------------------------------------

export interface FlowPoint {
  month: string;
  /** Certificates created (entered the pipeline). */
  inflow: number;
  /** Certificates completed. */
  outflow: number;
}

export interface CertFlowResult {
  monthly: FlowPoint[];
  inflowInRange: number;
  outflowInRange: number;
  /** Certificates still in progress right now. */
  backlog: number;
  /** Average completions per week over the last 28 days. */
  weeklyRate: number;
  /** Days to clear the backlog at the current pace; null when nothing was completed recently. */
  daysToClear: number | null;
  /** true when more entered than were completed in the range; null when there was no movement. */
  backlogGrowing: boolean | null;
}

/** `today` is 'YYYY-MM-DD'. */
export function computeCertFlow(certs: CertLike[], histories: HistoryLike[], range: DateRange, today: string): CertFlowResult {
  const months = monthsInRange(range);
  const points = new Map<string, FlowPoint>(months.map(m => [m, { month: m, inflow: 0, outflow: 0 }]));
  let inflowInRange = 0;
  let outflowInRange = 0;

  certs.forEach(c => {
    if (!inRange(c.created_at, range)) return;
    inflowInRange++;
    const p = points.get(dayKey(c.created_at).slice(0, 7));
    if (p) p.inflow++;
  });

  const done = completionDates(certs, histories);
  const last28From = toKey(new Date(toDate(today).getTime() - 27 * DAY_MS));
  let last28 = 0;
  done.forEach(iso => {
    if (inRange(iso, range)) {
      outflowInRange++;
      const p = points.get(dayKey(iso).slice(0, 7));
      if (p) p.outflow++;
    }
    if (inRange(iso, { from: last28From, to: today })) last28++;
  });

  const backlog = certs.filter(c => c.status !== 'Completed').length;
  const rate = last28 / 4; // unrounded: rounding the rate first would skew the days-to-clear estimate
  return {
    monthly: months.map(m => points.get(m)!),
    inflowInRange,
    outflowInRange,
    backlog,
    weeklyRate: round1(rate),
    daysToClear: rate > 0 ? Math.round(backlog / (rate / 7)) : null,
    backlogGrowing: inflowInRange === 0 && outflowInRange === 0 ? null : inflowInRange > outflowInRange,
  };
}

export interface AgingBuckets {
  open: number;
  /** Age <= SLA. */
  withinSla: number;
  /** SLA < age <= 2 x SLA. */
  upTo2x: number;
  /** Age > 2 x SLA. */
  over2x: number;
  /** Age in days of the oldest certificate still in progress. */
  oldestDays: number;
}

export function computeAgingBuckets(certs: CertLike[], slaDays: number): AgingBuckets {
  const open = certs.filter(c => c.status !== 'Completed');
  return {
    open: open.length,
    withinSla: open.filter(c => c.sla_age_days <= slaDays).length,
    upTo2x: open.filter(c => c.sla_age_days > slaDays && c.sla_age_days <= 2 * slaDays).length,
    over2x: open.filter(c => c.sla_age_days > 2 * slaDays).length,
    oldestDays: open.reduce((m, c) => Math.max(m, c.sla_age_days || 0), 0),
  };
}

export interface StageDuration {
  stage: 'Pending' | 'Processing' | 'Printing';
  /** Average days a certificate spent in this stage before moving on. */
  avgDays: number;
  /** Number of observed transitions. */
  n: number;
}

/**
 * Time spent in each stage, measured from the status history: a certificate is in the stage of
 * one event until its next event. Only fully observed stays count (the first event has no known start).
 */
export function computeStageDurations(histories: HistoryLike[]): StageDuration[] {
  const byCert = new Map<string, HistoryLike[]>();
  histories.forEach(h => byCert.set(h.certificate_id, [...(byCert.get(h.certificate_id) ?? []), h]));
  const totals: Record<string, { sum: number; n: number }> = { Pending: { sum: 0, n: 0 }, Processing: { sum: 0, n: 0 }, Printing: { sum: 0, n: 0 } };
  byCert.forEach(events => {
    events.sort((a, b) => a.created_at.localeCompare(b.created_at));
    for (let i = 0; i < events.length - 1; i++) {
      const stage = events[i].new_status;
      if (!(stage in totals)) continue;
      const days = (new Date(events[i + 1].created_at).getTime() - new Date(events[i].created_at).getTime()) / DAY_MS;
      if (days < 0) continue;
      totals[stage].sum += days;
      totals[stage].n++;
    }
  });
  return (['Pending', 'Processing', 'Printing'] as const).map(stage => ({
    stage,
    avgDays: totals[stage].n ? round1(totals[stage].sum / totals[stage].n) : 0,
    n: totals[stage].n,
  }));
}

// ---------------------------------------------------------------------------
// Certificates: where each one is in the physical workflow
// ---------------------------------------------------------------------------

export interface CertPipeline {
  total: number;
  /** Not printed yet: Pending + Processing (QC). */
  notPrinted: number;
  pending: number;
  processing: number;
  /** Printed and waiting to be sent to the client (status Printing). */
  printed: number;
  /** Sent / completed. */
  completed: number;
  /** Everything still in progress (notPrinted + printed). */
  open: number;
  /** Share of the open certificates that are already printed and only wait to be sent (percent). */
  printedShareOfOpen: number;
  /** Days the longest-waiting printed certificate has been waiting since it was printed (0 when none or unknown). */
  oldestPrintedDays: number;
}

/** `today` is 'YYYY-MM-DD'. */
export function computeCertPipeline(certs: CertLike[], today: string): CertPipeline {
  const count = (status: string) => certs.filter(c => c.status === status).length;
  const pending = count('Pending');
  const processing = count('Processing');
  const printedCerts = certs.filter(c => c.status === 'Printing');
  const completed = count('Completed');
  const notPrinted = pending + processing;
  const open = notPrinted + printedCerts.length;
  const waits = printedCerts
    .map(c => (c.printed_at ? Math.round((toDate(today).getTime() - toDate(dayKey(c.printed_at)).getTime()) / DAY_MS) : 0))
    .filter(d => d > 0);
  return {
    total: certs.length,
    notPrinted,
    pending,
    processing,
    printed: printedCerts.length,
    completed,
    open,
    printedShareOfOpen: pctOf(printedCerts.length, open),
    oldestPrintedDays: waits.length ? Math.max(...waits) : 0,
  };
}
