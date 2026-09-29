import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditService } from '../audit/audit.service.js';
import type { CampaignProspect } from '../database/schema/campaign-prospects.js';
import type { Campaign } from '../database/schema/campaigns.js';
import type { Database } from '../database/database.types.js';
import { EstablishmentRepository } from '../establishments/establishment.repository.js';
import { CampaignProspectRepository } from './campaign-prospect.repository.js';
import { CampaignProspectService } from './campaign-prospect.service.js';
import { CampaignRepository } from './campaign.repository.js';

describe('CampaignProspectService', () => {
  let database: {
    transaction: ReturnType<typeof vi.fn>;
  };

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

  let auditService: {
    record: ReturnType<typeof vi.fn>;
  };

  let service: CampaignProspectService;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const campaignId = '22222222-2222-4222-8222-222222222222';

  const establishmentId = '33333333-3333-4333-8333-333333333333';

  const prospectId = '44444444-4444-4444-8444-444444444444';

  const actorUserId = '55555555-5555-4555-8555-555555555555';

  const organizationId = '66666666-6666-4666-8666-666666666666';

  const transaction = {};

  const campaign: Campaign = {
    id: campaignId,

    tenantId,

    organizationId,

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

    lifecycleStage: 'to_contact',

    createdAt: new Date(),

    updatedAt: new Date(),
  };

  beforeEach(() => {
    database = {
      transaction: vi.fn(async (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };

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

    auditService = {
      record: vi.fn(),
    };

    service = new CampaignProspectService(
      database as unknown as Database,

      prospectRepository as unknown as CampaignProspectRepository,

      campaignRepository as unknown as CampaignRepository,

      establishmentRepository as unknown as EstablishmentRepository,

      auditService as unknown as AuditService,
    );
  });

  it('adds and audits an establishment added to a campaign', async () => {
    campaignRepository.findById.mockResolvedValue(campaign);

    establishmentRepository.findById.mockResolvedValue({
      id: establishmentId,
    });

    prospectRepository.findByCampaignAndEstablishment.mockResolvedValue(null);

    prospectRepository.create.mockResolvedValue(prospect);

    auditService.record.mockResolvedValue({});

    const result = await service.add({
      tenantId,
      actorUserId,
      campaignId,
      establishmentId,
    });

    expect(establishmentRepository.findById).toHaveBeenCalledWith(tenantId, establishmentId);

    expect(database.transaction).toHaveBeenCalledTimes(1);

    expect(prospectRepository.create).toHaveBeenCalledWith(
      {
        tenantId,
        campaignId,
        establishmentId,
        status: 'active',
      },
      transaction,
    );

    expect(auditService.record).toHaveBeenCalledWith(
      {
        tenantId,

        actorType: 'user',

        actorUserId,

        action: 'campaign_prospect.added',

        resourceType: 'campaign_prospect',

        resourceId: prospectId,

        metadata: {
          campaignId,
          establishmentId,
          status: 'active',
        },
      },
      transaction,
    );

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
        actorUserId,
        campaignId,
        establishmentId,
      }),
    ).rejects.toThrow('Establishment already belongs to campaign');

    expect(database.transaction).not.toHaveBeenCalled();

    expect(prospectRepository.create).not.toHaveBeenCalled();

    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('reactivates and audits an excluded membership instead of creating a duplicate', async () => {
    campaignRepository.findById.mockResolvedValue(campaign);

    establishmentRepository.findById.mockResolvedValue({
      id: establishmentId,
    });

    prospectRepository.findByCampaignAndEstablishment.mockResolvedValue({
      ...prospect,
      status: 'excluded',
    });

    prospectRepository.updateStatus.mockResolvedValue(prospect);

    auditService.record.mockResolvedValue({});

    const result = await service.add({
      tenantId,
      actorUserId,
      campaignId,
      establishmentId,
    });

    expect(database.transaction).toHaveBeenCalledTimes(1);

    expect(prospectRepository.updateStatus).toHaveBeenCalledWith(
      tenantId,
      campaignId,
      prospectId,
      'active',
      transaction,
    );

    expect(prospectRepository.create).not.toHaveBeenCalled();

    expect(auditService.record).toHaveBeenCalledWith(
      {
        tenantId,

        actorType: 'user',

        actorUserId,

        action: 'campaign_prospect.reactivated',

        resourceType: 'campaign_prospect',

        resourceId: prospectId,

        metadata: {
          campaignId,
          establishmentId,
          status: 'active',
        },
      },
      transaction,
    );

    expect(result.status).toBe('active');
  });

  it('rejects an establishment from another tenant', async () => {
    campaignRepository.findById.mockResolvedValue(campaign);

    establishmentRepository.findById.mockResolvedValue(null);

    await expect(
      service.add({
        tenantId,
        actorUserId,
        campaignId,
        establishmentId,
      }),
    ).rejects.toThrow('Establishment not found');

    expect(database.transaction).not.toHaveBeenCalled();

    expect(prospectRepository.create).not.toHaveBeenCalled();

    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown campaign', async () => {
    campaignRepository.findById.mockResolvedValue(null);

    await expect(
      service.add({
        tenantId,
        actorUserId,
        campaignId,
        establishmentId,
      }),
    ).rejects.toThrow('Campaign not found');

    expect(establishmentRepository.findById).not.toHaveBeenCalled();

    expect(database.transaction).not.toHaveBeenCalled();

    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('propagates audit failure while adding a campaign prospect', async () => {
    campaignRepository.findById.mockResolvedValue(campaign);

    establishmentRepository.findById.mockResolvedValue({
      id: establishmentId,
    });

    prospectRepository.findByCampaignAndEstablishment.mockResolvedValue(null);

    prospectRepository.create.mockResolvedValue(prospect);

    auditService.record.mockRejectedValue(new Error('audit write failed'));

    await expect(
      service.add({
        tenantId,
        actorUserId,
        campaignId,
        establishmentId,
      }),
    ).rejects.toThrow('audit write failed');

    expect(database.transaction).toHaveBeenCalledTimes(1);

    expect(prospectRepository.create).toHaveBeenCalledWith(
      {
        tenantId,
        campaignId,
        establishmentId,
        status: 'active',
      },
      transaction,
    );

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,

        actorType: 'user',

        actorUserId,

        action: 'campaign_prospect.added',

        resourceType: 'campaign_prospect',

        resourceId: prospectId,
      }),
      transaction,
    );
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

  /*
   * Explicit PATCH status mutation is intentionally
   * not audited yet in E3.3a.
   *
   * It will be instrumented in the next E3.3 step.
   */
  it('excludes and audits an active prospect', async () => {
    campaignRepository.findById.mockResolvedValue(campaign);

    prospectRepository.findById.mockResolvedValue(prospect);

    prospectRepository.updateStatus.mockResolvedValue({
      ...prospect,
      status: 'excluded',
    });

    auditService.record.mockResolvedValue({});

    const result = await service.updateStatus({
      tenantId,
      actorUserId,
      campaignId,
      prospectId,
      status: 'excluded',
    });

    expect(database.transaction).toHaveBeenCalledTimes(1);

    expect(prospectRepository.updateStatus).toHaveBeenCalledWith(
      tenantId,
      campaignId,
      prospectId,
      'excluded',
      transaction,
    );

    expect(auditService.record).toHaveBeenCalledWith(
      {
        tenantId,
        actorType: 'user',
        actorUserId,
        action: 'campaign_prospect.excluded',
        resourceType: 'campaign_prospect',
        resourceId: prospectId,
        metadata: {
          campaignId,
          establishmentId,
          status: 'excluded',
        },
      },
      transaction,
    );

    expect(result.status).toBe('excluded');
  });
  it('reactivates and audits an excluded prospect', async () => {
    campaignRepository.findById.mockResolvedValue(campaign);

    prospectRepository.findById.mockResolvedValue({
      ...prospect,
      status: 'excluded',
    });

    prospectRepository.updateStatus.mockResolvedValue(prospect);

    auditService.record.mockResolvedValue({});

    const result = await service.updateStatus({
      tenantId,
      actorUserId,
      campaignId,
      prospectId,
      status: 'active',
    });

    expect(database.transaction).toHaveBeenCalledTimes(1);

    expect(prospectRepository.updateStatus).toHaveBeenCalledWith(
      tenantId,
      campaignId,
      prospectId,
      'active',
      transaction,
    );

    expect(auditService.record).toHaveBeenCalledWith(
      {
        tenantId,
        actorType: 'user',
        actorUserId,
        action: 'campaign_prospect.reactivated',
        resourceType: 'campaign_prospect',
        resourceId: prospectId,
        metadata: {
          campaignId,
          establishmentId,
          status: 'active',
        },
      },
      transaction,
    );

    expect(result.status).toBe('active');
  });

  it('does not audit when campaign prospect status is unchanged', async () => {
    campaignRepository.findById.mockResolvedValue(campaign);

    prospectRepository.findById.mockResolvedValue(prospect);

    const result = await service.updateStatus({
      tenantId,
      actorUserId,
      campaignId,
      prospectId,
      status: 'active',
    });

    expect(result).toBe(prospect);

    expect(database.transaction).not.toHaveBeenCalled();

    expect(prospectRepository.updateStatus).not.toHaveBeenCalled();

    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('rejects membership changes for completed campaigns', async () => {
    campaignRepository.findById.mockResolvedValue({
      ...campaign,
      status: 'completed',
    });

    await expect(
      service.add({
        tenantId,
        actorUserId,
        campaignId,
        establishmentId,
      }),
    ).rejects.toThrow('Campaign is no longer editable');

    expect(establishmentRepository.findById).not.toHaveBeenCalled();

    expect(database.transaction).not.toHaveBeenCalled();

    expect(prospectRepository.create).not.toHaveBeenCalled();

    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('rejects membership changes for archived campaigns', async () => {
    campaignRepository.findById.mockResolvedValue({
      ...campaign,
      status: 'archived',
    });

    await expect(
      service.updateStatus({
        tenantId,
        actorUserId,
        campaignId,
        prospectId,
        status: 'excluded',
      }),
    ).rejects.toThrow('Campaign is no longer editable');

    expect(prospectRepository.updateStatus).not.toHaveBeenCalled();
  });
});
