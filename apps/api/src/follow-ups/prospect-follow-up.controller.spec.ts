import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProspectFollowUpController } from './prospect-follow-up.controller.js';
import { ProspectFollowUpQueryService } from './prospect-follow-up-query.service.js';
import { ProspectFollowUpService } from './prospect-follow-up.service.js';

describe('ProspectFollowUpController', () => {
  let followUpService: {
    create: ReturnType<typeof vi.fn>;

    reschedule: ReturnType<typeof vi.fn>;

    complete: ReturnType<typeof vi.fn>;

    cancel: ReturnType<typeof vi.fn>;
  };

  let followUpQueryService: {
    listByProspect: ReturnType<typeof vi.fn>;
  };

  let controller: ProspectFollowUpController;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const userId = '22222222-2222-4222-8222-222222222222';

  const campaignId = '33333333-3333-4333-8333-333333333333';

  const prospectId = '44444444-4444-4444-8444-444444444444';

  const followUpId = '55555555-5555-4555-8555-555555555555';

  const dueAt = new Date('2026-09-15T10:00:00.000Z');

  beforeEach(() => {
    followUpService = {
      create: vi.fn().mockResolvedValue({}),

      reschedule: vi.fn().mockResolvedValue({}),

      complete: vi.fn().mockResolvedValue({}),

      cancel: vi.fn().mockResolvedValue({}),
    };

    followUpQueryService = {
      listByProspect: vi.fn().mockResolvedValue({
        items: [],
      }),
    };

    controller = new ProspectFollowUpController(
      followUpService as unknown as ProspectFollowUpService,
      followUpQueryService as unknown as ProspectFollowUpQueryService,
    );
  });

  it('lists follow-ups using authenticated tenant and user identity', async () => {
    await controller.list(
      {
        tenantId,

        userId,
      },

      campaignId,

      prospectId,
    );

    expect(followUpQueryService.listByProspect).toHaveBeenCalledWith({
      tenantId,

      userId,

      campaignId,

      campaignProspectId: prospectId,
    });
  });

  it('creates a follow-up using route and authenticated context', async () => {
    await controller.create(
      {
        tenantId,

        userId,
      },

      campaignId,

      prospectId,

      {
        dueAt,
      },
    );

    expect(followUpService.create).toHaveBeenCalledWith({
      tenantId,

      userId,

      campaignId,

      campaignProspectId: prospectId,

      dueAt,

      assignedUserId: undefined,
    });
  });

  it('passes explicit team ownership when assignedUserId is null', async () => {
    await controller.create(
      {
        tenantId,

        userId,
      },

      campaignId,

      prospectId,

      {
        dueAt,

        assignedUserId: null,
      },
    );

    expect(followUpService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        assignedUserId: null,
      }),
    );
  });

  it('reschedules the exact follow-up', async () => {
    await controller.reschedule(
      {
        tenantId,

        userId,
      },

      campaignId,

      prospectId,

      followUpId,

      {
        dueAt,
      },
    );

    expect(followUpService.reschedule).toHaveBeenCalledWith({
      tenantId,

      userId,

      campaignId,

      campaignProspectId: prospectId,

      followUpId,

      dueAt,
    });
  });

  it('completes the exact follow-up', async () => {
    await controller.complete(
      {
        tenantId,

        userId,
      },

      campaignId,

      prospectId,

      followUpId,
    );

    expect(followUpService.complete).toHaveBeenCalledWith({
      tenantId,

      userId,

      campaignId,

      campaignProspectId: prospectId,

      followUpId,
    });
  });

  it('cancels the exact follow-up', async () => {
    await controller.cancel(
      {
        tenantId,

        userId,
      },

      campaignId,

      prospectId,

      followUpId,
    );

    expect(followUpService.cancel).toHaveBeenCalledWith({
      tenantId,

      userId,

      campaignId,

      campaignProspectId: prospectId,

      followUpId,
    });
  });
});
