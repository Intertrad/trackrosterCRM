import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';

import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { AuditService } from '../audit/audit.service.js';
import { DATABASE } from '../database/database.constants.js';
import { prospectFollowUps } from '../database/schema/prospect-follow-ups.js';
import type { Database } from '../database/database.types.js';
import { FollowUpReminderSchedulerService } from './follow-up-reminder-scheduler.service.js';
import { ProspectFollowUpService } from './prospect-follow-up.service.js';

export type FollowUpReviewDecision = 'approved' | 'completed' | 'rejected';

export interface FollowUpReviewSummary {
  id: string;
  followUpId: string;
  campaignId: string;
  prospectId: string;
  establishmentName: string;
  campaignName: string;
  requestedBy: string;
  reason: string;
  previousDueAt: string;
  requestedDueAt: string;
  createdAt: string;
}

interface ReviewRow extends Record<string, unknown> {
  id: string;
  followUpId: string;
  campaignId: string;
  prospectId: string;
  establishmentName: string;
  campaignName: string;
  requestedBy: string;
  reason: string;
  previousDueAt: string;
  requestedDueAt: string;
  createdAt: string;
  assignmentId: string;
}

@Injectable()
export class FollowUpReviewService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly auditService: AuditService,
    private readonly followUpService: ProspectFollowUpService,
    private readonly scheduler: FollowUpReminderSchedulerService,
  ) {}

  async request(
    auth: AuthenticatedPrincipal,
    input: {
      campaignId: string;
      prospectId: string;
      followUpId: string;
      dueAt: Date;
      reason: string;
    },
  ): Promise<FollowUpReviewSummary> {
    const reason = input.reason.trim();

    if (reason.length < 10 || reason.length > 2000) {
      throw new BadRequestException('A reason between 10 and 2000 characters is required');
    }

    this.requireFutureDueAt(input.dueAt);

    const followUp = await this.followUpService.getMutablePending({
      tenantId: auth.tenantId,
      userId: auth.userId,
      campaignId: input.campaignId,
      campaignProspectId: input.prospectId,
      followUpId: input.followUpId,
    });

    if (followUp.dueAt.getTime() > Date.now()) {
      throw new ConflictException('Manager review is only required for overdue follow-ups');
    }

    const duplicate = await this.database.execute<{ id: string }>(sql`
      SELECT id
      FROM audit_events
      WHERE tenant_id = ${auth.tenantId}
        AND resource_type = 'follow_up_review'
        AND action = 'follow_up.reschedule_requested'
        AND metadata->>'followUpId' = ${followUp.id}
        AND NOT EXISTS (
          SELECT 1
          FROM audit_events decision
          WHERE decision.tenant_id = audit_events.tenant_id
            AND decision.resource_type = 'follow_up_review'
            AND decision.resource_id = audit_events.resource_id
            AND decision.action IN (
              'follow_up.reschedule_approved',
              'follow_up.reschedule_rejected',
              'follow_up.completed_late'
            )
        )
      LIMIT 1
    `);

    if (duplicate.rows[0]) {
      throw new ConflictException('A manager review is already pending for this follow-up');
    }

    const reviewId = randomUUID();
    const created = await this.database.transaction(async (tx) => {
      const [updated] = await tx
        .update(prospectFollowUps)
        .set({ reviewStatus: 'pending', updatedAt: new Date() })
        .where(
          and(
            eq(prospectFollowUps.tenantId, auth.tenantId),
            eq(prospectFollowUps.id, followUp.id),
            eq(prospectFollowUps.status, 'pending'),
            eq(prospectFollowUps.reviewStatus, 'none'),
          ),
        )
        .returning({ id: prospectFollowUps.id });

      if (!updated) {
        throw new ConflictException(
          'Follow-up is already under manager review or no longer pending',
        );
      }

      return this.auditService.record(
        {
          tenantId: auth.tenantId,
          actorType: 'user',
          actorUserId: auth.membershipId,
          action: 'follow_up.reschedule_requested',
          resourceType: 'follow_up_review',
          resourceId: reviewId,
          metadata: {
            status: 'pending',
            followUpId: followUp.id,
            campaignId: followUp.campaignId,
            prospectId: followUp.campaignProspectId,
            assignmentId: followUp.assignmentId,
            requestedBy: auth.membershipId,
            previousDueAt: followUp.dueAt.toISOString(),
            requestedDueAt: input.dueAt.toISOString(),
            reason,
          },
        },
        tx,
      );
    });

    /*
     * The requester is usually a prospector, while review listings are
     * intentionally restricted to managers/directors/tenant admins. The
     * newly-created request is still safe to return to its author, so the
     * single-row lookup explicitly permits the matching actor.
     */
    const [summary] = await this.queryReviews(auth, created.id, true);

    if (!summary) {
      throw new ServiceUnavailableException('Follow-up review could not be loaded');
    }

    return this.toSummary(summary);
  }

  async list(auth: AuthenticatedPrincipal): Promise<FollowUpReviewSummary[]> {
    const rows = await this.queryReviews(auth);
    return rows.map((row) => this.toSummary(row));
  }

  async decide(
    auth: AuthenticatedPrincipal,
    reviewId: string,
    decision: FollowUpReviewDecision,
    reason: string,
  ): Promise<{ id: string; decision: FollowUpReviewDecision; followUpId: string }> {
    const decisionReason = reason.trim();

    if (decisionReason.length < 3 || decisionReason.length > 1000) {
      throw new BadRequestException('A decision reason between 3 and 1000 characters is required');
    }

    const [review] = await this.queryReviews(auth, reviewId);

    if (!review) {
      throw new NotFoundException('Follow-up review not found');
    }

    const now = new Date();

    if (decision === 'approved') {
      const requestedDueAt = new Date(review.requestedDueAt);
      this.requireFutureDueAt(requestedDueAt);

      try {
        await this.scheduler.schedule({
          tenantId: auth.tenantId,
          followUpId: review.followUpId,
          campaignId: review.campaignId,
          campaignProspectId: review.prospectId,
          dueAt: requestedDueAt,
        });
      } catch {
        throw new ServiceUnavailableException('Follow-up reminder scheduling unavailable');
      }

      await this.database.transaction(async (tx) => {
        const [updated] = await tx
          .update(prospectFollowUps)
          .set({
            dueAt: requestedDueAt,
            reviewStatus: 'none',
            completedLate: true,
            updatedAt: now,
          })
          .where(
            and(
              eq(prospectFollowUps.tenantId, auth.tenantId),
              eq(prospectFollowUps.id, review.followUpId),
              eq(prospectFollowUps.status, 'pending'),
              eq(prospectFollowUps.assignmentId, review.assignmentId),
              eq(prospectFollowUps.reviewStatus, 'pending'),
            ),
          )
          .returning({ id: prospectFollowUps.id });

        if (!updated) {
          throw new ConflictException('Follow-up is no longer under manager review');
        }

        await this.auditService.record(
          {
            tenantId: auth.tenantId,
            actorType: 'user',
            actorUserId: auth.membershipId,
            action: 'follow_up.reschedule_approved',
            resourceType: 'follow_up_review',
            resourceId: review.id,
            metadata: {
              requestId: review.id,
              followUpId: review.followUpId,
              reason: decisionReason,
              requestedDueAt: requestedDueAt.toISOString(),
            },
          },
          tx,
        );
      });

      return { id: review.id, decision, followUpId: review.followUpId };
    }

    await this.database.transaction(async (tx) => {
      const [updated] = await tx
        .update(prospectFollowUps)
        .set(
          decision === 'completed'
            ? {
                status: 'completed',
                completedAt: now,
                cancelledAt: null,
                completedLate: true,
                reviewStatus: 'none',
                updatedAt: now,
              }
            : { reviewStatus: 'none', updatedAt: now },
        )
        .where(
          and(
            eq(prospectFollowUps.tenantId, auth.tenantId),
            eq(prospectFollowUps.id, review.followUpId),
            eq(prospectFollowUps.status, 'pending'),
            eq(prospectFollowUps.assignmentId, review.assignmentId),
            eq(prospectFollowUps.reviewStatus, 'pending'),
          ),
        )
        .returning({ id: prospectFollowUps.id });

      if (!updated) {
        throw new ConflictException('Follow-up is no longer pending or was reassigned');
      }

      await this.auditService.record(
        {
          tenantId: auth.tenantId,
          actorType: 'user',
          actorUserId: auth.membershipId,
          action:
            decision === 'completed' ? 'follow_up.completed_late' : 'follow_up.reschedule_rejected',
          resourceType: 'follow_up_review',
          resourceId: review.id,
          metadata: {
            requestId: review.id,
            followUpId: review.followUpId,
            reason: decisionReason,
            decision,
          },
        },
        tx,
      );
    });

    return { id: review.id, decision, followUpId: review.followUpId };
  }

  private async queryReviews(
    auth: AuthenticatedPrincipal,
    reviewId?: string,
    includeRequester = false,
  ): Promise<ReviewRow[]> {
    const result = await this.database.execute<ReviewRow>(sql`
      SELECT
        request.id::text AS "id",
        (request.metadata->>'followUpId')::text AS "followUpId",
        f.campaign_id::text AS "campaignId",
        f.campaign_prospect_id::text AS "prospectId",
        e.name AS "establishmentName",
        c.name AS "campaignName",
        request.actor_user_id::text AS "requestedBy",
        request.metadata->>'reason' AS "reason",
        request.metadata->>'previousDueAt' AS "previousDueAt",
        request.metadata->>'requestedDueAt' AS "requestedDueAt",
        request.occurred_at::text AS "createdAt",
        f.assignment_id::text AS "assignmentId"
      FROM audit_events request
      JOIN prospect_follow_ups f
        ON f.tenant_id = request.tenant_id
       AND f.id = (request.metadata->>'followUpId')::uuid
      JOIN campaign_prospect_assignments a
        ON a.tenant_id = f.tenant_id AND a.id = f.assignment_id
      JOIN establishments e
        ON e.tenant_id = f.tenant_id AND e.id = f.establishment_id
      JOIN campaigns c
        ON c.tenant_id = f.tenant_id AND c.id = f.campaign_id
      WHERE request.tenant_id = ${auth.tenantId}
        AND request.resource_type = 'follow_up_review'
        AND request.action = 'follow_up.reschedule_requested'
        AND f.review_status = 'pending'
        ${reviewId ? sql`AND request.id = ${reviewId}::uuid` : sql``}
        AND NOT EXISTS (
          SELECT 1
          FROM audit_events decision
          WHERE decision.tenant_id = request.tenant_id
            AND decision.resource_type = 'follow_up_review'
            AND decision.resource_id = request.resource_id
            AND decision.action IN (
              'follow_up.reschedule_approved',
              'follow_up.reschedule_rejected',
              'follow_up.completed_late'
            )
        )
        AND (
          EXISTS (
            SELECT 1
            FROM user_access_grants g
            JOIN tenant_memberships m ON m.tenant_id = g.tenant_id AND m.id = g.user_id
            JOIN identities i ON i.id = m.identity_id
            WHERE g.tenant_id = request.tenant_id
              AND g.user_id = ${auth.membershipId}
              AND m.status = 'active'
              AND i.status = 'active'
              AND (
                (g.role = 'client_admin' AND g.scope_type = 'tenant')
                OR (g.role = 'director' AND g.scope_type = 'organization' AND g.organization_id = a.organization_id)
                OR (g.role = 'manager' AND g.scope_type = 'team' AND g.organization_id = a.organization_id AND g.team_id = a.team_id)
              )
          )
          ${includeRequester ? sql`OR request.actor_user_id = ${auth.membershipId}` : sql``}
        )
      ORDER BY request.occurred_at DESC, request.id DESC
      LIMIT 100
    `);

    return result.rows;
  }

  private toSummary(row: ReviewRow): FollowUpReviewSummary {
    return {
      id: row.id,
      followUpId: row.followUpId,
      campaignId: row.campaignId,
      prospectId: row.prospectId,
      establishmentName: row.establishmentName,
      campaignName: row.campaignName,
      requestedBy: row.requestedBy,
      reason: row.reason,
      previousDueAt: row.previousDueAt,
      requestedDueAt: row.requestedDueAt,
      createdAt: row.createdAt,
    };
  }

  private requireFutureDueAt(value: Date): void {
    if (Number.isNaN(value.getTime()) || value.getTime() <= Date.now()) {
      throw new BadRequestException('The new follow-up date must be in the future');
    }
  }
}
