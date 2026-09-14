import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, getTableColumns, isNull, ne, or } from 'drizzle-orm';

import { DATABASE } from '../database/database.constants.js';
import {
  campaignProspectAssignments,
  type CampaignProspectAssignment,
  type NewCampaignProspectAssignment,
} from '../database/schema/campaign-prospect-assignments.js';
import { campaignProspects } from '../database/schema/campaign-prospects.js';
import { campaigns } from '../database/schema/campaigns.js';
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

  /*
   * Transactional current-assignment read used by
   * sensitive mutations.
   *
   * SELECT ... FOR UPDATE prevents a concurrent
   * reassignment/unassignment from ending this
   * assignment until the caller's transaction
   * completes.
   *
   * The executor is deliberately mandatory. This
   * method should never accidentally acquire a row
   * lock outside the transaction that protects the
   * associated mutation.
   */
  async findCurrentForUpdate(
    tenantId: string,
    campaignId: string,
    campaignProspectId: string,
    executor: DatabaseExecutor,
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
      .limit(1)
      .for('update');

    return assignment ?? null;
  }

  async findConflictingCurrentCandidatesByEstablishment(
    tenantId: string,
    establishmentId: string,
    targetCampaignId: string,
    targetCampaignProspectId: string,
  ): Promise<CampaignProspectAssignment[]> {
    return this.database
      .select({
        ...getTableColumns(campaignProspectAssignments),
      })
      .from(campaignProspectAssignments)
      .innerJoin(
        campaignProspects,
        and(
          eq(campaignProspectAssignments.tenantId, campaignProspects.tenantId),
          eq(campaignProspectAssignments.campaignId, campaignProspects.campaignId),
          eq(campaignProspectAssignments.campaignProspectId, campaignProspects.id),
        ),
      )
      .innerJoin(
        campaigns,
        and(
          eq(campaignProspectAssignments.tenantId, campaigns.tenantId),
          eq(campaignProspectAssignments.campaignId, campaigns.id),
        ),
      )
      .where(
        and(
          eq(campaignProspectAssignments.tenantId, tenantId),
          eq(campaignProspects.establishmentId, establishmentId),
          eq(campaignProspects.status, 'active'),
          eq(campaigns.status, 'active'),
          isNull(campaignProspectAssignments.endedAt),
          or(
            ne(campaignProspectAssignments.campaignId, targetCampaignId),
            ne(campaignProspectAssignments.campaignProspectId, targetCampaignProspectId),
          ),
        ),
      )
      .orderBy(desc(campaignProspectAssignments.assignedAt));
  }

  async findConflictingCurrentByEstablishment(
    tenantId: string,
    establishmentId: string,
    targetCampaignId: string,
    targetCampaignProspectId: string,
  ): Promise<CampaignProspectAssignment | null> {
    const [assignment] = await this.database
      .select({
        ...getTableColumns(campaignProspectAssignments),
      })
      .from(campaignProspectAssignments)
      .innerJoin(
        campaignProspects,
        and(
          eq(campaignProspectAssignments.tenantId, campaignProspects.tenantId),
          eq(campaignProspectAssignments.campaignId, campaignProspects.campaignId),
          eq(campaignProspectAssignments.campaignProspectId, campaignProspects.id),
        ),
      )
      .innerJoin(
        campaigns,
        and(
          eq(campaignProspectAssignments.tenantId, campaigns.tenantId),
          eq(campaignProspectAssignments.campaignId, campaigns.id),
        ),
      )
      .where(
        and(
          eq(campaignProspectAssignments.tenantId, tenantId),
          eq(campaignProspects.establishmentId, establishmentId),
          eq(campaignProspects.status, 'active'),
          eq(campaigns.status, 'active'),
          isNull(campaignProspectAssignments.endedAt),

          /*
           * Ignore the assignment belonging to the
           * exact target campaign prospect.
           *
           * Anything else for the same canonical
           * establishment is a conflicting assignment.
           */
          or(
            ne(campaignProspectAssignments.campaignId, targetCampaignId),
            ne(campaignProspectAssignments.campaignProspectId, targetCampaignProspectId),
          ),
        ),
      )
      .orderBy(desc(campaignProspectAssignments.assignedAt))
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
