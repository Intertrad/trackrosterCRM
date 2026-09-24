/**
 * Backend readiness, mirrored from `docs/API_READINESS_AUDIT.md` (2026-09-24).
 *
 * The audit's central finding governs this file:
 *
 *   "no high-risk multi-tenant write family should be labeled fully
 *    production-ready because the complete restricted-role matrix is not
 *    green"
 *
 * So nothing here is PRODUCTION_READY. `FORCE ROW LEVEL SECURITY` is disabled
 * and 53 of 57 integration suites fail on direct fixture paths; until that is
 * green, the honest ceiling for every family is STAGING.
 *
 * This registry exists so the UI can be truthful about that rather than
 * presenting an uncertified mutation as finished product. It is an
 * engineering control, not end-user copy: §64 of the delivery brief.
 */
export type Readiness = 'PRODUCTION_READY' | 'STAGING_ONLY' | 'BLOCKED' | 'POST_MVP';

/**
 * A capability family, named after the audit's own sections rather than
 * after our routes, so the two can be diffed when the audit is re-run.
 */
export type FeatureKey =
  /* Audit §I — safe to integrate while certification continues. */
  | 'account'
  | 'prospect_reads'
  | 'work_queue'
  | 'manager_dashboard'
  | 'notifications'
  | 'search'
  | 'campaign_workspace_reads'
  | 'follow_ups'
  | 'messaging'
  /* Audit §J — frontend-ready, explicitly NOT production-certified. */
  | 'reservations'
  | 'assignments'
  | 'action_completion'
  | 'overrides'
  | 'imports'
  | 'exports'
  | 'membership_admin'
  /* Audit §K — do not integrate. */
  | 'scheduled_reports'
  | 'compliance_artifacts'
  | 'provider_sync'
  | 'outbound_webhooks';

interface FeatureStatus {
  readiness: Readiness;
  /** Why, in the audit's terms — surfaced to developers, never to users. */
  note: string;
}

const REGISTRY: Record<FeatureKey, FeatureStatus> = {
  /* ---- Audit §I: read and query surfaces, safe in staging ------------- */
  account: { readiness: 'STAGING_ONLY', note: 'Auth/account reads; full role matrix pending.' },
  prospect_reads: {
    readiness: 'STAGING_ONLY',
    note: 'Prospect, establishment, contact, timeline, map and nearby reads.',
  },
  work_queue: { readiness: 'STAGING_ONLY', note: 'Prospector today and work-queue reads.' },
  manager_dashboard: {
    readiness: 'STAGING_ONLY',
    note: 'Dashboard and team-capacity reads.',
  },
  notifications: {
    readiness: 'STAGING_ONLY',
    note: 'Inbox, unread count, read, preferences, devices.',
  },
  search: {
    readiness: 'STAGING_ONLY',
    note: 'Scoped search; query-performance certification pending.',
  },
  campaign_workspace_reads: {
    readiness: 'STAGING_ONLY',
    note: 'Campaign, workspace and territory reads.',
  },
  follow_ups: {
    readiness: 'STAGING_ONLY',
    note: 'Follow-up CRUD in staging; worker reminders pending.',
  },
  messaging: {
    readiness: 'STAGING_ONLY',
    note: 'Conversations and messages; object-storage certification pending.',
  },

  /* ---- Audit §J: high-risk writes, not production-certified ----------- */
  reservations: {
    readiness: 'STAGING_ONLY',
    note: 'Redis/PostgreSQL race certification pending.',
  },
  assignments: {
    readiness: 'STAGING_ONLY',
    note: 'Bulk recovery and cross-team matrix pending.',
  },
  action_completion: {
    readiness: 'STAGING_ONLY',
    note: 'Finalized-action immutability and correction tests pending.',
  },
  overrides: {
    readiness: 'STAGING_ONLY',
    note: 'Cross-team, self-approval and expiry certification pending.',
  },
  imports: {
    readiness: 'STAGING_ONLY',
    note: 'Large-file, malformed-input and recovery tests pending.',
  },
  exports: {
    readiness: 'STAGING_ONLY',
    note: 'Authorization matrix and object-storage tests pending.',
  },
  membership_admin: {
    readiness: 'STAGING_ONLY',
    note: 'Full membership lifecycle under restricted RLS pending.',
  },

  /* ---- Audit §K: do not integrate ------------------------------------- */
  scheduled_reports: {
    readiness: 'BLOCKED',
    note: 'Worker, artifact generation and delivery certification incomplete.',
  },
  compliance_artifacts: {
    readiness: 'BLOCKED',
    note: 'Artifact generation and download certification incomplete.',
  },
  provider_sync: {
    readiness: 'BLOCKED',
    note: 'Provider OAuth sync and refresh certification incomplete.',
  },
  outbound_webhooks: {
    readiness: 'BLOCKED',
    note: 'Retry, timeout, HMAC and dead-letter certification incomplete.',
  },
};

export function readinessOf(feature: FeatureKey): Readiness {
  return REGISTRY[feature].readiness;
}

export function readinessNote(feature: FeatureKey): string {
  return REGISTRY[feature].note;
}

/**
 * Whether a capability may be offered at all.
 *
 * BLOCKED families are never surfaced: the audit lists them under "do not
 * integrate", and a control that cannot work is worse than an absent one.
 */
export function isAvailable(feature: FeatureKey): boolean {
  const readiness = readinessOf(feature);

  return readiness === 'PRODUCTION_READY' || readiness === 'STAGING_ONLY';
}

/**
 * Whether a *write* in this family should carry an uncertified warning.
 *
 * Reads are safe to present plainly — the audit's concern is mutation under
 * an unproven restricted-role matrix. This deliberately returns true for
 * every write family today, because none is certified.
 */
export function isUncertifiedWrite(feature: FeatureKey): boolean {
  return readinessOf(feature) !== 'PRODUCTION_READY';
}
