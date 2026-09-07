import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';

import { DATABASE } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { campaigns, type Campaign, type NewCampaign } from '../database/schema/campaigns.js';

export type UpdateCampaign = Partial<
  Pick<Campaign, 'name' | 'description' | 'status' | 'startsAt' | 'endsAt'>
>;

@Injectable()
export class CampaignRepository {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,
  ) {}

  async create(input: NewCampaign): Promise<Campaign> {
    const [campaign] = await this.database.insert(campaigns).values(input).returning();

    if (!campaign) {
      throw new Error('Failed to create campaign');
    }

    return campaign;
  }

  async findById(tenantId: string, campaignId: string): Promise<Campaign | null> {
    const [campaign] = await this.database
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.tenantId, tenantId), eq(campaigns.id, campaignId)))
      .limit(1);

    return campaign ?? null;
  }

  async findByTenant(tenantId: string): Promise<Campaign[]> {
    return this.database
      .select()
      .from(campaigns)
      .where(eq(campaigns.tenantId, tenantId))
      .orderBy(asc(campaigns.createdAt));
  }

  async update(
    tenantId: string,
    campaignId: string,
    input: UpdateCampaign,
  ): Promise<Campaign | null> {
    const [campaign] = await this.database
      .update(campaigns)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(and(eq(campaigns.tenantId, tenantId), eq(campaigns.id, campaignId)))
      .returning();

    return campaign ?? null;
  }
}
