import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull, ne, or } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import {
  actions,
  campaigns,
  campaignProspects,
  campaignProspectAssignments,
} from '../database/schema/index.js';
@Injectable()
export class PlannedActionCollisionRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}
  async candidates(
    tenantId: string,
    establishmentId: string,
    campaignProspectId: string,
    userId: string,
  ) {
    return this.db
      .select({
        id: actions.id,
        campaignId: actions.campaignId,
        campaignProspectId: actions.campaignProspectId,
        assignmentId: actions.assignmentId,
        assigneeMembershipId: actions.assigneeMembershipId,
        dueAt: actions.dueAt,
        updatedAt: actions.updatedAt,
        organizationId: campaigns.organizationId,
      })
      .from(actions)
      .innerJoin(
        campaigns,
        and(eq(campaigns.tenantId, actions.tenantId), eq(campaigns.id, actions.campaignId)),
      )
      .innerJoin(
        campaignProspects,
        and(
          eq(campaignProspects.tenantId, actions.tenantId),
          eq(campaignProspects.id, actions.campaignProspectId),
        ),
      )
      .innerJoin(
        campaignProspectAssignments,
        and(
          eq(campaignProspectAssignments.tenantId, actions.tenantId),
          eq(campaignProspectAssignments.id, actions.assignmentId),
        ),
      )
      .where(
        and(
          eq(actions.tenantId, tenantId),
          eq(actions.establishmentId, establishmentId),
          inArray(actions.status, ['planned', 'started']),
          inArray(actions.type, ['call', 'email', 'message', 'visit']),
          eq(campaigns.status, 'active'),
          eq(campaignProspects.status, 'active'),
          isNull(campaignProspectAssignments.endedAt),
          or(
            ne(actions.campaignProspectId, campaignProspectId),
            ne(actions.assigneeMembershipId, userId),
          ),
        ),
      )
      .orderBy(actions.dueAt, actions.id);
  }
}
