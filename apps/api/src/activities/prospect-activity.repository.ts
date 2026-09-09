import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { campaigns } from '../database/schema/campaigns.js';
import { DATABASE } from '../database/database.constants.js';
import type { Database, DatabaseExecutor } from '../database/database.types.js';
import {
  prospectActivities,
  type ProspectActivity,
  type ProspectActivityType,
} from '../database/schema/prospect-activities.js';

export type ProspectActivityCollisionCandidate = ProspectActivity & {
  organizationId: string;
};
export interface CreateProspectActivityInput {
  tenantId: string;

  campaignId: string;

  campaignProspectId: string;

  establishmentId: string;

  assignmentId: string;

  userId: string;

  reservationId: string;

  type: ProspectActivityType;
}

@Injectable()
export class ProspectActivityRepository {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,
  ) {}

  async create(
    input: CreateProspectActivityInput,
    executor: DatabaseExecutor = this.database,
  ): Promise<ProspectActivity> {
    const [activity] = await executor
      .insert(prospectActivities)
      .values({
        tenantId: input.tenantId,

        campaignId: input.campaignId,

        campaignProspectId: input.campaignProspectId,

        establishmentId: input.establishmentId,

        assignmentId: input.assignmentId,

        userId: input.userId,

        reservationId: input.reservationId,

        type: input.type,
      })
      .returning();

    if (!activity) {
      throw new Error('Failed to create prospect activity');
    }

    return activity;
  }

  async findCandidatesByEstablishment(
    tenantId: string,
    establishmentId: string,
  ): Promise<ProspectActivityCollisionCandidate[]> {
    return this.database
      .select({
        id: prospectActivities.id,

        tenantId: prospectActivities.tenantId,

        campaignId: prospectActivities.campaignId,

        campaignProspectId: prospectActivities.campaignProspectId,

        establishmentId: prospectActivities.establishmentId,

        assignmentId: prospectActivities.assignmentId,

        userId: prospectActivities.userId,

        reservationId: prospectActivities.reservationId,

        type: prospectActivities.type,

        occurredAt: prospectActivities.occurredAt,

        createdAt: prospectActivities.createdAt,

        organizationId: campaigns.organizationId,
      })
      .from(prospectActivities)
      .innerJoin(
        campaigns,
        and(
          eq(prospectActivities.tenantId, campaigns.tenantId),

          eq(prospectActivities.campaignId, campaigns.id),
        ),
      )
      .where(
        and(
          eq(prospectActivities.tenantId, tenantId),

          eq(prospectActivities.establishmentId, establishmentId),
        ),
      )
      .orderBy(
        desc(prospectActivities.occurredAt),

        desc(prospectActivities.createdAt),
      );
  }

  async findLatestByEstablishment(
    tenantId: string,
    establishmentId: string,
  ): Promise<ProspectActivity | null> {
    const [activity] = await this.database
      .select()
      .from(prospectActivities)
      .where(
        and(
          eq(prospectActivities.tenantId, tenantId),

          eq(prospectActivities.establishmentId, establishmentId),
        ),
      )
      .orderBy(
        desc(prospectActivities.occurredAt),

        desc(prospectActivities.createdAt),
      )
      .limit(1);

    return activity ?? null;
  }

  async findByCampaignProspect(
    tenantId: string,
    campaignId: string,
    campaignProspectId: string,
  ): Promise<ProspectActivity[]> {
    return this.database
      .select()
      .from(prospectActivities)
      .where(
        and(
          eq(prospectActivities.tenantId, tenantId),

          eq(prospectActivities.campaignId, campaignId),

          eq(prospectActivities.campaignProspectId, campaignProspectId),
        ),
      )
      .orderBy(
        desc(prospectActivities.occurredAt),

        desc(prospectActivities.createdAt),
      );
  }
}
