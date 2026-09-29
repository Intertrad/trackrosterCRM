import type { ManagerDashboardResponse } from './manager-dashboard-types';

export type ObjectiveStatus =
  'achieved' | 'not_started' | 'missed' | 'at_risk' | 'watch' | 'on_track';

/**
 * How an objective is tracking against the time elapsed in its window.
 *
 * `pace` is actual ÷ expected-to-date, so 1.0 is exactly on schedule. It is
 * null before the window opens, when there is nothing to be behind on.
 */
export interface ObjectiveProgress {
  actual: number;
  target: number;
  remaining: number;
  progressPercent: number;
  elapsedPercent: number;
  expectedToDate: number;
  pace: number | null;
  status: ObjectiveStatus;
}

export interface ObjectiveRisk {
  id: string;
  name: string;
  metric: string;
  target: number;
  startsAt: string;
  endsAt: string;
  ownerId: string;
  progress: ObjectiveProgress;
  [key: string]: unknown;
}

export interface ObjectiveRiskSummary {
  available: boolean;
  generatedAt: string;
  total: number;
  items: ObjectiveRisk[];
  truncated: boolean;
}

export interface OrganizationComparisonRow {
  [key: string]: unknown;
}

/**
 * GET /dashboard/director
 *
 * A superset of the manager dashboard: the same workload and outcomes, plus
 * a cross-organization comparison and the objectives that are behind. Those
 * two are what a director has and a manager does not.
 */
export interface DirectorDashboard extends ManagerDashboardResponse {
  workload?: { items: Array<Record<string, unknown>>; truncated: boolean };
  territories?: { items: Array<Record<string, unknown>>; truncated: boolean; basis?: string };
  outcomes?: Array<Record<string, unknown>>;
  organizationComparison?: { items: OrganizationComparisonRow[]; truncated: boolean };
  objectiveRisks?: ObjectiveRiskSummary;
}

const STATUS_LABELS: Record<ObjectiveStatus, string> = {
  achieved: 'Achieved',
  on_track: 'On track',
  watch: 'Watch',
  at_risk: 'At risk',
  missed: 'Missed',
  not_started: 'Not started',
};

export function objectiveStatusLabel(status: ObjectiveStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export function objectiveStatusTone(
  status: ObjectiveStatus,
): 'success' | 'danger' | 'warning' | 'brand' | 'neutral' {
  switch (status) {
    case 'achieved':
      return 'success';
    case 'on_track':
      return 'brand';
    case 'watch':
      return 'warning';
    case 'at_risk':
    case 'missed':
      return 'danger';
    default:
      return 'neutral';
  }
}

/**
 * Objectives worth a director's attention, worst first.
 *
 * A missed objective outranks one merely at risk, and an achieved or
 * not-yet-started one is not a concern at all — surfacing those alongside
 * genuine problems is what makes a risk list stop being read.
 */
const ATTENTION_ORDER: ObjectiveStatus[] = ['missed', 'at_risk', 'watch'];

export function rankObjectives(objectives: ObjectiveRisk[]): ObjectiveRisk[] {
  return objectives
    .filter((objective) => ATTENTION_ORDER.includes(objective.progress.status))
    .sort((left, right) => {
      const byStatus =
        ATTENTION_ORDER.indexOf(left.progress.status) -
        ATTENTION_ORDER.indexOf(right.progress.status);

      if (byStatus !== 0) {
        return byStatus;
      }

      /* Within a status, the furthest behind schedule comes first. */
      return (left.progress.pace ?? 1) - (right.progress.pace ?? 1);
    });
}

export function formatPace(pace: number | null): string {
  if (pace === null) {
    return 'Not started';
  }

  const percent = Math.round(pace * 100);

  return percent >= 100 ? `${percent}% of pace` : `${percent}% of pace`;
}
