import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CampaignProspectAssignmentRepository } from '../assignments/campaign-prospect-assignment.repository.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { CampaignProspectRepository } from '../campaigns/campaign-prospect.repository.js';
import { CampaignRepository } from '../campaigns/campaign.repository.js';
import { ProspectActivityRepository } from './prospect-activity.repository.js';
import { ProspectTimelineService } from './prospect-timeline.service.js';

describe('ProspectTimelineService', () => {
  let prospectActivityRepository: {
    findTimelineByCampaignProspect: ReturnType<typeof vi.fn>;
  };

  let campaignRepository: {
    findById: ReturnType<typeof vi.fn>;
  };

  let campaignProspectRepository: {
    findById: ReturnType<typeof vi.fn>;
  };

  let assignmentRepository: {
    findCurrent: ReturnType<typeof vi.fn>;
  };

  let authorizationService: {
    canViewTeam: ReturnType<typeof vi.fn>;

    canViewOrganization: ReturnType<typeof vi.fn>;
  };

  let service: ProspectTimelineService;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const userId = '22222222-2222-4222-8222-222222222222';

  const campaignId = '33333333-3333-4333-8333-333333333333';

  const campaignProspectId = '44444444-4444-4444-8444-444444444444';

  const establishmentId = '55555555-5555-4555-8555-555555555555';

  const assignmentId = '66666666-6666-4666-8666-666666666666';

  const organizationId = '77777777-7777-4777-8777-777777777777';

  const teamId = '88888888-8888-4888-8888-888888888888';

  const activityId = '99999999-9999-4999-8999-999999999999';

  const reservationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const occurredAt = new Date('2026-09-09T09:00:00.000Z');

  const createdAt = new Date('2026-09-09T09:00:01.000Z');

  const campaign = {
    id: campaignId,

    tenantId,

    organizationId,

    name: 'Paris Campaign',

    description: null,

    status: 'active',

    startsAt: null,

    endsAt: null,

    createdAt: new Date('2026-09-01T00:00:00.000Z'),

    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
  };

  const prospect = {
    id: campaignProspectId,

    tenantId,

    campaignId,

    establishmentId,

    status: 'active',

    createdAt: new Date('2026-09-01T00:00:00.000Z'),

    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
  };

  const assignment = {
    id: assignmentId,

    tenantId,

    campaignId,

    campaignProspectId,

    organizationId,

    teamId,

    assignedUserId: userId,

    assignedByUserId: userId,

    assignedAt: new Date('2026-09-01T00:00:00.000Z'),

    endedAt: null,

    createdAt: new Date('2026-09-01T00:00:00.000Z'),
  };

  const activity = {
    id: activityId,

    tenantId,

    campaignId,

    campaignProspectId,

    establishmentId,

    assignmentId,

    userId,

    reservationId,

    type: 'call' as const,

    occurredAt,

    createdAt,
  };

  beforeEach(() => {
    prospectActivityRepository = {
      findTimelineByCampaignProspect: vi.fn().mockResolvedValue({
        items: [activity],

        nextCursor: null,
      }),
    };

    campaignRepository = {
      findById: vi.fn().mockResolvedValue(campaign),
    };

    campaignProspectRepository = {
      findById: vi.fn().mockResolvedValue(prospect),
    };

    assignmentRepository = {
      findCurrent: vi.fn().mockResolvedValue(assignment),
    };

    authorizationService = {
      canViewTeam: vi.fn().mockResolvedValue(true),

      canViewOrganization: vi.fn().mockResolvedValue(true),
    };

    service = new ProspectTimelineService(
      prospectActivityRepository as unknown as ProspectActivityRepository,
      campaignRepository as unknown as CampaignRepository,
      campaignProspectRepository as unknown as CampaignProspectRepository,
      assignmentRepository as unknown as CampaignProspectAssignmentRepository,
      authorizationService as unknown as AuthorizationService,
    );
  });

  it('returns a public activity timeline using current team authorization', async () => {
    const result = await service.getTimeline({
      tenantId,

      userId,

      campaignId,

      campaignProspectId,
    });

    expect(authorizationService.canViewTeam).toHaveBeenCalledWith(
      tenantId,
      userId,
      organizationId,
      teamId,
    );

    expect(authorizationService.canViewOrganization).not.toHaveBeenCalled();

    expect(prospectActivityRepository.findTimelineByCampaignProspect).toHaveBeenCalledWith(
      tenantId,
      campaignId,
      campaignProspectId,
      {
        limit: 50,

        cursor: null,
      },
    );

    expect(result).toEqual({
      items: [
        {
          kind: 'activity',

          id: activityId,

          occurredAt: occurredAt.toISOString(),

          activityType: 'call',

          actor: {
            userId,
          },

          context: {
            campaignId,

            campaignProspectId,

            establishmentId,

            assignmentId,
          },
        },
      ],

      nextCursor: null,
    });
  });

  it('does not expose internal reservation or tenant metadata', async () => {
    const result = await service.getTimeline({
      tenantId,

      userId,

      campaignId,

      campaignProspectId,
    });

    const item = result.items[0];

    expect(item).toBeDefined();

    expect(item).not.toHaveProperty('tenantId');

    expect(item).not.toHaveProperty('reservationId');

    expect(item).not.toHaveProperty('createdAt');
  });

  it('uses organization authorization when the prospect has no current assignment', async () => {
    assignmentRepository.findCurrent.mockResolvedValue(null);

    await service.getTimeline({
      tenantId,

      userId,

      campaignId,

      campaignProspectId,
    });

    expect(authorizationService.canViewOrganization).toHaveBeenCalledWith(
      tenantId,
      userId,
      organizationId,
    );

    expect(authorizationService.canViewTeam).not.toHaveBeenCalled();
  });

  it('rejects an assigned prospect when the user cannot view the current team', async () => {
    authorizationService.canViewTeam.mockResolvedValue(false);

    await expect(
      service.getTimeline({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prospectActivityRepository.findTimelineByCampaignProspect).not.toHaveBeenCalled();
  });

  it('rejects an unassigned prospect when the user cannot view its organization', async () => {
    assignmentRepository.findCurrent.mockResolvedValue(null);

    authorizationService.canViewOrganization.mockResolvedValue(false);

    await expect(
      service.getTimeline({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prospectActivityRepository.findTimelineByCampaignProspect).not.toHaveBeenCalled();
  });

  it('returns not found when the campaign does not exist', async () => {
    campaignRepository.findById.mockResolvedValue(null);

    await expect(
      service.getTimeline({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(campaignProspectRepository.findById).not.toHaveBeenCalled();

    expect(assignmentRepository.findCurrent).not.toHaveBeenCalled();
  });

  it('returns not found when the campaign prospect does not exist', async () => {
    campaignProspectRepository.findById.mockResolvedValue(null);

    await expect(
      service.getTimeline({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(assignmentRepository.findCurrent).not.toHaveBeenCalled();
  });

  it.each([0, -1, 101, 1.5])('rejects invalid timeline limit %s', async (limit) => {
    await expect(
      service.getTimeline({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,

        limit,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(campaignRepository.findById).not.toHaveBeenCalled();
  });

  it('rejects a malformed cursor', async () => {
    await expect(
      service.getTimeline({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,

        cursor: 'not-a-valid-cursor',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prospectActivityRepository.findTimelineByCampaignProspect).not.toHaveBeenCalled();
  });

  it('encodes and decodes a stable repository cursor', async () => {
    const nextActivityId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

    const cursorOccurredAt = new Date('2026-09-08T12:00:00.000Z');

    const cursorCreatedAt = new Date('2026-09-08T12:00:01.000Z');

    prospectActivityRepository.findTimelineByCampaignProspect
      .mockResolvedValueOnce({
        items: [activity],

        nextCursor: {
          occurredAt: cursorOccurredAt,

          createdAt: cursorCreatedAt,

          id: nextActivityId,
        },
      })
      .mockResolvedValueOnce({
        items: [],

        nextCursor: null,
      });

    const firstPage = await service.getTimeline({
      tenantId,

      userId,

      campaignId,

      campaignProspectId,

      limit: 1,
    });

    expect(firstPage.nextCursor).toEqual(expect.any(String));

    await service.getTimeline({
      tenantId,

      userId,

      campaignId,

      campaignProspectId,

      limit: 1,

      cursor: firstPage.nextCursor ?? undefined,
    });

    expect(prospectActivityRepository.findTimelineByCampaignProspect).toHaveBeenNthCalledWith(
      2,
      tenantId,
      campaignId,
      campaignProspectId,
      {
        limit: 1,

        cursor: {
          occurredAt: cursorOccurredAt,

          createdAt: cursorCreatedAt,

          id: nextActivityId,
        },
      },
    );
  });

  it('allows history reads even when the campaign is archived', async () => {
    campaignRepository.findById.mockResolvedValue({
      ...campaign,

      status: 'archived',
    });

    await expect(
      service.getTimeline({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,
      }),
    ).resolves.toBeDefined();

    expect(prospectActivityRepository.findTimelineByCampaignProspect).toHaveBeenCalled();
  });
});
