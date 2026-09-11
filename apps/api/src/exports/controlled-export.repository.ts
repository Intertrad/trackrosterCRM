import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gte, lt, type SQL } from 'drizzle-orm';

import { DATABASE } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { campaignProspectAssignments } from '../database/schema/campaign-prospect-assignments.js';
import { prospectActivities } from '../database/schema/prospect-activities.js';
import { prospectFollowUps } from '../database/schema/prospect-follow-ups.js';

import {
  MAX_CONTROLLED_EXPORT_ROWS,
  type ControlledExportRequest,
  type ExportRow,
} from './export.types.js';

@Injectable()
export class ControlledExportRepository {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,
  ) {}

  async findRows(input: ControlledExportRequest): Promise<ExportRow[]> {
    switch (input.type) {
      case 'assignments':
        return this.findAssignmentRows(input);

      case 'activities':
        return this.findActivityRows(input);

      case 'follow_ups':
        return this.findFollowUpRows(input);
    }
  }

  /*
   * -------------------------------------------------
   * ASSIGNMENTS
   * -------------------------------------------------
   *
   * Export semantics:
   *
   * from <= assignedAt < to
   *
   * Historical assignments are intentionally
   * included. An ended assignment remains valid
   * exportable business history.
   */
  private async findAssignmentRows(input: ControlledExportRequest): Promise<ExportRow[]> {
    const conditions: SQL[] = [
      eq(campaignProspectAssignments.tenantId, input.tenantId),

      gte(campaignProspectAssignments.assignedAt, input.range.from),

      lt(campaignProspectAssignments.assignedAt, input.range.to),
    ];

    this.addAssignmentScopeConditions(conditions, input);

    if (input.filters.userId) {
      conditions.push(eq(campaignProspectAssignments.assignedUserId, input.filters.userId));
    }

    if (input.filters.campaignId) {
      conditions.push(eq(campaignProspectAssignments.campaignId, input.filters.campaignId));
    }

    const rows = await this.database
      .select({
        id: campaignProspectAssignments.id,

        campaignId: campaignProspectAssignments.campaignId,

        campaignProspectId: campaignProspectAssignments.campaignProspectId,

        organizationId: campaignProspectAssignments.organizationId,

        teamId: campaignProspectAssignments.teamId,

        assignedUserId: campaignProspectAssignments.assignedUserId,

        assignedAt: campaignProspectAssignments.assignedAt,

        endedAt: campaignProspectAssignments.endedAt,
      })
      .from(campaignProspectAssignments)
      .where(and(...conditions))
      .orderBy(asc(campaignProspectAssignments.assignedAt), asc(campaignProspectAssignments.id))
      .limit(MAX_CONTROLLED_EXPORT_ROWS + 1);

    return rows.map((row) => ({
      id: row.id,

      campaignId: row.campaignId,

      campaignProspectId: row.campaignProspectId,

      organizationId: row.organizationId,

      teamId: row.teamId,

      assignedUserId: row.assignedUserId,

      assignedAt: row.assignedAt.toISOString(),

      endedAt: row.endedAt?.toISOString() ?? null,
    }));
  }

  /*
   * -------------------------------------------------
   * ACTIVITIES
   * -------------------------------------------------
   *
   * Export semantics:
   *
   * from <= occurredAt < to
   *
   * Organization/team authorization is enforced
   * through the assignment that authorized the
   * activity.
   */
  private async findActivityRows(input: ControlledExportRequest): Promise<ExportRow[]> {
    const conditions: SQL[] = [
      eq(prospectActivities.tenantId, input.tenantId),

      gte(prospectActivities.occurredAt, input.range.from),

      lt(prospectActivities.occurredAt, input.range.to),
    ];

    this.addAssignmentScopeConditions(conditions, input);

    if (input.filters.userId) {
      conditions.push(eq(prospectActivities.userId, input.filters.userId));
    }

    if (input.filters.campaignId) {
      conditions.push(eq(prospectActivities.campaignId, input.filters.campaignId));
    }

    const rows = await this.database
      .select({
        id: prospectActivities.id,

        campaignId: prospectActivities.campaignId,

        campaignProspectId: prospectActivities.campaignProspectId,

        establishmentId: prospectActivities.establishmentId,

        assignmentId: prospectActivities.assignmentId,

        organizationId: campaignProspectAssignments.organizationId,

        teamId: campaignProspectAssignments.teamId,

        userId: prospectActivities.userId,

        reservationId: prospectActivities.reservationId,

        type: prospectActivities.type,

        occurredAt: prospectActivities.occurredAt,

        createdAt: prospectActivities.createdAt,
      })
      .from(prospectActivities)
      .innerJoin(
        campaignProspectAssignments,
        and(
          eq(prospectActivities.tenantId, campaignProspectAssignments.tenantId),

          eq(prospectActivities.assignmentId, campaignProspectAssignments.id),

          eq(prospectActivities.campaignId, campaignProspectAssignments.campaignId),

          eq(prospectActivities.campaignProspectId, campaignProspectAssignments.campaignProspectId),
        ),
      )
      .where(and(...conditions))
      .orderBy(asc(prospectActivities.occurredAt), asc(prospectActivities.id))
      .limit(MAX_CONTROLLED_EXPORT_ROWS + 1);

    return rows.map((row) => ({
      id: row.id,

      campaignId: row.campaignId,

      campaignProspectId: row.campaignProspectId,

      establishmentId: row.establishmentId,

      assignmentId: row.assignmentId,

      organizationId: row.organizationId,

      teamId: row.teamId,

      userId: row.userId,

      reservationId: row.reservationId,

      type: row.type,

      occurredAt: row.occurredAt.toISOString(),

      createdAt: row.createdAt.toISOString(),
    }));
  }

  /*
   * -------------------------------------------------
   * FOLLOW-UPS
   * -------------------------------------------------
   *
   * Export semantics:
   *
   * from <= dueAt < to
   *
   * Completed/cancelled rows remain exportable
   * because exports represent historical business
   * data rather than only the actionable queue.
   */
  private async findFollowUpRows(input: ControlledExportRequest): Promise<ExportRow[]> {
    const conditions: SQL[] = [
      eq(prospectFollowUps.tenantId, input.tenantId),

      gte(prospectFollowUps.dueAt, input.range.from),

      lt(prospectFollowUps.dueAt, input.range.to),
    ];

    this.addAssignmentScopeConditions(conditions, input);

    if (input.filters.userId) {
      conditions.push(eq(prospectFollowUps.assignedUserId, input.filters.userId));
    }

    if (input.filters.campaignId) {
      conditions.push(eq(prospectFollowUps.campaignId, input.filters.campaignId));
    }

    const rows = await this.database
      .select({
        id: prospectFollowUps.id,

        campaignId: prospectFollowUps.campaignId,

        campaignProspectId: prospectFollowUps.campaignProspectId,

        establishmentId: prospectFollowUps.establishmentId,

        assignmentId: prospectFollowUps.assignmentId,

        organizationId: campaignProspectAssignments.organizationId,

        teamId: campaignProspectAssignments.teamId,

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
      .where(and(...conditions))
      .orderBy(asc(prospectFollowUps.dueAt), asc(prospectFollowUps.id))
      .limit(MAX_CONTROLLED_EXPORT_ROWS + 1);

    return rows.map((row) => ({
      id: row.id,

      campaignId: row.campaignId,

      campaignProspectId: row.campaignProspectId,

      establishmentId: row.establishmentId,

      assignmentId: row.assignmentId,

      organizationId: row.organizationId,

      teamId: row.teamId,

      assignedUserId: row.assignedUserId,

      createdBy: row.createdBy,

      dueAt: row.dueAt.toISOString(),

      status: row.status,

      completedAt: row.completedAt?.toISOString() ?? null,

      cancelledAt: row.cancelledAt?.toISOString() ?? null,

      createdAt: row.createdAt.toISOString(),

      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  /*
   * -------------------------------------------------
   * MANDATORY AUTHORIZATION BOUNDARY
   * -------------------------------------------------
   *
   * These conditions are deliberately applied in
   * SQL even though the scope service has already
   * authorized the request.
   *
   * This is defense in depth:
   *
   * client_admin
   *   organizationId = null
   *   teamId = null
   *
   * director
   *   organizationId = exact authorized org
   *
   * manager
   *   organizationId = exact authorized org
   *   teamId = exact authorized team
   */
  private addAssignmentScopeConditions(conditions: SQL[], input: ControlledExportRequest): void {
    if (input.scope.organizationId) {
      conditions.push(eq(campaignProspectAssignments.organizationId, input.scope.organizationId));
    }

    if (input.scope.teamId) {
      conditions.push(eq(campaignProspectAssignments.teamId, input.scope.teamId));
    }

    /*
     * Authorized caller-requested filters may only
     * narrow the already mandatory authority scope.
     */
    if (input.filters.organizationId) {
      conditions.push(eq(campaignProspectAssignments.organizationId, input.filters.organizationId));
    }

    if (input.filters.teamId) {
      conditions.push(eq(campaignProspectAssignments.teamId, input.filters.teamId));
    }
  }
}
