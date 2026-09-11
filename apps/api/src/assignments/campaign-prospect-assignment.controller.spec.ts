import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CampaignProspectAssignmentController } from './campaign-prospect-assignment.controller.js';
import { CampaignProspectAssignmentService } from './campaign-prospect-assignment.service.js';

describe('CampaignProspectAssignmentController', () => {
  let service: {
    assign: ReturnType<typeof vi.fn>;

    reassign: ReturnType<typeof vi.fn>;
  };

  let controller: CampaignProspectAssignmentController;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const actorUserId = '22222222-2222-4222-8222-222222222222';

  const campaignId = '33333333-3333-4333-8333-333333333333';

  const prospectId = '44444444-4444-4444-8444-444444444444';

  const teamId = '55555555-5555-4555-8555-555555555555';

  beforeEach(() => {
    service = {
      assign: vi.fn(),

      reassign: vi.fn(),
    };

    controller = new CampaignProspectAssignmentController(
      service as unknown as CampaignProspectAssignmentService,
    );
  });

  it('uses the authenticated user as assignment audit actor', async () => {
    await controller.assign(
      {
        tenantId,

        userId: actorUserId,
      },

      campaignId,

      prospectId,

      {
        teamId,
      },
    );

    expect(service.assign).toHaveBeenCalledWith({
      tenantId,

      actorUserId,

      campaignId,

      campaignProspectId: prospectId,

      teamId,

      assignedUserId: undefined,
    });
  });

  it('uses the authenticated user as reassignment audit actor', async () => {
    await controller.reassign(
      {
        tenantId,

        userId: actorUserId,
      },

      campaignId,

      prospectId,

      {
        teamId,
      },
    );

    expect(service.reassign).toHaveBeenCalledWith({
      tenantId,

      actorUserId,

      campaignId,

      campaignProspectId: prospectId,

      teamId,

      assignedUserId: undefined,
    });
  });
});
