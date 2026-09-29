import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray } from 'drizzle-orm';

import { DATABASE } from '../database/database.constants.js';
import type { Database, DatabaseExecutor } from '../database/database.types.js';
import {
  campaignProspects,
  type CampaignProspect,
  type CampaignProspectStatus,
  type NewCampaignProspect,
} from '../database/schema/campaign-prospects.js';

@Injectable()
export class CampaignProspectRepository {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,
  ) {}

  async create(
    input: NewCampaignProspect,
    executor: DatabaseExecutor = this.database,
  ): Promise<CampaignProspect> {
    const [prospect] = await executor.insert(campaignProspects).values(input).returning();

    if (!prospect) {
      throw new Error('Failed to create campaign prospect');
    }

    return prospect;
  }

  async findById(
    tenantId: string,
    campaignId: string,
    prospectId: string,
  ): Promise<CampaignProspect | null> {
    const [prospect] = await this.database
      .select()
      .from(campaignProspects)
      .where(
        and(
          eq(campaignProspects.tenantId, tenantId),
          eq(campaignProspects.campaignId, campaignId),
          eq(campaignProspects.id, prospectId),
        ),
      )
      .limit(1);

    return prospect ?? null;
  }

  async findByCampaign(
    tenantId: string,
    campaignId: string,
    establishmentIds?: string[],
  ): Promise<CampaignProspect[]> {
    return this.database
      .select()
      .from(campaignProspects)
      .where(
        and(
          eq(campaignProspects.tenantId, tenantId),
          eq(campaignProspects.campaignId, campaignId),
          establishmentIds
            ? inArray(campaignProspects.establishmentId, establishmentIds)
            : undefined,
        ),
      )
      .orderBy(asc(campaignProspects.createdAt));
  }

  async findByEstablishment(
    tenantId: string,
    establishmentId: string,
  ): Promise<CampaignProspect[]> {
    return this.database
      .select()
      .from(campaignProspects)
      .where(
        and(
          eq(campaignProspects.tenantId, tenantId),
          eq(campaignProspects.establishmentId, establishmentId),
        ),
      )
      .orderBy(asc(campaignProspects.createdAt));
  }

  async findByCampaignAndEstablishment(
    tenantId: string,
    campaignId: string,
    establishmentId: string,
  ): Promise<CampaignProspect | null> {
    const [prospect] = await this.database
      .select()
      .from(campaignProspects)
      .where(
        and(
          eq(campaignProspects.tenantId, tenantId),
          eq(campaignProspects.campaignId, campaignId),
          eq(campaignProspects.establishmentId, establishmentId),
        ),
      )
      .limit(1);

    return prospect ?? null;
  }

  async updateStatus(
    tenantId: string,
    campaignId: string,
    prospectId: string,
    status: CampaignProspectStatus,
    executor: DatabaseExecutor = this.database,
  ): Promise<CampaignProspect | null> {
    const [prospect] = await executor
      .update(campaignProspects)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(campaignProspects.tenantId, tenantId),
          eq(campaignProspects.campaignId, campaignId),
          eq(campaignProspects.id, prospectId),
        ),
      )
      .returning();

    return prospect ?? null;
  }
}
