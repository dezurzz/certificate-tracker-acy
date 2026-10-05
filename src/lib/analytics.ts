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
  trainings?: { pic?: string | null } | null;
  training_id?: string;
}
export interface HistoryLike {
  certificate_id: string;
  new_status: string;
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

export interface PicPerformance {
  name: string;
  total: number;
  completed: number;
  overdue: number;
  avgAge: number;
  /** Share of certificates whose age is within the SLA threshold. */
  compliance: number;
}

export interface SlaResult {
  total: number;
  completed: number;
  open: number;
  overdue: number;
  /** Overdue share of the certificates still in progress. */
  overdueRate: number;
  /** Share of all certificates within the SLA threshold. */
  compliance: number;
  avgOpenAge: number;
  statusCounts: { Pending: number; Processing: number; Printing: number; Completed: number };
  overdueByStage: { Pending: number; Processing: number; Printing: number };
  byPic: PicPerformance[];
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

  const pics = new Map<string, CertLike[]>();
  certs.forEach(c => {
    const name = (c.trainings?.pic || '').trim() || '-';
    pics.set(name, [...(pics.get(name) ?? []), c]);
  });
  const byPic: PicPerformance[] = [...pics.entries()]
    .map(([name, list]) => ({
      name,
      total: list.length,
      completed: list.filter(c => c.status === 'Completed').length,
      overdue: list.filter(isOverdue).length,
      avgAge: round1(list.reduce((a, c) => a + (c.sla_age_days || 0), 0) / list.length),
      compliance: pctOf(list.filter(c => c.sla_age_days <= slaDays).length, list.length),
    }))
    .sort((a, b) => b.overdue - a.overdue || b.total - a.total || a.name.localeCompare(b.name));

  return {
    total: certs.length,
    completed: statusCounts.Completed,
    open: open.length,
    overdue,
    overdueRate: pctOf(overdue, open.length),
    compliance: pctOf(compliant, certs.length),
    avgOpenAge: open.length ? round1(open.reduce((a, c) => a + (c.sla_age_days || 0), 0) / open.length) : 0,
    statusCounts,
    overdueByStage,
    byPic,
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
