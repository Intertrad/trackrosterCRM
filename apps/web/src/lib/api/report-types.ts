export const REPORT_KEYS = [
  'overview',
  'workload',
  'actions',
  'funnel',
  'conversions',
  'follow-ups',
  'coverage',
  'collisions',
  'data-quality',
  'territories',
  'forecast',
] as const;

export type ReportKey = (typeof REPORT_KEYS)[number];

export const LIFECYCLE_STAGES = [
  'to_contact',
  'contact_made',
  'in_progress',
  'follow_up',
  'qualified',
  'converted',
] as const;

export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

export interface ReportEnvelope<T> {
  report: ReportKey;
  definitionVersion: number;
  generatedAt: string;
  range: { from: string; to: string };
  scope: { authority: string; organizationId: string | null; teamId: string | null };
  filters: Record<string, string | null>;
  data: T;
}

export interface FunnelReport {
  total: number;
  stages: Array<{ stage: LifecycleStage; total: number; share: number }>;
}

export interface ConversionsReport {
  total: number;
  contacted: number;
  qualified: number;
  converted: number;
  /** Null when nothing has been measured — not the same as zero. */
  contactRate: number | null;
  qualificationRate: number | null;
  conversionRate: number | null;
}

export interface ActionsReport {
  total: number;
  byType: Record<string, number>;
  byOutcome: Record<string, number>;
}

export interface FollowUpsReport {
  total: number;
  overdue: number;
  byStatus: Record<string, number>;
  completionRate: number | null;
}

export interface WorkloadReport {
  teamOwned: number;
  byProspector: Array<{ userId: string; assigned: number; paused: number }>;
}

export interface CoverageReport {
  prospects: number;
  establishments: number;
  touched: number;
  untouched: number;
  coverageRate: number | null;
}

export interface CollisionsReport {
  total: number;
  byDecision: Record<string, number>;
  byReason: Record<string, number>;
}

export interface DataQualityReport {
  total: number;
  missing: { phone: number; coordinates: number; address: number; website: number };
  completeness: number | null;
}

export interface TerritoriesReport {
  items: Array<{
    territoryId: string;
    name: string;
    code: string | null;
    prospects: number;
    activities: number;
  }>;
}

export interface ForecastReport {
  pipeline: number;
  weightedPipeline: number;
  scheduledFollowUps: number;
  basis: string;
}

const STAGE_LABELS: Record<LifecycleStage, string> = {
  to_contact: 'To contact',
  contact_made: 'Contact made',
  in_progress: 'In progress',
  follow_up: 'Follow-up',
  qualified: 'Qualified',
  converted: 'Converted',
};

export function stageLabel(stage: LifecycleStage): string {
  return STAGE_LABELS[stage] ?? stage.replace(/_/g, ' ');
}

/**
 * Renders a rate the API may report as null.
 *
 * Null means the denominator was empty — nothing was measured. Showing "0%"
 * there would tell a manager their team failed when in fact nothing has
 * happened yet.
 */
export function formatRate(value: number | null): string {
  return value === null ? 'Not measured' : `${value}%`;
}
