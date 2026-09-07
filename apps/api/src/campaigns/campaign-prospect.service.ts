import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import type { Campaign } from '../database/schema/campaigns.js';
import type {
  CampaignProspect,
  CampaignProspectStatus,
} from '../database/schema/campaign-prospects.js';
import { EstablishmentRepository } from '../establishments/establishment.repository.js';
import { CampaignRepository } from './campaign.repository.js';
import { CampaignProspectRepository } from './campaign-prospect.repository.js';

export interface AddCampaignProspectInput {
  tenantId: string;
  campaignId: string;
  establishmentId: string;
}

@Injectable()
export class CampaignProspectService {
  constructor(
    private readonly prospectRepository: CampaignProspectRepository,

    private readonly campaignRepository: CampaignRepository,

    private readonly establishmentRepository: EstablishmentRepository,
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
     * We preserve membership history.
     *
     * Re-adding an excluded establishment
     * reactivates its existing membership
     * instead of creating another row.
     */
    if (existing) {
      if (existing.status === 'active') {
        throw new ConflictException('Establishment already belongs to campaign');
      }

      const reactivated = await this.prospectRepository.updateStatus(
        input.tenantId,
        input.campaignId,
        existing.id,
        'active',
      );

      if (!reactivated) {
        throw new NotFoundException('Campaign prospect not found');
      }

      return reactivated;
    }

    try {
      return await this.prospectRepository.create({
        tenantId: input.tenantId,

        campaignId: input.campaignId,

        establishmentId: input.establishmentId,

        status: 'active',
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

  async updateStatus(
    tenantId: string,
    campaignId: string,
    prospectId: string,
    status: CampaignProspectStatus,
  ): Promise<CampaignProspect> {
    const campaign = await this.requireCampaign(tenantId, campaignId);

    this.requireMutableCampaign(campaign);

    const current = await this.findById(tenantId, campaignId, prospectId);

    if (current.status === status) {
      return current;
    }

    const prospect = await this.prospectRepository.updateStatus(
      tenantId,
      campaignId,
      prospectId,
      status,
    );

    if (!prospect) {
      throw new NotFoundException('Campaign prospect not found');
    }

    return prospect;
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
