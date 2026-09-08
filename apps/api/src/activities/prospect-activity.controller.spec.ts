import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProspectActivityController } from './prospect-activity.controller.js';
import { ProspectActivityService } from './prospect-activity.service.js';

describe('ProspectActivityController', () => {
  let prospectActivityService: {
    record: ReturnType<typeof vi.fn>;
  };

  let controller: ProspectActivityController;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const userId = '22222222-2222-4222-8222-222222222222';

  const campaignId = '33333333-3333-4333-8333-333333333333';

  const prospectId = '44444444-4444-4444-8444-444444444444';

  beforeEach(() => {
    prospectActivityService = {
      record: vi.fn().mockResolvedValue({
        id: '55555555-5555-4555-8555-555555555555',

        type: 'call',
      }),
    };

    controller = new ProspectActivityController(
      prospectActivityService as unknown as ProspectActivityService,
    );
  });

  it('uses authenticated tenant and user identity when recording activity', async () => {
    await controller.record(
      {
        tenantId,
        userId,
      },

      campaignId,

      prospectId,

      {
        type: 'call',
      },
    );

    expect(prospectActivityService.record).toHaveBeenCalledWith({
      tenantId,

      userId,

      campaignId,

      campaignProspectId: prospectId,

      type: 'call',
    });
  });
});
