import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Campaign } from '../database/schema/campaigns.js';
import type { CampaignProspect } from '../database/schema/campaign-prospects.js';
import { EstablishmentRepository } from '../establishments/establishment.repository.js';
import { CampaignRepository } from './campaign.repository.js';
import { CampaignProspectRepository } from './campaign-prospect.repository.js';
import { CampaignProspectService } from './campaign-prospect.service.js';

describe('CampaignProspectService', () => {
  let prospectRepository: {
    create: ReturnType<typeof vi.fn>;

    findById: ReturnType<typeof vi.fn>;

    findByCampaign: ReturnType<typeof vi.fn>;

    findByCampaignAndEstablishment: ReturnType<typeof vi.fn>;

    updateStatus: ReturnType<typeof vi.fn>;
  };

  let campaignRepository: {
    findById: ReturnType<typeof vi.fn>;
  };

  let establishmentRepository: {
    findById: ReturnType<typeof vi.fn>;
  };

  let service: CampaignProspectService;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const campaignId = '22222222-2222-4222-8222-222222222222';

  const establishmentId = '33333333-3333-4333-8333-333333333333';

  const prospectId = '44444444-4444-4444-8444-444444444444';

  const campaign: Campaign = {
    id: campaignId,

    tenantId,

    organizationId: '55555555-5555-4555-8555-555555555555',

    name: 'Paris Expansion',

    description: null,

    status: 'draft',

    startsAt: null,
    endsAt: null,

    createdAt: new Date(),

    updatedAt: new Date(),
  };

  const prospect: CampaignProspect = {
    id: prospectId,

    tenantId,
    campaignId,
    establishmentId,

    status: 'active',

    createdAt: new Date(),

    updatedAt: new Date(),
  };

  beforeEach(() => {
    prospectRepository = {
      create: vi.fn(),

      findById: vi.fn(),

      findByCampaign: vi.fn(),

      findByCampaignAndEstablishment: vi.fn(),

      updateStatus: vi.fn(),
    };

    campaignRepository = {
      findById: vi.fn(),
    };

    establishmentRepository = {
      findById: vi.fn(),
    };

    service = new CampaignProspectService(
      prospectRepository as unknown as CampaignProspectRepository,

      campaignRepository as unknown as CampaignRepository,

      establishmentRepository as unknown as EstablishmentRepository,
    );
  });

  it('adds an establishment to a campaign', async () => {
    campaignRepository.findById.mockResolvedValue(campaign);

    establishmentRepository.findById.mockResolvedValue({
      id: establishmentId,
    });

    prospectRepository.findByCampaignAndEstablishment.mockResolvedValue(null);

    prospectRepository.create.mockResolvedValue(prospect);

    const result = await service.add({
      tenantId,
      campaignId,
      establishmentId,
    });

    expect(establishmentRepository.findById).toHaveBeenCalledWith(tenantId, establishmentId);

    expect(prospectRepository.create).toHaveBeenCalledWith({
      tenantId,
      campaignId,
      establishmentId,
      status: 'active',
    });

    expect(result).toBe(prospect);
  });

  it('rejects duplicate active campaign membership', async () => {
    campaignRepository.findById.mockResolvedValue(campaign);

    establishmentRepository.findById.mockResolvedValue({
      id: establishmentId,
    });

    prospectRepository.findByCampaignAndEstablishment.mockResolvedValue(prospect);

    await expect(
      service.add({
        tenantId,
        campaignId,
        establishmentId,
      }),
    ).rejects.toThrow('Establishment already belongs to campaign');

    expect(prospectRepository.create).not.toHaveBeenCalled();
  });

  it('reactivates an excluded membership instead of creating a duplicate', async () => {
    campaignRepository.findById.mockResolvedValue(campaign);

    establishmentRepository.findById.mockResolvedValue({
      id: establishmentId,
    });

    prospectRepository.findByCampaignAndEstablishment.mockResolvedValue({
      ...prospect,
      status: 'excluded',
    });

    prospectRepository.updateStatus.mockResolvedValue(prospect);

    const result = await service.add({
      tenantId,
      campaignId,
      establishmentId,
    });

    expect(prospectRepository.updateStatus).toHaveBeenCalledWith(
      tenantId,
      campaignId,
      prospectId,
      'active',
    );

    expect(prospectRepository.create).not.toHaveBeenCalled();

    expect(result.status).toBe('active');
  });

  it('rejects an establishment from another tenant', async () => {
    campaignRepository.findById.mockResolvedValue(campaign);

    establishmentRepository.findById.mockResolvedValue(null);

    await expect(
      service.add({
        tenantId,
        campaignId,
        establishmentId,
      }),
    ).rejects.toThrow('Establishment not found');

    expect(prospectRepository.create).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown campaign', async () => {
    campaignRepository.findById.mockResolvedValue(null);

    await expect(
      service.add({
        tenantId,
        campaignId,
        establishmentId,
      }),
    ).rejects.toThrow('Campaign not found');

    expect(establishmentRepository.findById).not.toHaveBeenCalled();
  });

  it('lists campaign prospects', async () => {
    campaignRepository.findById.mockResolvedValue(campaign);

    prospectRepository.findByCampaign.mockResolvedValue([prospect]);

    const result = await service.list(tenantId, campaignId);

    expect(prospectRepository.findByCampaign).toHaveBeenCalledWith(tenantId, campaignId);

    expect(result).toEqual([prospect]);
  });

  it('finds a prospect using tenant and campaign scope', async () => {
    campaignRepository.findById.mockResolvedValue(campaign);

    prospectRepository.findById.mockResolvedValue(prospect);

    const result = await service.findById(tenantId, campaignId, prospectId);

    expect(prospectRepository.findById).toHaveBeenCalledWith(tenantId, campaignId, prospectId);

    expect(result).toBe(prospect);
  });

  it('excludes an active prospect', async () => {
    campaignRepository.findById.mockResolvedValue(campaign);

    prospectRepository.findById.mockResolvedValue(prospect);

    prospectRepository.updateStatus.mockResolvedValue({
      ...prospect,
      status: 'excluded',
    });

    const result = await service.updateStatus(tenantId, campaignId, prospectId, 'excluded');

    expect(prospectRepository.updateStatus).toHaveBeenCalledWith(
      tenantId,
      campaignId,
      prospectId,
      'excluded',
    );

    expect(result.status).toBe('excluded');
  });

  it('rejects membership changes for completed campaigns', async () => {
    campaignRepository.findById.mockResolvedValue({
      ...campaign,
      status: 'completed',
    });

    await expect(
      service.add({
        tenantId,
        campaignId,
        establishmentId,
      }),
    ).rejects.toThrow('Campaign is no longer editable');

    expect(establishmentRepository.findById).not.toHaveBeenCalled();

    expect(prospectRepository.create).not.toHaveBeenCalled();
  });

  it('rejects membership changes for archived campaigns', async () => {
    campaignRepository.findById.mockResolvedValue({
      ...campaign,
      status: 'archived',
    });

    await expect(
      service.updateStatus(tenantId, campaignId, prospectId, 'excluded'),
    ).rejects.toThrow('Campaign is no longer editable');

    expect(prospectRepository.updateStatus).not.toHaveBeenCalled();
  });
});
