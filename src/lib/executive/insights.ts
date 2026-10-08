/**
 * Insight engine of the executive dashboard. It turns the numbers from `lib/analytics.ts` into a
 * ranked list of findings: what happened, how bad it is compared with a target, and how big it is.
 *
 * It contains NO wording. Each insight is `{ code, severity, impact, params }`; the sentences (headline,
 * why it matters, recommended action, decision) live in `insightCopy.ts` so they can be translated.
 * Pure and dependency-free so `npm run analytics:check` can test every rule.
 */

export interface Targets {
  conversionPct: number;
  cancelMaxPct: number;
  slaCompliancePct: number;
  staleDays: number;
  minSample: number;
}

export type Severity = 'risk' | 'watch' | 'good' | 'info';
export type Area = 'leads' | 'cert';
export type InsightCode =
  | 'low_sample_leads' | 'conversion' | 'funnel_leak' | 'cancel_rate' | 'demand_trend'
  | 'waiting_opportunity' | 'stale_leads' | 'source_gap' | 'slow_conversion'
  | 'low_sample_cert' | 'sla_compliance' | 'overdue_aging' | 'backlog' | 'bottleneck' | 'throughput_trend' | 'pipeline_hold';

export interface Insight {
  code: InsightCode;
  area: Area;
  severity: Severity;
  /** Size of the issue in natural units (leads, certificates, days...). Only used to rank within a severity. */
  impact: number;
  params: Record<string, number | string | boolean | null>;
}

export type OverallStatus = 'healthy' | 'attention' | 'action' | 'insufficient';

// Minimal structural shapes of the analytics results (kept local so this file stays standalone)
export interface InsightInput {
  targets: Targets;
  slaDays: number;
  funnel: {
    total: number;
    steps: { stage: string; reached: number; pctOfPrevious: number }[];
    cancelled: number;
    cancelRate: number;
    registered: number;
    registerRate: number;
    cancelReasons: { reason: string; count: number }[];
  };
  cur: { leadsIn: number; certsCompleted: number };
  prev: { leadsIn: number; certsCompleted: number };
  /** Funnel of the previous period (for "better or worse than before"). Optional. */
  prevFunnel?: { total: number; registerRate: number };
  sources: { source: string; leads: number; rate: number }[];
  medianDays: { median: number | null; n: number };
  stale: { open: number; stale: number; overdueFollowUps: number; oldestDays: number };
  waiting: { leads: number; seats: number; batches: number | null; topProgram: string | null; topProgramSeats: number };
  sla: {
    total: number;
    open: number;
    overdue: number;
    compliance: number;
    /** Certificates within the SLA threshold (what `compliance` is a share of). */
    compliant: number;
    overdueByStage: { Pending: number; Processing: number; Printing: number };
  };
  aging: { open: number; withinSla: number; upTo2x: number; over2x: number; oldestDays: number };
  pipeline: { total: number; notPrinted: number; printed: number; completed: number; open: number; printedShareOfOpen: number; oldestPrintedDays: number };
  flow: { backlog: number; weeklyRate: number; daysToClear: number | null; inflowInRange: number; outflowInRange: number; backlogGrowing: boolean | null };
  stages: { stage: 'Pending' | 'Processing' | 'Printing'; avgDays: number; n: number }[];
}

const WEIGHT: Record<Severity, number> = { risk: 3, watch: 2, good: 1, info: 0 };
const pct = (current: number, previous: number) => (previous === 0 ? null : Math.round(((current - previous) / previous) * 1000) / 10);

export function buildInsights(input: InsightInput): Insight[] {
  const { targets: T, funnel, cur, prev, sources, medianDays, stale, waiting, sla, aging, flow, stages, pipeline } = input;
  const out: Insight[] = [];
  const add = (i: Insight) => out.push(i);

  // ---------------- Leads ----------------
  const leadsEnough = funnel.total >= T.minSample;
  if (!leadsEnough) {
    add({ code: 'low_sample_leads', area: 'leads', severity: 'info', impact: 0, params: { total: funnel.total, minSample: T.minSample } });
  } else {
    const gap = T.conversionPct - funnel.registerRate;
    const judgedSources = sources.filter(s => s.leads >= T.minSample);
    const bestSource = judgedSources.length ? judgedSources.reduce((a, b) => (b.rate > a.rate ? b : a)) : null;
    const prevOk = !!input.prevFunnel && input.prevFunnel.total >= T.minSample;
    add({
      code: 'conversion', area: 'leads',
      severity: gap <= 0 ? 'good' : gap <= 5 ? 'watch' : 'risk',
      impact: Math.max(0, Math.round((gap / 100) * funnel.total)),
      params: {
        rate: funnel.registerRate, target: T.conversionPct, total: funnel.total, registered: funnel.registered,
        lostLeads: Math.max(0, Math.round((gap / 100) * funnel.total)),
        prevRate: prevOk ? input.prevFunnel!.registerRate : null,
        deltaPts: prevOk ? Math.round((funnel.registerRate - input.prevFunnel!.registerRate) * 10) / 10 : null,
        bestSource: bestSource ? bestSource.source : null,
        bestSourceRate: bestSource ? bestSource.rate : null,
      },
    });

    // Biggest leak between two consecutive stages (only where the earlier stage is large enough to judge)
    let leak: { k: number; lost: number; dropPct: number } | null = null;
    for (let k = 1; k <= 3 && k < funnel.steps.length; k++) {
      const before = funnel.steps[k - 1].reached;
      const lost = before - funnel.steps[k].reached;
      const dropPct = 100 - funnel.steps[k].pctOfPrevious;
      if (before < T.minSample || lost <= 0) continue;
      if (!leak || lost > leak.lost || (lost === leak.lost && dropPct > leak.dropPct)) leak = { k, lost, dropPct };
    }
    if (leak && leak.dropPct >= 25) {
      add({
        code: 'funnel_leak', area: 'leads',
        severity: leak.dropPct >= 50 ? 'risk' : 'watch',
        impact: leak.lost,
        params: {
          from: funnel.steps[leak.k - 1].stage, to: funnel.steps[leak.k].stage, lost: leak.lost, dropPct: Math.round(leak.dropPct * 10) / 10, fromReached: funnel.steps[leak.k - 1].reached,
          // Share of every lead that did not register that was lost on this single step
          shareOfLosses: funnel.total - funnel.registered > 0 ? Math.round((leak.lost / (funnel.total - funnel.registered)) * 100) : null,
        },
      });
    }

    const top = funnel.cancelled >= T.minSample ? funnel.cancelReasons[0] : undefined;
    add({
      code: 'cancel_rate', area: 'leads',
      severity: funnel.cancelRate > T.cancelMaxPct ? 'risk' : funnel.cancelRate > T.cancelMaxPct * 0.8 ? 'watch' : 'good',
      impact: funnel.cancelled,
      params: {
        rate: funnel.cancelRate, max: T.cancelMaxPct, cancelled: funnel.cancelled,
        topReason: top?.reason ?? null, topReasonCount: top?.count ?? null,
        topReasonShare: top ? Math.round((top.count / funnel.cancelled) * 100) : null,
        secondReason: funnel.cancelled >= T.minSample ? funnel.cancelReasons[1]?.reason ?? null : null,
        secondReasonCount: funnel.cancelled >= T.minSample ? funnel.cancelReasons[1]?.count ?? null : null,
        // Cancellations above what the limit allows for this many leads
        excess: Math.max(0, funnel.cancelled - Math.floor((T.cancelMaxPct / 100) * funnel.total)),
        total: funnel.total,
      },
    });
  }

  if (prev.leadsIn >= T.minSample) {
    const change = pct(cur.leadsIn, prev.leadsIn) as number;
    if (change <= -20 || change <= -5 || change >= 10) {
      add({
        code: 'demand_trend', area: 'leads',
        severity: change <= -20 ? 'risk' : change <= -5 ? 'watch' : 'good',
        impact: Math.abs(cur.leadsIn - prev.leadsIn),
        params: {
          current: cur.leadsIn, previous: prev.leadsIn, pct: change,
          topSource: sources[0]?.source ?? null,
          topSourceShare: sources[0] && funnel.total > 0 ? Math.round((sources[0].leads / funnel.total) * 100) : null,
          waitingSeats: waiting.seats,
        },
      });
    }
  }

  if (waiting.seats > 0) {
    add({
      code: 'waiting_opportunity', area: 'leads', severity: 'watch', impact: waiting.seats,
      params: { leads: waiting.leads, seats: waiting.seats, batches: waiting.batches, topProgram: waiting.topProgram, topProgramSeats: waiting.topProgramSeats },
    });
  }

  if (stale.stale > 0 && stale.open > 0) {
    const share = stale.stale / stale.open;
    add({
      code: 'stale_leads', area: 'leads',
      severity: share >= 0.3 ? 'risk' : share >= 0.1 ? 'watch' : 'info',
      impact: stale.stale,
      params: { stale: stale.stale, open: stale.open, days: T.staleDays, overdueFollowUps: stale.overdueFollowUps, oldestDays: stale.oldestDays },
    });
  }

  const judged = sources.filter(s => s.leads >= T.minSample);
  if (judged.length >= 2) {
    const best = judged.reduce((a, b) => (b.rate > a.rate ? b : a));
    const worst = judged.reduce((a, b) => (b.rate < a.rate ? b : a));
    if (best.source !== worst.source && best.rate > 0 && (worst.rate === 0 || best.rate / worst.rate >= 2)) {
      add({
        code: 'source_gap', area: 'leads', severity: 'watch',
        impact: Math.round(((best.rate - worst.rate) / 100) * worst.leads),
        params: {
          best: best.source, bestRate: best.rate, worst: worst.source, worstRate: worst.rate, worstLeads: worst.leads,
          // Registrations gained if the weak source converted like the best one
          extra: Math.round(((best.rate - worst.rate) / 100) * worst.leads),
        },
      });
    }
  }

  if (medianDays.n >= T.minSample && medianDays.median !== null && medianDays.median >= 21) {
    add({ code: 'slow_conversion', area: 'leads', severity: 'watch', impact: medianDays.median, params: { days: medianDays.median, n: medianDays.n, openLeads: stale.open } });
  }

  // ---------------- Certification ----------------
  if (sla.total < T.minSample) {
    add({ code: 'low_sample_cert', area: 'cert', severity: 'info', impact: 0, params: { total: sla.total, minSample: T.minSample } });
  } else {
    add({
      code: 'sla_compliance', area: 'cert',
      severity: sla.compliance >= T.slaCompliancePct ? 'good' : sla.compliance >= T.slaCompliancePct - 10 ? 'watch' : 'risk',
      impact: sla.overdue,
      params: {
        compliance: sla.compliance, target: T.slaCompliancePct, overdue: sla.overdue, open: sla.open, total: sla.total,
        // Certificates outside SLA now, and the most the target allows for this many certificates
        lateNow: sla.total - sla.compliant,
        allowedLate: Math.floor(((100 - T.slaCompliancePct) / 100) * sla.total),
        worstStage: Object.entries(sla.overdueByStage).sort((a, b) => b[1] - a[1]).find(e => e[1] > 0)?.[0] ?? null,
        worstStageCount: Math.max(0, ...Object.values(sla.overdueByStage)),
      },
    });

    if (aging.over2x > 0 || aging.upTo2x > 0) {
      add({
        code: 'overdue_aging', area: 'cert',
        severity: aging.over2x > 0 ? 'risk' : 'watch',
        impact: aging.over2x * 3 + aging.upTo2x,
        params: { over2x: aging.over2x, upTo2x: aging.upTo2x, open: aging.open, slaDays: input.slaDays, oldestDays: aging.oldestDays },
      });
    }

    if (flow.backlog > 0) {
      const d = flow.daysToClear;
      let severity: Severity = d === null ? (flow.backlog >= T.minSample ? 'risk' : 'watch') : d > 60 ? 'risk' : d > 30 ? 'watch' : 'good';
      if (severity === 'good' && flow.backlogGrowing) severity = 'watch';
      add({
        code: 'backlog', area: 'cert', severity, impact: flow.backlog,
        params: {
          backlog: flow.backlog, daysToClear: d, weeklyRate: flow.weeklyRate, inflow: flow.inflowInRange, outflow: flow.outflowInRange, growing: flow.backlogGrowing,
          // Completions per week needed to empty the backlog in 30 days, and how many times today's pace that is
          requiredWeeklyRate30: Math.ceil(flow.backlog / (30 / 7)),
          paceFactor: flow.weeklyRate > 0 ? Math.round((Math.ceil(flow.backlog / (30 / 7)) / flow.weeklyRate) * 10) / 10 : null,
        },
      });
    }

    // Most of the backlog is already printed and only waits to be sent: the real hold-up is delivery, not printing
    if (pipeline.printed >= T.minSample && pipeline.printedShareOfOpen >= 40) {
      add({
        code: 'pipeline_hold', area: 'cert',
        severity: pipeline.printedShareOfOpen >= 60 ? 'risk' : 'watch',
        impact: pipeline.printed,
        params: {
          printed: pipeline.printed, open: pipeline.open, share: pipeline.printedShareOfOpen, notPrinted: pipeline.notPrinted,
          completed: pipeline.completed, oldestDays: pipeline.oldestPrintedDays,
        },
      });
    }

    const measured = stages.filter(s => s.n >= T.minSample && s.avgDays > 0).sort((a, b) => b.avgDays - a.avgDays);
    if (measured.length >= 1) {
      const [slowest, second] = measured;
      // A stage that takes under a day is not a bottleneck, however it compares with the others
      if (slowest.avgDays >= 1 && (!second || slowest.avgDays >= second.avgDays * 1.5)) {
        add({
          code: 'bottleneck', area: 'cert', severity: 'watch', impact: slowest.avgDays,
          params: {
            stage: slowest.stage, avgDays: slowest.avgDays, n: slowest.n, otherAvgDays: second ? second.avgDays : null, mode: 'duration', count: null,
            // Share of the total measured time that this one stage takes
            shareOfTotal: Math.round((slowest.avgDays / stages.reduce((a, s) => a + s.avgDays, 0)) * 100),
          },
        });
      }
    } else {
      const entries = Object.entries(sla.overdueByStage).sort((a, b) => b[1] - a[1]);
      if (entries.length && entries[0][1] > 0) {
        add({ code: 'bottleneck', area: 'cert', severity: 'watch', impact: entries[0][1], params: { stage: entries[0][0], avgDays: null, n: 0, otherAvgDays: null, mode: 'overdue', count: entries[0][1] } });
      }
    }
  }

  if (prev.certsCompleted >= T.minSample) {
    const change = pct(cur.certsCompleted, prev.certsCompleted) as number;
    if (change <= -20 || change >= 20) {
      add({
        code: 'throughput_trend', area: 'cert', severity: change <= -20 ? 'watch' : 'good',
        impact: Math.abs(cur.certsCompleted - prev.certsCompleted),
        params: { current: cur.certsCompleted, previous: prev.certsCompleted, pct: change, weeklyRate: flow.weeklyRate, backlog: flow.backlog },
      });
    }
  }

  return out.sort((a, b) => WEIGHT[b.severity] - WEIGHT[a.severity] || b.impact - a.impact);
}

export function overallStatus(insights: Insight[]): OverallStatus {
  const risks = insights.filter(i => i.severity === 'risk').length;
  const watches = insights.filter(i => i.severity === 'watch').length;
  const concluded = insights.some(i => i.severity !== 'info');
  if (!concluded) return 'insufficient';
  if (risks >= 2) return 'action';
  if (risks === 1 || watches >= 3) return 'attention';
  return 'healthy';
}

/** The three findings that open the summary: risks first, then watch items, then good news. */
export function keyFindings(insights: Insight[], limit = 3): Insight[] {
  return insights.filter(i => i.severity !== 'info').slice(0, limit);
}

/** Decisions the executive has to make: the risks, biggest first (at most 3). */
export function decisionsNeeded(insights: Insight[], limit = 3): Insight[] {
  return insights.filter(i => i.severity === 'risk').slice(0, limit);
}
