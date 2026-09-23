import { LIFECYCLE_STAGES, type LifecycleStage } from './report-query.constants.js';

/**
 * A percentage, or null when the denominator is empty.
 *
 * Null and zero mean different things in a report: a team that has contacted
 * nobody has an *unknown* conversion rate, not a zero one. Rendering the
 * second as the first tells a manager their team is failing when in fact
 * nothing has been measured.
 */
export function rate(numerator: number, denominator: number): number | null {
  if (denominator === 0) {
    return null;
  }

  return Math.round((numerator / denominator) * 1000) / 10;
}

export interface FunnelStage {
  stage: LifecycleStage;
  total: number;
  share: number;
}

/**
 * Every lifecycle stage, in pipeline order, including empty ones.
 *
 * A funnel that omits a stage with no prospects reads as though the stage
 * does not exist rather than as though nobody has reached it yet.
 */
export function buildFunnelStages(byStage: Map<string, number>): {
  total: number;
  stages: FunnelStage[];
} {
  const total = LIFECYCLE_STAGES.reduce((sum, stage) => sum + (byStage.get(stage) ?? 0), 0);

  const stages = LIFECYCLE_STAGES.map((stage) => {
    const value = byStage.get(stage) ?? 0;

    return {
      stage,
      total: value,
      share: total === 0 ? 0 : Math.round((value / total) * 1000) / 10,
    };
  });

  return { total, stages };
}

/**
 * Share of records with none of the tracked fields missing.
 *
 * Deliberately not an average across fields: one record missing four things
 * is one incomplete record, not four. The worst single field bounds how many
 * records can possibly be complete.
 */
export function completeness(total: number, missing: Record<string, number>): number | null {
  if (total === 0) {
    return null;
  }

  const worst = Math.max(0, ...Object.values(missing));

  return rate(Math.max(0, total - worst), total);
}
