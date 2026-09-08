import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, isNull, ne, or } from 'drizzle-orm';

import { DATABASE } from '../database/database.constants.js';
import type { Database, DatabaseExecutor } from '../database/database.types.js';
import {
  prospectFollowUps,
  type NewProspectFollowUp,
  type ProspectFollowUp,
} from '../database/schema/prospect-follow-ups.js';
import { campaignProspects } from '../database/schema/campaign-prospects.js';
import { campaigns } from '../database/schema/campaigns.js';

@Injectable()
export class ProspectFollowUpRepository {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,
  ) {}

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
           * Ignore only the caller's own planned
           * action on this exact target prospect.
           *
           * Everything else is conflicting:
           *
           * - another campaign
           * - another campaign prospect
           * - another assigned user
           * - team-owned follow-up
           */
          or(
            ne(prospectFollowUps.campaignId, targetCampaignId),

            ne(prospectFollowUps.campaignProspectId, targetCampaignProspectId),

            isNull(prospectFollowUps.assignedUserId),

            ne(prospectFollowUps.assignedUserId, userId),
          ),
        ),
      )
      .orderBy(asc(prospectFollowUps.dueAt))
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
}
