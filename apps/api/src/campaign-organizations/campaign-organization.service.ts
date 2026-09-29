import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, gt, sql } from 'drizzle-orm';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { DATABASE } from '../database/database.constants.js';
import type { Database, DatabaseExecutor } from '../database/database.types.js';
import {
  auditEvents,
  campaignOrganizations,
  campaigns,
  organizations,
  tenants,
} from '../database/schema/index.js';
import { assertResourceMatches, resourceETag } from '../http/resource-etag.js';
import { ResourceScopeService } from '../resource-scopes/resource-scope.service.js';
import type {
  CreateCampaignOrganizationDto,
  ListCampaignOrganizationsDto,
  UpdateCampaignOrganizationDto,
} from './campaign-organization.dto.js';
@Injectable()
export class CampaignOrganizationService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scopes: ResourceScopeService,
  ) {}
  async authorize(
    auth: AuthenticatedPrincipal,
    campaignId: string,
    tx: DatabaseExecutor = this.db,
  ) {
    await this.scopes.require(auth, 'campaign', campaignId, 'manage', tx);
  }
  async list(
    auth: AuthenticatedPrincipal,
    campaignId: string,
    query: ListCampaignOrganizationsDto,
  ) {
    const campaign = await this.scopes.getCampaign(auth, campaignId);
    const t = campaignOrganizations;
    const rows = await this.db
      .select({ record: t })
      .from(t)
      .innerJoin(campaigns, and(eq(campaigns.tenantId, t.tenantId), eq(campaigns.id, t.campaignId)))
      .where(
        and(
          this.scopes.predicate(auth, 'campaign'),
          eq(t.campaignId, campaignId),
          query.cursor ? gt(t.id, query.cursor) : undefined,
          query.state === 'all'
            ? undefined
            : query.state === 'active'
              ? sql`${t.endedAt} IS NULL`
              : sql`${t.endedAt} IS NOT NULL`,
        ),
      )
      .orderBy(t.id)
      .limit(query.limit + 1);
    return {
      owner: { organizationId: campaign.organizationId, accessMode: 'owner' },
      items: rows
        .slice(0, query.limit)
        .map(({ record }) => ({ ...record, etag: resourceETag(record) })),
      nextCursor: rows.length > query.limit ? rows[query.limit - 1]!.record.id : null,
    };
  }
  async mutate(
    auth: AuthenticatedPrincipal,
    campaignId: string,
    organizationId: string,
    input: CreateCampaignOrganizationDto | UpdateCampaignOrganizationDto | null,
    create = false,
    ifMatch?: string,
  ) {
    try {
      return await this.db.transaction(async (tx) => {
        // Compatible with FK key-share locks from existing organization writers.
        await tx
          .select({ id: tenants.id })
          .from(tenants)
          .where(eq(tenants.id, auth.tenantId))
          .for('no key update');
        await this.authorize(auth, campaignId, tx);
        const [campaign] = await tx
          .select()
          .from(campaigns)
          .where(and(eq(campaigns.tenantId, auth.tenantId), eq(campaigns.id, campaignId)))
          .for('share');
        if (!campaign) throw new NotFoundException('Campaign not found');
        if (campaign.organizationId === organizationId.toLowerCase())
          throw new ConflictException(
            'The campaign owner is fixed; it cannot be changed or removed through participation',
          );
        if (input && ['completed', 'archived'].includes(campaign.status))
          throw new ConflictException('Campaign is not accepting participation changes');
        const t = campaignOrganizations;
        const [before] = await tx
          .select()
          .from(t)
          .where(
            and(
              eq(t.tenantId, auth.tenantId),
              eq(t.campaignId, campaignId),
              eq(t.organizationId, organizationId),
              sql`${t.endedAt} IS NULL`,
            ),
          );
        if (create && before) throw new ConflictException('Organization already participates');
        if (!create && !before)
          throw new NotFoundException('Active organization participation not found');
        if (before) assertResourceMatches(ifMatch, before);
        if (input) {
          const [org] = await tx
            .select()
            .from(organizations)
            .where(
              and(eq(organizations.tenantId, auth.tenantId), eq(organizations.id, organizationId)),
            )
            .for('share');
          if (!org) throw new NotFoundException('Organization not found');
          if (org.status !== 'active') throw new ConflictException('Organization must be active');
        }
        const [after] = create
          ? await tx
              .insert(t)
              .values({
                tenantId: auth.tenantId,
                campaignId,
                organizationId,
                accessMode: input!.accessMode,
              })
              .returning()
          : await tx
              .update(t)
              .set(
                input
                  ? { accessMode: input.accessMode, updatedAt: sql`clock_timestamp()` }
                  : { endedAt: sql`clock_timestamp()`, updatedAt: sql`clock_timestamp()` },
              )
              .where(eq(t.id, before!.id))
              .returning();
        await tx.insert(auditEvents).values({
          tenantId: auth.tenantId,
          actorType: 'user',
          actorUserId: auth.membershipId,
          resourceType: 'campaign_organization',
          resourceId: after!.id,
          action: `campaign_organization.${create ? 'created' : input ? 'updated' : 'ended'}`,
          metadata: { before, after },
        });
        return after!;
      });
    } catch (error) {
      if ((error as { cause?: { code?: string } }).cause?.code === '23505')
        throw new ConflictException('Organization already participates');
      throw error;
    }
  }
}
