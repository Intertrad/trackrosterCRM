import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditService } from '../audit/audit.service.js';
import type { Campaign } from '../database/schema/campaigns.js';
import type { Database } from '../database/database.types.js';
import { OrganizationRepository } from '../organizations/organization.repository.js';
import { CampaignRepository } from './campaign.repository.js';
import { CampaignService } from './campaign.service.js';

describe('CampaignService', () => {
  let database: {
    transaction: ReturnType<typeof vi.fn>;
  };

  let campaignRepository: {
    create: ReturnType<typeof vi.fn>;

    findById: ReturnType<typeof vi.fn>;

    findByTenant: ReturnType<typeof vi.fn>;

    update: ReturnType<typeof vi.fn>;
  };

  let organizationRepository: {
    findById: ReturnType<typeof vi.fn>;
  };

  let auditService: {
    record: ReturnType<typeof vi.fn>;
  };

  let service: CampaignService;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const organizationId = '22222222-2222-4222-8222-222222222222';

  const campaignId = '33333333-3333-4333-8333-333333333333';

  const actorUserId = '44444444-4444-4444-8444-444444444444';

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
  const transaction = {};

  beforeEach(() => {
    database = {
      transaction: vi.fn(async (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };

    campaignRepository = {
      create: vi.fn(),

      findById: vi.fn(),

      findByTenant: vi.fn(),

      update: vi.fn(),
    };

    organizationRepository = {
      findById: vi.fn(),
    };

    auditService = {
      record: vi.fn(),
    };

    service = new CampaignService(
      database as unknown as Database,

      campaignRepository as unknown as CampaignRepository,

      organizationRepository as unknown as OrganizationRepository,

      auditService as unknown as AuditService,
    );
  });

  it('creates, normalizes and audits a campaign', async () => {
    organizationRepository.findById.mockResolvedValue({
      id: organizationId,
    });

    campaignRepository.create.mockResolvedValue(campaign);

    auditService.record.mockResolvedValue({});

    const startsAt = new Date('2026-10-01T00:00:00.000Z');

    const endsAt = new Date('2026-12-31T00:00:00.000Z');

    const result = await service.create({
      tenantId,
      actorUserId,
      organizationId,

      name: '  Paris Expansion  ',

      description: '  Paris prospecting campaign  ',

      startsAt,
      endsAt,
    });

    expect(organizationRepository.findById).toHaveBeenCalledWith(tenantId, organizationId);

    expect(database.transaction).toHaveBeenCalledTimes(1);

    expect(campaignRepository.create).toHaveBeenCalledWith(
      {
        tenantId,
        organizationId,

        name: 'Paris Expansion',

        description: 'Paris prospecting campaign',

        status: 'draft',

        startsAt,
        endsAt,
      },
      transaction,
    );

    expect(auditService.record).toHaveBeenCalledWith(
      {
        tenantId,

        actorType: 'user',

        actorUserId,

        action: 'campaign.created',

        resourceType: 'campaign',

        resourceId: campaignId,

        metadata: {
          organizationId,
          status: 'draft',
        },
      },
      transaction,
    );

    expect(result).toEqual(campaign);
  });

  it('rejects a blank campaign name', async () => {
    await expect(
      service.create({
        tenantId,
        actorUserId,
        organizationId,
        name: '   ',
      }),
    ).rejects.toThrow('Campaign name is required');

    expect(database.transaction).not.toHaveBeenCalled();

    expect(campaignRepository.create).not.toHaveBeenCalled();

    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('rejects an organization outside the tenant', async () => {
    organizationRepository.findById.mockResolvedValue(null);

    await expect(
      service.create({
        tenantId,
        actorUserId,
        organizationId,
        name: 'Paris Expansion',
      }),
    ).rejects.toThrow('Organization not found');

    expect(database.transaction).not.toHaveBeenCalled();

    expect(campaignRepository.create).not.toHaveBeenCalled();

    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('rejects an invalid date range', async () => {
    organizationRepository.findById.mockResolvedValue({
      id: organizationId,
    });

    await expect(
      service.create({
        tenantId,
        actorUserId,
        organizationId,

        name: 'Paris Expansion',

        startsAt: new Date('2026-12-31T00:00:00.000Z'),

        endsAt: new Date('2026-10-01T00:00:00.000Z'),
      }),
    ).rejects.toThrow('Campaign end date cannot be before start date');

    expect(database.transaction).not.toHaveBeenCalled();

    expect(campaignRepository.create).not.toHaveBeenCalled();

    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('propagates audit failure during campaign creation', async () => {
    organizationRepository.findById.mockResolvedValue({
      id: organizationId,
    });

    campaignRepository.create.mockResolvedValue(campaign);

    auditService.record.mockRejectedValue(new Error('audit write failed'));

    await expect(
      service.create({
        tenantId,
        actorUserId,
        organizationId,
        name: 'Paris Expansion',
      }),
    ).rejects.toThrow('audit write failed');

    expect(database.transaction).toHaveBeenCalledTimes(1);

    expect(campaignRepository.create).toHaveBeenCalledWith(expect.any(Object), transaction);

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,

        actorType: 'user',

        actorUserId,

        action: 'campaign.created',

        resourceType: 'campaign',

        resourceId: campaignId,
      }),
      transaction,
    );
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

  it('allows draft to active transition and audits the update', async () => {
    campaignRepository.findById.mockResolvedValue(campaign);

    campaignRepository.update.mockResolvedValue({
      ...campaign,
      status: 'active',
    });

    auditService.record.mockResolvedValue({});

    const result = await service.update({
      tenantId,
      actorUserId,
      campaignId,
      status: 'active',
    });

    expect(database.transaction).toHaveBeenCalledTimes(1);

    expect(campaignRepository.update).toHaveBeenCalledWith(
      tenantId,
      campaignId,
      {
        status: 'active',
      },
      transaction,
    );

    expect(auditService.record).toHaveBeenCalledWith(
      {
        tenantId,
        actorType: 'user',
        actorUserId,
        action: 'campaign.updated',
        resourceType: 'campaign',
        resourceId: campaignId,
        metadata: {
          organizationId,
          status: 'active',
        },
      },
      transaction,
    );

    expect(result.status).toBe('active');
  });

  it('rejects an invalid campaign status transition', async () => {
    campaignRepository.findById.mockResolvedValue({
      ...campaign,
      status: 'completed',
    });

    await expect(
      service.update({
        tenantId,
        actorUserId,
        campaignId,
        status: 'active',
      }),
    ).rejects.toThrow('Campaign cannot transition from completed to active');

    expect(database.transaction).not.toHaveBeenCalled();

    expect(campaignRepository.update).not.toHaveBeenCalled();

    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('validates dates against existing campaign values during update', async () => {
    campaignRepository.findById.mockResolvedValue(campaign);

    await expect(
      service.update({
        tenantId,
        actorUserId,
        campaignId,
        startsAt: new Date('2027-01-01T00:00:00.000Z'),
      }),
    ).rejects.toThrow('Campaign end date cannot be before start date');

    expect(database.transaction).not.toHaveBeenCalled();

    expect(campaignRepository.update).not.toHaveBeenCalled();

    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('propagates audit failure during campaign update', async () => {
    campaignRepository.findById.mockResolvedValue(campaign);

    campaignRepository.update.mockResolvedValue({
      ...campaign,
      status: 'active',
    });

    auditService.record.mockRejectedValue(new Error('audit write failed'));

    await expect(
      service.update({
        tenantId,
        actorUserId,
        campaignId,
        status: 'active',
      }),
    ).rejects.toThrow('audit write failed');

    expect(campaignRepository.update).toHaveBeenCalledWith(
      tenantId,
      campaignId,
      {
        status: 'active',
      },
      transaction,
    );

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        actorType: 'user',
        actorUserId,
        action: 'campaign.updated',
        resourceType: 'campaign',
        resourceId: campaignId,
      }),
      transaction,
    );
  });
});
