import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';

import { DATABASE } from '../database/database.constants.js';
import {
  campaignProspectAssignments,
  type CampaignProspectAssignment,
  type NewCampaignProspectAssignment,
} from '../database/schema/campaign-prospect-assignments.js';
import type { Database, DatabaseExecutor } from '../database/database.types.js';

@Injectable()
export class CampaignProspectAssignmentRepository {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,
  ) {}

  async create(
    input: NewCampaignProspectAssignment,
    executor: DatabaseExecutor = this.database,
  ): Promise<CampaignProspectAssignment> {
    const [assignment] = await executor
      .insert(campaignProspectAssignments)
      .values(input)
      .returning();

    if (!assignment) {
      throw new Error('Failed to create campaign prospect assignment');
    }

    return assignment;
  }

  async findCurrent(
    tenantId: string,
    campaignId: string,
    campaignProspectId: string,
    executor: DatabaseExecutor = this.database,
  ): Promise<CampaignProspectAssignment | null> {
    const [assignment] = await executor
      .select()
      .from(campaignProspectAssignments)
      .where(
        and(
          eq(campaignProspectAssignments.tenantId, tenantId),
          eq(campaignProspectAssignments.campaignId, campaignId),
          eq(campaignProspectAssignments.campaignProspectId, campaignProspectId),
          isNull(campaignProspectAssignments.endedAt),
        ),
      )
      .limit(1);

    return assignment ?? null;
  }

  async findHistory(
    tenantId: string,
    campaignId: string,
    campaignProspectId: string,
  ): Promise<CampaignProspectAssignment[]> {
    return this.database
      .select()
      .from(campaignProspectAssignments)
      .where(
        and(
          eq(campaignProspectAssignments.tenantId, tenantId),
          eq(campaignProspectAssignments.campaignId, campaignId),
          eq(campaignProspectAssignments.campaignProspectId, campaignProspectId),
        ),
      )
      .orderBy(desc(campaignProspectAssignments.assignedAt));
  }

  async endCurrent(
    tenantId: string,
    campaignId: string,
    campaignProspectId: string,
    endedAt: Date,
    executor: DatabaseExecutor = this.database,
  ): Promise<CampaignProspectAssignment | null> {
    const [assignment] = await executor
      .update(campaignProspectAssignments)
      .set({
        endedAt,
      })
      .where(
        and(
          eq(campaignProspectAssignments.tenantId, tenantId),
          eq(campaignProspectAssignments.campaignId, campaignId),
          eq(campaignProspectAssignments.campaignProspectId, campaignProspectId),
          isNull(campaignProspectAssignments.endedAt),
        ),
      )
      .returning();

    return assignment ?? null;
  }
}
