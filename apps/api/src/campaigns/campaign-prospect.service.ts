import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Campaign } from '../database/schema/campaigns.js';
import type {
  CampaignProspect,
  CampaignProspectStatus,
} from '../database/schema/campaign-prospects.js';
import { AuditService } from '../audit/audit.service.js';
import { DATABASE } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { EstablishmentRepository } from '../establishments/establishment.repository.js';
import { CampaignRepository } from './campaign.repository.js';
import { CampaignProspectRepository } from './campaign-prospect.repository.js';

export interface AddCampaignProspectInput {
  tenantId: string;
  campaignId: string;
  establishmentId: string;
}
export interface AddCampaignProspectInput {
  tenantId: string;
  actorUserId: string;
  campaignId: string;
  establishmentId: string;
}
export interface UpdateCampaignProspectStatusInput {
  tenantId: string;
  actorUserId: string;
  campaignId: string;
  prospectId: string;
  status: CampaignProspectStatus;
}

@Injectable()
export class CampaignProspectService {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,

    private readonly prospectRepository: CampaignProspectRepository,

    private readonly campaignRepository: CampaignRepository,

    private readonly establishmentRepository: EstablishmentRepository,

    private readonly auditService: AuditService,
  ) {}

  async add(input: AddCampaignProspectInput): Promise<CampaignProspect> {
    const campaign = await this.requireCampaign(input.tenantId, input.campaignId);

    this.requireMutableCampaign(campaign);

    await this.requireEstablishment(input.tenantId, input.establishmentId);

    const existing = await this.prospectRepository.findByCampaignAndEstablishment(
      input.tenantId,
      input.campaignId,
      input.establishmentId,
    );

    /*
     * Membership history is preserved.
     *
     * Re-adding an excluded prospect means reactivating
     * the existing membership, not creating a new row.
     */
    if (existing) {
      if (existing.status === 'active') {
        throw new ConflictException('Establishment already belongs to campaign');
      }

      return this.database.transaction(async (transaction) => {
        const reactivated = await this.prospectRepository.updateStatus(
          input.tenantId,
          input.campaignId,
          existing.id,
          'active',
          transaction,
        );

        if (!reactivated) {
          throw new NotFoundException('Campaign prospect not found');
        }

        await this.auditService.record(
          {
            tenantId: input.tenantId,
            actorType: 'user',
            actorUserId: input.actorUserId,
            action: 'campaign_prospect.reactivated',
            resourceType: 'campaign_prospect',
            resourceId: reactivated.id,
            metadata: {
              campaignId: reactivated.campaignId,
              establishmentId: reactivated.establishmentId,
              status: reactivated.status,
            },
          },
          transaction,
        );

        return reactivated;
      });
    }

    try {
      return await this.database.transaction(async (transaction) => {
        const prospect = await this.prospectRepository.create(
          {
            tenantId: input.tenantId,
            campaignId: input.campaignId,
            establishmentId: input.establishmentId,
            status: 'active',
          },
          transaction,
        );

        await this.auditService.record(
          {
            tenantId: input.tenantId,
            actorType: 'user',
            actorUserId: input.actorUserId,
            action: 'campaign_prospect.added',
            resourceType: 'campaign_prospect',
            resourceId: prospect.id,
            metadata: {
              campaignId: prospect.campaignId,
              establishmentId: prospect.establishmentId,
              status: prospect.status,
            },
          },
          transaction,
        );

        return prospect;
      });
    } catch (error: unknown) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Establishment already belongs to campaign');
      }

      throw error;
    }
  }

  async list(tenantId: string, campaignId: string): Promise<CampaignProspect[]> {
    await this.requireCampaign(tenantId, campaignId);

    return this.prospectRepository.findByCampaign(tenantId, campaignId);
  }

  async findById(
    tenantId: string,
    campaignId: string,
    prospectId: string,
  ): Promise<CampaignProspect> {
    await this.requireCampaign(tenantId, campaignId);

    const prospect = await this.prospectRepository.findById(tenantId, campaignId, prospectId);

    if (!prospect) {
      throw new NotFoundException('Campaign prospect not found');
    }

    return prospect;
  }

  async updateStatus(input: UpdateCampaignProspectStatusInput): Promise<CampaignProspect> {
    const campaign = await this.requireCampaign(input.tenantId, input.campaignId);

    this.requireMutableCampaign(campaign);

    const current = await this.findById(input.tenantId, input.campaignId, input.prospectId);

    if (current.status === input.status) {
      return current;
    }

    return this.database.transaction(async (transaction) => {
      const prospect = await this.prospectRepository.updateStatus(
        input.tenantId,
        input.campaignId,
        input.prospectId,
        input.status,
        transaction,
      );

      if (!prospect) {
        throw new NotFoundException('Campaign prospect not found');
      }

      const action =
        input.status === 'excluded'
          ? 'campaign_prospect.excluded'
          : 'campaign_prospect.reactivated';

      await this.auditService.record(
        {
          tenantId: input.tenantId,
          actorType: 'user',
          actorUserId: input.actorUserId,
          action,
          resourceType: 'campaign_prospect',
          resourceId: prospect.id,
          metadata: {
            campaignId: prospect.campaignId,
            establishmentId: prospect.establishmentId,
            status: prospect.status,
          },
        },
        transaction,
      );

      return prospect;
    });
  }

  private async requireCampaign(tenantId: string, campaignId: string): Promise<Campaign> {
    const campaign = await this.campaignRepository.findById(tenantId, campaignId);

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    return campaign;
  }

  private async requireEstablishment(tenantId: string, establishmentId: string): Promise<void> {
    const establishment = await this.establishmentRepository.findById(tenantId, establishmentId);

    if (!establishment) {
      throw new NotFoundException('Establishment not found');
    }
  }

  private requireMutableCampaign(campaign: Campaign): void {
    if (campaign.status === 'completed' || campaign.status === 'archived') {
      throw new ConflictException('Campaign is no longer editable');
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('cause' in error)) {
      return false;
    }

    const cause = error.cause;

    return typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === '23505';
  }
}
