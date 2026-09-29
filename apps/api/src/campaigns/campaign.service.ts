import { and, eq } from 'drizzle-orm';
import { campaigns, tenants } from '../database/schema/index.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { resourceScopePredicate } from '../resource-scopes/resource-scope.service.js';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service.js';
import { DATABASE } from '../database/database.constants.js';
import type { Campaign, CampaignStatus } from '../database/schema/campaigns.js';
import type { Database } from '../database/database.types.js';
import { OrganizationRepository } from '../organizations/organization.repository.js';
import { CampaignRepository, type UpdateCampaign } from './campaign.repository.js';

export interface CreateCampaignInput {
  tenantId: string;
  actorUserId: string;
  organizationId: string;

  name: string;

  description?: string | null;

  startsAt?: Date | null;
  endsAt?: Date | null;
}

export interface UpdateCampaignInput {
  authorization?: AuthenticatedPrincipal;
  tenantId: string;
  actorUserId: string;
  campaignId: string;

  name?: string;
  description?: string | null;
  status?: CampaignStatus;
  startsAt?: Date | null;
  endsAt?: Date | null;
}

@Injectable()
export class CampaignService {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,

    private readonly campaignRepository: CampaignRepository,

    private readonly organizationRepository: OrganizationRepository,

    private readonly auditService: AuditService,
  ) {}

  async create(input: CreateCampaignInput): Promise<Campaign> {
    const name = this.normalizeRequiredName(input.name);

    await this.requireOrganization(input.tenantId, input.organizationId);

    const startsAt = input.startsAt ?? null;
    const endsAt = input.endsAt ?? null;

    this.validateDateRange(startsAt, endsAt);

    return this.database.transaction(async (transaction) => {
      const campaign = await this.campaignRepository.create(
        {
          tenantId: input.tenantId,
          organizationId: input.organizationId,
          name,
          description: this.normalizeOptionalText(input.description),
          status: 'draft',
          startsAt,
          endsAt,
        },
        transaction,
      );

      await this.auditService.record(
        {
          tenantId: input.tenantId,
          actorType: 'user',
          actorUserId: input.actorUserId,
          action: 'campaign.created',
          resourceType: 'campaign',
          resourceId: campaign.id,
          metadata: {
            organizationId: campaign.organizationId,
            status: campaign.status,
          },
        },
        transaction,
      );

      return campaign;
    });
  }

  async findById(tenantId: string, campaignId: string): Promise<Campaign> {
    const campaign = await this.campaignRepository.findById(tenantId, campaignId);

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    return campaign;
  }

  async list(tenantId: string): Promise<Campaign[]> {
    return this.campaignRepository.findByTenant(tenantId);
  }

  async update(input: UpdateCampaignInput): Promise<Campaign> {
    const current = await this.findById(input.tenantId, input.campaignId);

    const update: UpdateCampaign = {};

    if (input.name !== undefined) {
      update.name = this.normalizeRequiredName(input.name);
    }

    if (input.description !== undefined) {
      update.description = this.normalizeOptionalText(input.description);
    }

    if (input.status !== undefined) {
      this.validateStatusTransition(current.status, input.status);

      update.status = input.status;
    }

    const startsAt = input.startsAt !== undefined ? input.startsAt : current.startsAt;

    const endsAt = input.endsAt !== undefined ? input.endsAt : current.endsAt;

    if (input.startsAt !== undefined || input.endsAt !== undefined) {
      this.validateDateRange(startsAt, endsAt);

      update.startsAt = startsAt;
      update.endsAt = endsAt;
    }

    return this.database.transaction(async (transaction) => {
      if (input.authorization) {
        // Serialize with membership/resource-scope mutations. The guard is also
        // required so a revoked grant cannot replay an old idempotent response.
        await transaction
          .select({ id: tenants.id })
          .from(tenants)
          .where(eq(tenants.id, input.tenantId))
          .for('update');
        const [authorized] = await transaction
          .select()
          .from(campaigns)
          .where(
            and(
              eq(campaigns.id, input.campaignId),
              resourceScopePredicate(
                input.authorization,
                'campaign',
                input.status === undefined ? 'read_write' : 'manage',
              ),
            ),
          )
          .for('update');
        if (!authorized) throw new NotFoundException('Campaign not found');
        if (input.status !== undefined)
          this.validateStatusTransition(authorized.status, input.status);
        this.validateDateRange(
          input.startsAt === undefined ? authorized.startsAt : input.startsAt,
          input.endsAt === undefined ? authorized.endsAt : input.endsAt,
        );
      }
      const campaign = await this.campaignRepository.update(
        input.tenantId,
        input.campaignId,
        update,
        transaction,
      );

      if (!campaign) {
        throw new NotFoundException('Campaign not found');
      }

      await this.auditService.record(
        {
          tenantId: input.tenantId,
          actorType: 'user',
          actorUserId: input.actorUserId,
          action: 'campaign.updated',
          resourceType: 'campaign',
          resourceId: campaign.id,
          metadata: {
            organizationId: campaign.organizationId,
            status: campaign.status,
          },
        },
        transaction,
      );

      return campaign;
    });
  }

  private async requireOrganization(tenantId: string, organizationId: string): Promise<void> {
    const organization = await this.organizationRepository.findById(tenantId, organizationId);

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
  }

  private normalizeRequiredName(value: string): string {
    const normalized = value.trim();

    if (!normalized) {
      throw new BadRequestException('Campaign name is required');
    }

    return normalized;
  }

  private normalizeOptionalText(value: string | null | undefined): string | null {
    if (value == null) {
      return null;
    }

    const normalized = value.trim();

    return normalized || null;
  }

  private validateDateRange(startsAt: Date | null, endsAt: Date | null): void {
    if (startsAt && endsAt && endsAt.getTime() < startsAt.getTime()) {
      throw new BadRequestException('Campaign end date cannot be before start date');
    }
  }

  private validateStatusTransition(
    currentStatus: CampaignStatus,
    nextStatus: CampaignStatus,
  ): void {
    if (currentStatus === nextStatus) {
      return;
    }

    const transitions: Record<CampaignStatus, readonly CampaignStatus[]> = {
      draft: ['active', 'archived'],
      active: ['paused', 'completed', 'archived'],
      paused: ['active', 'completed', 'archived'],
      completed: ['archived'],
      archived: [],
    };

    if (!transitions[currentStatus].includes(nextStatus)) {
      throw new BadRequestException(
        `Campaign cannot transition from ${currentStatus} to ${nextStatus}`,
      );
    }
  }
}
