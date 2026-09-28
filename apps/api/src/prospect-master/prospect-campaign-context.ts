import { sql } from 'drizzle-orm';

import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { prospectReadScope } from '../actions/action-access.js';

/*
 * What an establishment currently is, operationally, to each campaign that holds
 * it.
 *
 * The référentiel is tenant-level and organization-neutral: an establishment has
 * no owner, and an organization only reaches it through a campaign. So this is a
 * projection over campaign memberships, not a property of the establishment, and
 * the same establishment legitimately appearing under OFTI and GFTIJ is two rows
 * here rather than a conflict. Collision is decided later, when someone tries to
 * reserve it.
 *
 * It is deliberately a summary. Activities, follow-ups, assignment history and
 * reservations all have their own scoped endpoints, and embedding any of them
 * whole would make this response grow without bound. What it does give is
 * `campaignProspectId`, which is the identifier those endpoints need and the
 * thing an establishment id could not previously reach.
 */
export interface ProspectCampaignMembership {
  campaignProspectId: string;

  campaign: {
    id: string;
    name: string;
    status: string;
  };

  /** Reached through the campaign. Never a property of the establishment. */
  organization: {
    id: string;
    name: string;
  };

  membership: {
    /** `active` or `excluded`; TR-924 leaves an exclusion alone, so it shows. */
    status: string;
    lifecycleStage: string;
    includedAt: Date | string;
    updatedAt: Date | string;
  };

  /** The one assignment that has not ended, or null when nobody owns it. */
  assignment: {
    id: string;
    status: string;
    priority: string;
    assignedAt: Date | string;
    teamId: string;
    teamName: string | null;
    assignedUserId: string | null;
    assignedUserName: string | null;
  } | null;

  /** The most recent activity, by when it happened. */
  latestActivity: {
    id: string;
    type: string;
    occurredAt: Date;
  } | null;

  /** The soonest follow-up still to be done. */
  nextFollowUp: {
    id: string;
    dueAt: Date;
    category: string;
    status: string;
  } | null;
}

/*
 * Timestamps arrive as the driver gave them.
 *
 * `execute()` returns raw rows rather than going through Drizzle's column
 * mapping, so a `timestamptz` comes back as PostgreSQL's own rendering —
 * `2026-09-26 10:42:00+00` — which is not ISO 8601. Serialised straight to the
 * browser it parses differently between JavaScript engines, and has historically
 * not parsed at all in Safari. Normalising here keeps the DTO's promise of a
 * Date, which serialises as ISO.
 */
function toDate(value: Date | string): Date {
  if (value instanceof Date) {
    return value;
  }

  /* Space to T, and a bare hour offset to the ±HH:MM the standard requires. */
  const iso = value.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00');
  const parsed = new Date(iso);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Unparseable timestamp from the database: ${value}`);
  }

  return parsed;
}

interface MembershipRow extends Record<string, unknown> {
  campaignProspectId: string;
  status: string;
  lifecycleStage: string;
  includedAt: Date;
  updatedAt: Date;
  campaignId: string;
  campaignName: string;
  campaignStatus: string;
  organizationId: string;
  organizationName: string;
  assignmentId: string | null;
  assignmentStatus: string | null;
  assignmentPriority: string | null;
  assignedAt: Date | string | null;
  teamId: string | null;
  teamName: string | null;
  assignedUserId: string | null;
  assignedUserName: string | null;
  activityId: string | null;
  activityType: string | null;
  activityOccurredAt: Date | string | null;
  followUpId: string | null;
  followUpDueAt: Date | string | null;
  followUpCategory: string | null;
  followUpStatus: string | null;
}

/*
 * One statement. The two summaries are lateral subqueries with LIMIT 1, so the
 * cost is one index probe per membership rather than a query per membership, and
 * an establishment in twenty campaigns still reads as one round trip.
 *
 * Ordering is by organization then campaign, because the reader is deciding
 * between entities, not scanning uuids.
 */
export function prospectCampaignMembershipQuery(auth: AuthenticatedPrincipal, prospectId: string) {
  return sql`
    SELECT
      cp.id AS "campaignProspectId",
      cp.status AS "status",
      cp.lifecycle_stage AS "lifecycleStage",
      cp.created_at AS "includedAt",
      cp.updated_at AS "updatedAt",
      c.id AS "campaignId",
      c.name AS "campaignName",
      c.status AS "campaignStatus",
      o.id AS "organizationId",
      o.name AS "organizationName",
      a.id AS "assignmentId",
      a.status AS "assignmentStatus",
      a.priority AS "assignmentPriority",
      a.assigned_at AS "assignedAt",
      a.team_id AS "teamId",
      t.name AS "teamName",
      a.assigned_user_id AS "assignedUserId",
      m.display_name AS "assignedUserName",
      act.id AS "activityId",
      act.type AS "activityType",
      act.occurred_at AS "activityOccurredAt",
      fu.id AS "followUpId",
      fu.due_at AS "followUpDueAt",
      fu.category AS "followUpCategory",
      fu.status AS "followUpStatus"
    FROM campaign_prospects cp
    JOIN campaigns c ON c.tenant_id = cp.tenant_id AND c.id = cp.campaign_id
    JOIN organizations o ON o.tenant_id = c.tenant_id AND o.id = c.organization_id
    -- ended_at IS NULL is this codebase's one definition of a current
    -- assignment, and the partial unique index guarantees at most one, so
    -- this join cannot multiply rows.
    LEFT JOIN campaign_prospect_assignments a
      ON a.tenant_id = cp.tenant_id AND a.campaign_prospect_id = cp.id AND a.ended_at IS NULL
    LEFT JOIN teams t ON t.tenant_id = a.tenant_id AND t.id = a.team_id
    LEFT JOIN tenant_memberships m ON m.tenant_id = a.tenant_id AND m.id = a.assigned_user_id
    LEFT JOIN LATERAL (
      SELECT pa.id, pa.type, pa.occurred_at
      FROM prospect_activities pa
      WHERE pa.tenant_id = cp.tenant_id AND pa.campaign_prospect_id = cp.id
      ORDER BY pa.occurred_at DESC, pa.created_at DESC, pa.id DESC
      LIMIT 1
    ) act ON TRUE
    LEFT JOIN LATERAL (
      SELECT pf.id, pf.due_at, pf.category, pf.status
      FROM prospect_follow_ups pf
      WHERE pf.tenant_id = cp.tenant_id AND pf.campaign_prospect_id = cp.id
        AND pf.status = 'pending'
      ORDER BY pf.due_at ASC, pf.id ASC
      LIMIT 1
    ) fu ON TRUE
    WHERE cp.tenant_id = ${auth.tenantId}
      AND cp.establishment_id = ${prospectId}
      -- Per membership, not per establishment: seeing the establishment does
      -- not confer sight of every campaign in the tenant. Same predicate the
      -- action and prospect read paths use.
      AND ${prospectReadScope(auth, sql`cp.id`, false)}
    ORDER BY o.name, c.name, cp.id
  `;
}

export function toProspectCampaignMembership(row: MembershipRow): ProspectCampaignMembership {
  return {
    campaignProspectId: row.campaignProspectId,

    campaign: { id: row.campaignId, name: row.campaignName, status: row.campaignStatus },

    organization: { id: row.organizationId, name: row.organizationName },

    membership: {
      status: row.status,
      lifecycleStage: row.lifecycleStage,
      includedAt: toDate(row.includedAt),
      updatedAt: toDate(row.updatedAt),
    },

    assignment:
      row.assignmentId === null
        ? null
        : {
            id: row.assignmentId,
            status: row.assignmentStatus!,
            priority: row.assignmentPriority!,
            assignedAt: toDate(row.assignedAt!),
            teamId: row.teamId!,
            teamName: row.teamName,
            assignedUserId: row.assignedUserId,
            assignedUserName: row.assignedUserName,
          },

    latestActivity:
      row.activityId === null
        ? null
        : {
            id: row.activityId,
            type: row.activityType!,
            occurredAt: toDate(row.activityOccurredAt!),
          },

    nextFollowUp:
      row.followUpId === null
        ? null
        : {
            id: row.followUpId,
            dueAt: toDate(row.followUpDueAt!),
            category: row.followUpCategory!,
            status: row.followUpStatus!,
          },
  };
}

export type { MembershipRow as ProspectCampaignMembershipRow };
