import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Campaign } from '../database/schema/campaigns.js';
import { OrganizationRepository } from '../organizations/organization.repository.js';
import { CampaignRepository } from './campaign.repository.js';
import { CampaignService } from './campaign.service.js';

describe('CampaignService', () => {
  let campaignRepository: {
    create: ReturnType<typeof vi.fn>;

    findById: ReturnType<typeof vi.fn>;

    findByTenant: ReturnType<typeof vi.fn>;

    update: ReturnType<typeof vi.fn>;
  };

  let organizationRepository: {
    findById: ReturnType<typeof vi.fn>;
  };

  let service: CampaignService;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const organizationId = '22222222-2222-4222-8222-222222222222';

  const campaignId = '33333333-3333-4333-8333-333333333333';

  const campaign: Campaign = {
    id: campaignId,

    tenantId,

    organizationId,

    name: 'Paris Expansion',

    description: 'Paris prospecting campaign',

    status: 'draft',

    startsAt: new Date('2026-10-01T00:00:00.000Z'),

    endsAt: new Date('2026-12-31T00:00:00.000Z'),

    createdAt: new Date(),

    updatedAt: new Date(),
  };

  beforeEach(() => {
    campaignRepository = {
      create: vi.fn(),

      findById: vi.fn(),

      findByTenant: vi.fn(),

      update: vi.fn(),
    };

    organizationRepository = {
      findById: vi.fn(),
    };

    service = new CampaignService(
      campaignRepository as unknown as CampaignRepository,

      organizationRepository as unknown as OrganizationRepository,
    );
  });

  it('creates and normalizes a campaign', async () => {
    organizationRepository.findById.mockResolvedValue({
      id: organizationId,
    });

    campaignRepository.create.mockResolvedValue(campaign);

    const startsAt = new Date('2026-10-01T00:00:00.000Z');

    const endsAt = new Date('2026-12-31T00:00:00.000Z');

    await service.create({
      tenantId,
      organizationId,

      name: '  Paris Expansion  ',

      description: '  Paris prospecting campaign  ',

      startsAt,
      endsAt,
    });

    expect(organizationRepository.findById).toHaveBeenCalledWith(tenantId, organizationId);

    expect(campaignRepository.create).toHaveBeenCalledWith({
      tenantId,
      organizationId,

      name: 'Paris Expansion',

      description: 'Paris prospecting campaign',

      status: 'draft',

      startsAt,
      endsAt,
    });
  });

  it('rejects a blank campaign name', async () => {
    await expect(
      service.create({
        tenantId,
        organizationId,
        name: '   ',
      }),
    ).rejects.toThrow('Campaign name is required');

    expect(campaignRepository.create).not.toHaveBeenCalled();
  });

  it('rejects an organization outside the tenant', async () => {
    organizationRepository.findById.mockResolvedValue(null);

    await expect(
      service.create({
        tenantId,
        organizationId,
        name: 'Paris Expansion',
      }),
    ).rejects.toThrow('Organization not found');

    expect(campaignRepository.create).not.toHaveBeenCalled();
  });

  it('rejects an invalid date range', async () => {
    organizationRepository.findById.mockResolvedValue({
      id: organizationId,
    });

    await expect(
      service.create({
        tenantId,
        organizationId,

        name: 'Paris Expansion',

        startsAt: new Date('2026-12-31T00:00:00.000Z'),

        endsAt: new Date('2026-10-01T00:00:00.000Z'),
      }),
    ).rejects.toThrow('Campaign end date cannot be before start date');

    expect(campaignRepository.create).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown campaign', async () => {
    campaignRepository.findById.mockResolvedValue(null);

    await expect(service.findById(tenantId, campaignId)).rejects.toThrow('Campaign not found');
  });

  it('lists tenant campaigns', async () => {
    campaignRepository.findByTenant.mockResolvedValue([campaign]);

    const result = await service.list(tenantId);

    expect(campaignRepository.findByTenant).toHaveBeenCalledWith(tenantId);

    expect(result).toEqual([campaign]);
  });

  it('allows draft to active transition', async () => {
    campaignRepository.findById.mockResolvedValue(campaign);

    campaignRepository.update.mockResolvedValue({
      ...campaign,
      status: 'active',
    });

    const result = await service.update(tenantId, campaignId, {
      status: 'active',
    });

    expect(campaignRepository.update).toHaveBeenCalledWith(tenantId, campaignId, {
      status: 'active',
    });

    expect(result.status).toBe('active');
  });

  it('rejects an invalid campaign status transition', async () => {
    campaignRepository.findById.mockResolvedValue({
      ...campaign,
      status: 'completed',
    });

    await expect(
      service.update(tenantId, campaignId, {
        status: 'active',
      }),
    ).rejects.toThrow('Campaign cannot transition from completed to active');

    expect(campaignRepository.update).not.toHaveBeenCalled();
  });

  it('validates dates against existing campaign values during update', async () => {
    campaignRepository.findById.mockResolvedValue(campaign);

    await expect(
      service.update(tenantId, campaignId, {
        startsAt: new Date('2027-01-01T00:00:00.000Z'),
      }),
    ).rejects.toThrow('Campaign end date cannot be before start date');

    expect(campaignRepository.update).not.toHaveBeenCalled();
  });
});
