import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthorizationService } from '../authorization/authorization.service.js';
import { WorkQueueRepository } from './work-queue.repository.js';
import { WorkQueueService } from './work-queue.service.js';
import type { WorkQueueItem, WorkQueueProspectDetail } from './work-queue.types.js';

describe('WorkQueueService', () => {
  let authorizationService: {
    getUserGrants: ReturnType<typeof vi.fn>;
  };

  let workQueueRepository: {
    findCampaignOptions: ReturnType<typeof vi.fn>;
    findAssignedProspects: ReturnType<typeof vi.fn>;
    findAssignedProspectById: ReturnType<typeof vi.fn>;
  };

  let service: WorkQueueService;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const userId = '22222222-2222-4222-8222-222222222222';

  const organizationId = '33333333-3333-4333-8333-333333333333';

  const teamId = '44444444-4444-4444-8444-444444444444';

  const otherTeamId = '55555555-5555-4555-8555-555555555555';

  const campaignId = '66666666-6666-4666-8666-666666666666';

  const firstAssignmentId = '77777777-7777-4777-8777-777777777777';

  const secondAssignmentId = '88888888-8888-4888-8888-888888888888';

  const thirdAssignmentId = '99999999-9999-4999-8999-999999999999';

  const establishmentId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const prospectId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  const detailAssignmentId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  function createItem(
    assignmentId: string,
    assignedAt: string,
    campaignProspectId: string,
  ): WorkQueueItem {
    return {
      campaignProspectId,

      lifecycleStage: 'to_contact',

      latestActivity:
        campaignProspectId === 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
          ? {
              type: 'call',

              occurredAt: new Date('2026-09-15T14:00:00.000Z'),
            }
          : null,

      nextFollowUp:
        campaignProspectId === 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
          ? {
              id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',

              dueAt: new Date('2026-09-18T09:00:00.000Z'),
            }
          : null,

      campaign: {
        id: campaignId,
        name: 'Paris Expansion',
      },

      assignment: {
        id: assignmentId,

        organizationId,

        teamId,

        assignedAt: new Date(assignedAt),
      },

      establishment: {
        id: campaignProspectId,

        regionId: null,

        name: 'Example Establishment',

        addressLine1: '10 Rue de Rivoli',

        postalCode: '75001',

        city: 'Paris',

        countryCode: 'FR',

        latitude: 49.1596,

        longitude: 5.3828,

        phone: null,

        website: null,

        status: 'active',
      },
    };
  }

  const firstItem = createItem(
    firstAssignmentId,
    '2026-09-16T09:30:00.000Z',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  );

  const secondItem = createItem(
    secondAssignmentId,
    '2026-09-16T09:20:00.000Z',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  );

  const thirdItem = createItem(
    thirdAssignmentId,
    '2026-09-16T09:10:00.000Z',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  );

  const prospectDetail: WorkQueueProspectDetail = {
    campaignProspectId: prospectId,

    lifecycleStage: 'in_progress',

    latestActivity: {
      type: 'visit',

      occurredAt: new Date('2026-09-15T10:00:00.000Z'),
    },

    campaign: {
      id: campaignId,
      name: 'Paris Expansion',
    },

    assignment: {
      id: detailAssignmentId,

      organizationId,

      teamId,

      assignedAt: new Date('2026-09-16T08:00:00.000Z'),
    },

    establishment: {
      id: establishmentId,

      regionId: null,

      name: 'Paris Clinic',

      addressLine1: '10 Rue de Rivoli',

      postalCode: '75001',

      city: 'Paris',

      countryCode: 'FR',

      latitude: 49.1596,

      longitude: 5.3828,

      phone: '+33100000000',

      website: 'https://paris-clinic.example',

      status: 'active',
    },
  };

  beforeEach(() => {
    authorizationService = {
      getUserGrants: vi.fn().mockResolvedValue([
        {
          role: 'prospector',

          scopeType: 'team',

          organizationId,

          teamId,
        },
      ]),
    };

    workQueueRepository = {
      findCampaignOptions: vi.fn().mockResolvedValue([]),
      findAssignedProspects: vi.fn().mockResolvedValue([]),

      findAssignedProspectById: vi.fn().mockResolvedValue(null),
    };

    service = new WorkQueueService(
      authorizationService as unknown as AuthorizationService,

      workQueueRepository as unknown as WorkQueueRepository,
    );
  });

  describe('list', () => {
    it('lists the authenticated prospector work queue for an exact team grant', async () => {
      workQueueRepository.findAssignedProspects.mockResolvedValue([firstItem]);

      await expect(
        service.list({
          tenantId,

          userId,

          teamId,
        }),
      ).resolves.toEqual({
        items: [firstItem],

        page: {
          limit: 25,

          hasMore: false,

          nextCursor: null,
        },
      });

      expect(authorizationService.getUserGrants).toHaveBeenCalledWith(tenantId, userId);

      expect(workQueueRepository.findAssignedProspects).toHaveBeenCalledWith({
        tenantId,

        userId,

        teamId,

        limit: 25,
      });
    });

    it('rejects a user without any prospector team grant', async () => {
      authorizationService.getUserGrants.mockResolvedValue([
        {
          role: 'manager',

          scopeType: 'team',

          organizationId,

          teamId,
        },
      ]);

      await expect(
        service.list({
          tenantId,

          userId,

          teamId,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(workQueueRepository.findAssignedProspects).not.toHaveBeenCalled();
    });

    it('rejects a prospector grant for a different team', async () => {
      authorizationService.getUserGrants.mockResolvedValue([
        {
          role: 'prospector',

          scopeType: 'team',

          organizationId,

          teamId: otherTeamId,
        },
      ]);

      await expect(
        service.list({
          tenantId,

          userId,

          teamId,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(workQueueRepository.findAssignedProspects).not.toHaveBeenCalled();
    });

    it('forwards campaign, lifecycle, search and explicit limit filters', async () => {
      await service.list({
        tenantId,

        userId,

        teamId,

        campaignId,

        lifecycleStage: 'follow_up',

        search: '  Paris Clinic  ',

        limit: 40,
      });

      expect(workQueueRepository.findAssignedProspects).toHaveBeenCalledWith({
        tenantId,

        userId,

        teamId,

        campaignId,

        lifecycleStage: 'follow_up',

        search: 'Paris Clinic',

        limit: 40,
      });
    });

    it('uses the extra repository row to create the next page cursor', async () => {
      workQueueRepository.findAssignedProspects.mockResolvedValue([
        firstItem,
        secondItem,
        thirdItem,
      ]);

      const result = await service.list({
        tenantId,

        userId,

        teamId,

        limit: 2,
      });

      expect(result.items).toEqual([firstItem, secondItem]);

      expect(result.page.limit).toBe(2);

      expect(result.page.hasMore).toBe(true);

      expect(result.page.nextCursor).not.toBeNull();

      const decoded = JSON.parse(
        Buffer.from(result.page.nextCursor!, 'base64url').toString('utf8'),
      ) as {
        assignedAt: string;

        assignmentId: string;
      };

      expect(decoded).toEqual({
        assignedAt: secondItem.assignment.assignedAt.toISOString(),

        assignmentId: secondAssignmentId,
      });
    });

    it('decodes a valid cursor before querying the repository', async () => {
      const cursor = Buffer.from(
        JSON.stringify({
          assignedAt: '2026-09-16T09:20:00.000Z',

          assignmentId: secondAssignmentId,
        }),
        'utf8',
      ).toString('base64url');

      await service.list({
        tenantId,

        userId,

        teamId,

        cursor,
      });

      expect(workQueueRepository.findAssignedProspects).toHaveBeenCalledWith({
        tenantId,

        userId,

        teamId,

        limit: 25,

        cursor: {
          assignedAt: new Date('2026-09-16T09:20:00.000Z'),

          assignmentId: secondAssignmentId,
        },
      });
    });

    it('rejects a malformed cursor before querying the repository', async () => {
      await expect(
        service.list({
          tenantId,

          userId,

          teamId,

          cursor: 'this-is-not-a-valid-work-queue-cursor',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(workQueueRepository.findAssignedProspects).not.toHaveBeenCalled();
    });

    it('rejects a cursor containing an invalid assignment id', async () => {
      const cursor = Buffer.from(
        JSON.stringify({
          assignedAt: '2026-09-16T09:20:00.000Z',

          assignmentId: 'not-a-uuid',
        }),
        'utf8',
      ).toString('base64url');

      await expect(
        service.list({
          tenantId,

          userId,

          teamId,

          cursor,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(workQueueRepository.findAssignedProspects).not.toHaveBeenCalled();
    });

    it('returns an empty final page without a cursor', async () => {
      const result = await service.list({
        tenantId,

        userId,

        teamId,
      });

      expect(result).toEqual({
        items: [],

        page: {
          limit: 25,

          hasMore: false,

          nextCursor: null,
        },
      });
    });

    describe('getOptions', () => {
      it('returns campaign options for the exact Prospector team workspace', async () => {
        const campaigns = [
          {
            id: campaignId,
            name: 'Paris Expansion',
          },
        ];

        workQueueRepository.findCampaignOptions.mockResolvedValue(campaigns);

        await expect(
          service.getOptions({
            tenantId,

            userId,

            teamId,
          }),
        ).resolves.toEqual({
          campaigns,
        });

        expect(authorizationService.getUserGrants).toHaveBeenCalledWith(tenantId, userId);

        expect(workQueueRepository.findCampaignOptions).toHaveBeenCalledWith({
          tenantId,

          userId,

          teamId,
        });
      });

      it('rejects campaign options when the user lacks a Prospector grant', async () => {
        authorizationService.getUserGrants.mockResolvedValue([
          {
            role: 'manager',

            scopeType: 'team',

            organizationId,

            teamId,
          },
        ]);

        await expect(
          service.getOptions({
            tenantId,

            userId,

            teamId,
          }),
        ).rejects.toBeInstanceOf(ForbiddenException);

        expect(workQueueRepository.findCampaignOptions).not.toHaveBeenCalled();
      });
    });
  });

  describe('getProspectDetail', () => {
    it('returns prospect detail for the exact prospector team workspace', async () => {
      workQueueRepository.findAssignedProspectById.mockResolvedValue(prospectDetail);

      await expect(
        service.getProspectDetail({
          tenantId,

          userId,

          teamId,

          campaignId,

          campaignProspectId: prospectId,
        }),
      ).resolves.toEqual(prospectDetail);

      expect(authorizationService.getUserGrants).toHaveBeenCalledWith(tenantId, userId);

      expect(workQueueRepository.findAssignedProspectById).toHaveBeenCalledWith({
        tenantId,

        userId,

        teamId,

        campaignId,

        campaignProspectId: prospectId,
      });
    });

    it('rejects prospect detail before lookup when the user lacks a prospector grant', async () => {
      authorizationService.getUserGrants.mockResolvedValue([
        {
          role: 'manager',

          scopeType: 'team',

          organizationId,

          teamId,
        },
      ]);

      await expect(
        service.getProspectDetail({
          tenantId,

          userId,

          teamId,

          campaignId,

          campaignProspectId: prospectId,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(workQueueRepository.findAssignedProspectById).not.toHaveBeenCalled();
    });

    it('rejects prospect detail before lookup when the prospector grant belongs to another team', async () => {
      authorizationService.getUserGrants.mockResolvedValue([
        {
          role: 'prospector',

          scopeType: 'team',

          organizationId,

          teamId: otherTeamId,
        },
      ]);

      await expect(
        service.getProspectDetail({
          tenantId,

          userId,

          teamId,

          campaignId,

          campaignProspectId: prospectId,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(workQueueRepository.findAssignedProspectById).not.toHaveBeenCalled();
    });

    it('returns masked not found when the scoped prospect detail does not exist', async () => {
      workQueueRepository.findAssignedProspectById.mockResolvedValue(null);

      await expect(
        service.getProspectDetail({
          tenantId,

          userId,

          teamId,

          campaignId,

          campaignProspectId: prospectId,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(workQueueRepository.findAssignedProspectById).toHaveBeenCalledWith({
        tenantId,

        userId,

        teamId,

        campaignId,

        campaignProspectId: prospectId,
      });
    });
  });
});
