import { Inject, Injectable } from '@nestjs/common';

import { DATABASE } from '../database/database.constants.js';
import type { Database, DatabaseExecutor } from '../database/database.types.js';
import { campaignProspectAssignments } from '../database/schema/campaign-prospect-assignments.js';
import { campaignProspects } from '../database/schema/campaign-prospects.js';
import { campaigns } from '../database/schema/campaigns.js';
import { and, asc, eq, gte, isNotNull, isNull, lt, ne, or } from 'drizzle-orm';
import type { ProspectFollowUpQueueOptions } from './prospect-follow-up.types.js';
import {
  prospectFollowUps,
  type NewProspectFollowUp,
  type ProspectFollowUp,
} from '../database/schema/prospect-follow-ups.js';

export type ProspectFollowUpCollisionCandidate = ProspectFollowUp & {
  organizationId: string;
};

@Injectable()
export class ProspectFollowUpRepository {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,
  ) {}

  async findActionableQueue(
    tenantId: string,
    options: ProspectFollowUpQueueOptions,
  ): Promise<ProspectFollowUp[]> {
    /*
     * Team-owned work is visible only through an
     * exact prospector team grant supplied by the
     * service.
     */
    const teamOwnedConditions = options.teamScopes.map((scope) =>
      and(
        isNull(prospectFollowUps.assignedUserId),

        eq(campaignProspectAssignments.organizationId, scope.organizationId),

        eq(campaignProspectAssignments.teamId, scope.teamId),
      ),
    );

    const ownershipCondition = or(
      /*
       * Personally assigned follow-up.
       */
      eq(prospectFollowUps.assignedUserId, options.userId),

      /*
       * Team-owned follow-up for one of the
       * caller's exact prospector teams.
       */
      ...teamOwnedConditions,
    );

    const dueCondition =
      options.overdue === true
        ? lt(prospectFollowUps.dueAt, options.now)
        : options.overdue === false
          ? gte(prospectFollowUps.dueAt, options.now)
          : undefined;

    return this.database
      .select({
        id: prospectFollowUps.id,

        tenantId: prospectFollowUps.tenantId,

        campaignId: prospectFollowUps.campaignId,

        campaignProspectId: prospectFollowUps.campaignProspectId,

        establishmentId: prospectFollowUps.establishmentId,

        assignmentId: prospectFollowUps.assignmentId,

        assignedUserId: prospectFollowUps.assignedUserId,

        createdBy: prospectFollowUps.createdBy,

        dueAt: prospectFollowUps.dueAt,

        status: prospectFollowUps.status,

        completedAt: prospectFollowUps.completedAt,

        cancelledAt: prospectFollowUps.cancelledAt,

        createdAt: prospectFollowUps.createdAt,

        updatedAt: prospectFollowUps.updatedAt,
      })
      .from(prospectFollowUps)
      .innerJoin(
        campaignProspectAssignments,
        and(
          eq(prospectFollowUps.tenantId, campaignProspectAssignments.tenantId),

          eq(prospectFollowUps.assignmentId, campaignProspectAssignments.id),

          eq(prospectFollowUps.campaignId, campaignProspectAssignments.campaignId),

          eq(prospectFollowUps.campaignProspectId, campaignProspectAssignments.campaignProspectId),
        ),
      )
      .innerJoin(
        campaignProspects,
        and(
          eq(prospectFollowUps.tenantId, campaignProspects.tenantId),

          eq(prospectFollowUps.campaignId, campaignProspects.campaignId),

          eq(prospectFollowUps.campaignProspectId, campaignProspects.id),
        ),
      )
      .innerJoin(
        campaigns,
        and(
          eq(prospectFollowUps.tenantId, campaigns.tenantId),

          eq(prospectFollowUps.campaignId, campaigns.id),
        ),
      )
      .where(
        and(
          eq(prospectFollowUps.tenantId, tenantId),

          eq(prospectFollowUps.status, 'pending'),

          /*
           * Only current assignment work belongs
           * in an actionable queue.
           */
          isNull(campaignProspectAssignments.endedAt),

          eq(campaignProspects.status, 'active'),

          eq(campaigns.status, 'active'),

          ownershipCondition,

          dueCondition,
        ),
      )
      .orderBy(
        asc(prospectFollowUps.dueAt),

        asc(prospectFollowUps.id),
      )
      .limit(options.limit);
  }

  async create(
    input: NewProspectFollowUp,
    executor: DatabaseExecutor = this.database,
  ): Promise<ProspectFollowUp> {
    const [followUp] = await executor.insert(prospectFollowUps).values(input).returning();

    if (!followUp) {
      throw new Error('Failed to create prospect follow-up');
    }

    return followUp;
  }

  /*
   * Legacy single-candidate collision lookup.
   *
   * Keep this while existing callers still
   * depend on it.
   *
   * A follow-up may participate in current
   * collision decisions only when:
   *
   * - it is pending
   * - campaign is active
   * - campaign prospect is active
   * - its assignment is still current
   */
  async findConflictingPendingByEstablishment(
    tenantId: string,
    establishmentId: string,
    targetCampaignId: string,
    targetCampaignProspectId: string,
    userId: string,
  ): Promise<ProspectFollowUp | null> {
    const [followUp] = await this.database
      .select({
        id: prospectFollowUps.id,

        tenantId: prospectFollowUps.tenantId,

        campaignId: prospectFollowUps.campaignId,

        campaignProspectId: prospectFollowUps.campaignProspectId,

        establishmentId: prospectFollowUps.establishmentId,

        assignmentId: prospectFollowUps.assignmentId,

        assignedUserId: prospectFollowUps.assignedUserId,

        createdBy: prospectFollowUps.createdBy,

        dueAt: prospectFollowUps.dueAt,

        status: prospectFollowUps.status,

        completedAt: prospectFollowUps.completedAt,

        cancelledAt: prospectFollowUps.cancelledAt,

        createdAt: prospectFollowUps.createdAt,

        updatedAt: prospectFollowUps.updatedAt,
      })
      .from(prospectFollowUps)
      .innerJoin(
        campaignProspects,
        and(
          eq(prospectFollowUps.tenantId, campaignProspects.tenantId),

          eq(prospectFollowUps.campaignId, campaignProspects.campaignId),

          eq(prospectFollowUps.campaignProspectId, campaignProspects.id),
        ),
      )
      .innerJoin(
        campaignProspectAssignments,
        and(
          eq(prospectFollowUps.tenantId, campaignProspectAssignments.tenantId),

          eq(prospectFollowUps.assignmentId, campaignProspectAssignments.id),

          eq(prospectFollowUps.campaignId, campaignProspectAssignments.campaignId),

          eq(prospectFollowUps.campaignProspectId, campaignProspectAssignments.campaignProspectId),
        ),
      )
      .innerJoin(
        campaigns,
        and(
          eq(prospectFollowUps.tenantId, campaigns.tenantId),

          eq(prospectFollowUps.campaignId, campaigns.id),
        ),
      )
      .where(
        and(
          eq(prospectFollowUps.tenantId, tenantId),

          eq(prospectFollowUps.establishmentId, establishmentId),

          eq(prospectFollowUps.status, 'pending'),

          eq(campaignProspects.status, 'active'),

          eq(campaigns.status, 'active'),

          /*
           * Stale assignment follow-ups remain
           * as historical rows but must not
           * control current collision decisions.
           */
          isNull(campaignProspectAssignments.endedAt),

          /*
           * Another campaign/prospect context
           * always conflicts.
           *
           * On the exact prospect:
           *
           * - caller-owned follow-up -> ignore
           * - team-owned follow-up   -> ignore
           * - another user's follow-up -> block
           */
          or(
            ne(prospectFollowUps.campaignId, targetCampaignId),

            ne(prospectFollowUps.campaignProspectId, targetCampaignProspectId),

            and(
              isNotNull(prospectFollowUps.assignedUserId),

              ne(prospectFollowUps.assignedUserId, userId),
            ),
          ),
        ),
      )
      .orderBy(asc(prospectFollowUps.dueAt))
      .limit(1);

    return followUp ?? null;
  }

  /*
   * TR-017 organization-aware collision
   * candidate query.
   *
   * Returns every applicable pending candidate
   * so the coordination policy layer can decide
   * which cross-organization follow-ups matter.
   */
  async findConflictingPendingCandidatesByEstablishment(
    tenantId: string,
    establishmentId: string,
    targetCampaignId: string,
    targetCampaignProspectId: string,
    userId: string,
  ): Promise<ProspectFollowUpCollisionCandidate[]> {
    return this.database
      .select({
        id: prospectFollowUps.id,

        tenantId: prospectFollowUps.tenantId,

        campaignId: prospectFollowUps.campaignId,

        campaignProspectId: prospectFollowUps.campaignProspectId,

        establishmentId: prospectFollowUps.establishmentId,

        assignmentId: prospectFollowUps.assignmentId,

        assignedUserId: prospectFollowUps.assignedUserId,

        createdBy: prospectFollowUps.createdBy,

        dueAt: prospectFollowUps.dueAt,

        status: prospectFollowUps.status,

        completedAt: prospectFollowUps.completedAt,

        cancelledAt: prospectFollowUps.cancelledAt,

        createdAt: prospectFollowUps.createdAt,

        updatedAt: prospectFollowUps.updatedAt,

        organizationId: campaigns.organizationId,
      })
      .from(prospectFollowUps)
      .innerJoin(
        campaignProspects,
        and(
          eq(prospectFollowUps.tenantId, campaignProspects.tenantId),

          eq(prospectFollowUps.campaignId, campaignProspects.campaignId),

          eq(prospectFollowUps.campaignProspectId, campaignProspects.id),
        ),
      )
      .innerJoin(
        campaignProspectAssignments,
        and(
          eq(prospectFollowUps.tenantId, campaignProspectAssignments.tenantId),

          eq(prospectFollowUps.assignmentId, campaignProspectAssignments.id),

          eq(prospectFollowUps.campaignId, campaignProspectAssignments.campaignId),

          eq(prospectFollowUps.campaignProspectId, campaignProspectAssignments.campaignProspectId),
        ),
      )
      .innerJoin(
        campaigns,
        and(
          eq(prospectFollowUps.tenantId, campaigns.tenantId),

          eq(prospectFollowUps.campaignId, campaigns.id),
        ),
      )
      .where(
        and(
          eq(prospectFollowUps.tenantId, tenantId),

          eq(prospectFollowUps.establishmentId, establishmentId),

          eq(prospectFollowUps.status, 'pending'),

          eq(campaignProspects.status, 'active'),

          eq(campaigns.status, 'active'),

          /*
           * Only the current assignment can own
           * an actionable follow-up.
           */
          isNull(campaignProspectAssignments.endedAt),

          or(
            ne(prospectFollowUps.campaignId, targetCampaignId),

            ne(prospectFollowUps.campaignProspectId, targetCampaignProspectId),

            and(
              isNotNull(prospectFollowUps.assignedUserId),

              ne(prospectFollowUps.assignedUserId, userId),
            ),
          ),
        ),
      )
      .orderBy(asc(prospectFollowUps.dueAt));
  }

  /*
   * Tenant-safe and prospect-safe lookup used by
   * the TR-019 lifecycle service.
   */
  async findById(
    tenantId: string,
    campaignId: string,
    campaignProspectId: string,
    followUpId: string,
  ): Promise<ProspectFollowUp | null> {
    const [followUp] = await this.database
      .select()
      .from(prospectFollowUps)
      .where(
        and(
          eq(prospectFollowUps.tenantId, tenantId),

          eq(prospectFollowUps.campaignId, campaignId),

          eq(prospectFollowUps.campaignProspectId, campaignProspectId),

          eq(prospectFollowUps.id, followUpId),
        ),
      )
      .limit(1);

    return followUp ?? null;
  }

  async findByCampaignProspect(
    tenantId: string,
    campaignId: string,
    campaignProspectId: string,
  ): Promise<ProspectFollowUp[]> {
    return this.database
      .select()
      .from(prospectFollowUps)
      .where(
        and(
          eq(prospectFollowUps.tenantId, tenantId),

          eq(prospectFollowUps.campaignId, campaignId),

          eq(prospectFollowUps.campaignProspectId, campaignProspectId),
        ),
      )
      .orderBy(asc(prospectFollowUps.dueAt));
  }

  /*
   * A follow-up may be rescheduled only while it
   * is still pending.
   *
   * Keeping the status predicate inside UPDATE
   * prevents a race from reopening a completed
   * or cancelled follow-up.
   */
  async reschedulePending(
    tenantId: string,
    campaignId: string,
    campaignProspectId: string,
    followUpId: string,
    dueAt: Date,
    updatedAt: Date,
  ): Promise<ProspectFollowUp | null> {
    const [followUp] = await this.database
      .update(prospectFollowUps)
      .set({
        dueAt,

        updatedAt,
      })
      .where(
        and(
          eq(prospectFollowUps.tenantId, tenantId),

          eq(prospectFollowUps.campaignId, campaignId),

          eq(prospectFollowUps.campaignProspectId, campaignProspectId),

          eq(prospectFollowUps.id, followUpId),

          eq(prospectFollowUps.status, 'pending'),
        ),
      )
      .returning();

    return followUp ?? null;
  }

  /*
   * pending -> completed
   *
   * completed/cancelled rows are terminal.
   */
  async completePending(
    tenantId: string,
    campaignId: string,
    campaignProspectId: string,
    followUpId: string,
    completedAt: Date,
  ): Promise<ProspectFollowUp | null> {
    const [followUp] = await this.database
      .update(prospectFollowUps)
      .set({
        status: 'completed',

        completedAt,

        cancelledAt: null,

        updatedAt: completedAt,
      })
      .where(
        and(
          eq(prospectFollowUps.tenantId, tenantId),

          eq(prospectFollowUps.campaignId, campaignId),

          eq(prospectFollowUps.campaignProspectId, campaignProspectId),

          eq(prospectFollowUps.id, followUpId),

          eq(prospectFollowUps.status, 'pending'),
        ),
      )
      .returning();

    return followUp ?? null;
  }

  /*
   * pending -> cancelled
   */
  async cancelPending(
    tenantId: string,
    campaignId: string,
    campaignProspectId: string,
    followUpId: string,
    cancelledAt: Date,
  ): Promise<ProspectFollowUp | null> {
    const [followUp] = await this.database
      .update(prospectFollowUps)
      .set({
        status: 'cancelled',

        cancelledAt,

        completedAt: null,

        updatedAt: cancelledAt,
      })
      .where(
        and(
          eq(prospectFollowUps.tenantId, tenantId),

          eq(prospectFollowUps.campaignId, campaignId),

          eq(prospectFollowUps.campaignProspectId, campaignProspectId),

          eq(prospectFollowUps.id, followUpId),

          eq(prospectFollowUps.status, 'pending'),
        ),
      )
      .returning();

    return followUp ?? null;
  }
}
