import { ServiceUnavailableException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProspectActivityRepository } from '../activities/prospect-activity.repository.js';
import { CampaignProspectAssignmentRepository } from '../assignments/campaign-prospect-assignment.repository.js';
import { CoordinationCollisionPolicyService } from '../coordination/coordination-collision-policy.service.js';
import { CoolingOffService } from '../cooling-off/cooling-off.service.js';
import { ProspectFollowUpRepository } from '../follow-ups/prospect-follow-up.repository.js';
import { CollisionBusinessDecisionService } from './collision-business-decision.service.js';

describe('CollisionBusinessDecisionService', () => {
  let followUpRepository: {
    findConflictingPendingCandidatesByEstablishment: ReturnType<typeof vi.fn>;
  };

  let assignmentRepository: {
    findConflictingCurrentCandidatesByEstablishment: ReturnType<typeof vi.fn>;
  };

  let activityRepository: {
    findCandidatesByEstablishment: ReturnType<typeof vi.fn>;
  };

  let coolingOffService: {
    evaluateActivity: ReturnType<typeof vi.fn>;
  };

  let coordinationService: {
    evaluate: ReturnType<typeof vi.fn>;
  };

  let service: CollisionBusinessDecisionService;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const userId = '22222222-2222-4222-8222-222222222222';

  const campaignId = '33333333-3333-4333-8333-333333333333';

  const campaignProspectId = '44444444-4444-4444-8444-444444444444';

  const establishmentId = '55555555-5555-4555-8555-555555555555';

  const targetOrganizationId = '66666666-6666-4666-8666-666666666666';

  const conflictingOrganizationId = '77777777-7777-4777-8777-777777777777';

  const input = {
    tenantId,
    userId,
    campaignId,
    campaignProspectId,
    establishmentId,
    targetOrganizationId,
  };

  beforeEach(() => {
    followUpRepository = {
      findConflictingPendingCandidatesByEstablishment: vi.fn().mockResolvedValue([]),
    };

    assignmentRepository = {
      findConflictingCurrentCandidatesByEstablishment: vi.fn().mockResolvedValue([]),
    };

    activityRepository = {
      findCandidatesByEstablishment: vi.fn().mockResolvedValue([]),
    };

    coolingOffService = {
      evaluateActivity: vi.fn(),
    };

    coordinationService = {
      evaluate: vi.fn(),
    };

    service = new CollisionBusinessDecisionService(
      coolingOffService as unknown as CoolingOffService,

      followUpRepository as unknown as ProspectFollowUpRepository,

      assignmentRepository as unknown as CampaignProspectAssignmentRepository,

      activityRepository as unknown as ProspectActivityRepository,

      coordinationService as unknown as CoordinationCollisionPolicyService,
    );
  });

  it('allows when no persisted business collision exists', async () => {
    await expect(service.evaluate(input)).resolves.toEqual({
      decision: 'allow',

      reasonCode: 'NO_COLLISION',

      establishmentId,

      conflict: null,
    });
  });

  it('blocks an applicable planned action', async () => {
    const dueAt = new Date('2026-09-11T10:00:00.000Z');

    followUpRepository.findConflictingPendingCandidatesByEstablishment.mockResolvedValue([
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',

        campaignId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',

        campaignProspectId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',

        assignmentId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',

        organizationId: conflictingOrganizationId,

        assignedUserId: null,

        dueAt,
      },
    ]);

    coordinationService.evaluate.mockResolvedValue({
      action: 'block',
      policy: 'coordinated',
      delayMinutes: null,
    });

    const result = await service.evaluate(input);

    expect(result).toEqual({
      decision: 'block',

      reasonCode: 'PLANNED_ACTION',

      establishmentId,

      conflict: {
        followUpId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',

        campaignId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',

        campaignProspectId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',

        assignmentId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',

        assignedUserId: null,

        dueAt: '2026-09-11T10:00:00.000Z',
      },
    });
  });

  it('ignores an independent planned action', async () => {
    followUpRepository.findConflictingPendingCandidatesByEstablishment.mockResolvedValue([
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',

        campaignId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',

        campaignProspectId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',

        assignmentId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',

        organizationId: conflictingOrganizationId,

        assignedUserId: null,

        dueAt: new Date('2026-09-11T10:00:00.000Z'),
      },
    ]);

    coordinationService.evaluate.mockResolvedValue({
      action: 'ignore',
      policy: 'independent',
      delayMinutes: null,
    });

    await expect(service.evaluate(input)).resolves.toEqual({
      decision: 'allow',

      reasonCode: 'NO_COLLISION',

      establishmentId,

      conflict: null,
    });
  });

  it('blocks an active recent-contact cooling-off window', async () => {
    const activity = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',

      type: 'call' as const,

      organizationId: conflictingOrganizationId,

      occurredAt: new Date('2026-09-10T08:00:00.000Z'),
    };

    activityRepository.findCandidatesByEstablishment.mockResolvedValue([activity]);

    coordinationService.evaluate.mockResolvedValue({
      action: 'block',
      policy: 'coordinated',
      delayMinutes: null,
    });

    coolingOffService.evaluateActivity.mockReturnValue({
      active: true,

      expiresAt: new Date('2026-09-10T15:00:00.000Z'),
    });

    const result = await service.evaluate(input);

    expect(result).toEqual({
      decision: 'block',

      reasonCode: 'RECENT_CONTACT',

      establishmentId,

      conflict: {
        activityId: activity.id,

        activityType: activity.type,

        occurredAt: activity.occurredAt.toISOString(),

        expiresAt: '2026-09-10T15:00:00.000Z',
      },
    });
  });

  it('blocks an active delayed recent-contact window using policy delay', async () => {
    const activity = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',

      type: 'email' as const,

      organizationId: conflictingOrganizationId,

      occurredAt: new Date('2026-09-10T08:00:00.000Z'),
    };

    activityRepository.findCandidatesByEstablishment.mockResolvedValue([activity]);

    coordinationService.evaluate.mockResolvedValue({
      action: 'delayed',
      policy: 'delayed',
      delayMinutes: 180,
    });

    coolingOffService.evaluateActivity.mockReturnValue({
      active: true,

      expiresAt: new Date('2026-09-10T11:00:00.000Z'),
    });

    const result = await service.evaluate(input);

    expect(coolingOffService.evaluateActivity).toHaveBeenCalledWith(
      activity,
      expect.any(Date),
      180,
    );

    expect(result.reasonCode).toBe('RECENT_CONTACT');

    expect(result.decision).toBe('block');
  });

  it('continues when a delayed recent-contact window has expired', async () => {
    const activity = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',

      type: 'call' as const,

      organizationId: conflictingOrganizationId,

      occurredAt: new Date('2026-09-09T08:00:00.000Z'),
    };

    activityRepository.findCandidatesByEstablishment.mockResolvedValue([activity]);

    coordinationService.evaluate.mockResolvedValue({
      action: 'delayed',
      policy: 'delayed',
      delayMinutes: 60,
    });

    coolingOffService.evaluateActivity.mockReturnValue({
      active: false,

      expiresAt: new Date('2026-09-09T09:00:00.000Z'),
    });

    await expect(service.evaluate(input)).resolves.toEqual({
      decision: 'allow',

      reasonCode: 'NO_COLLISION',

      establishmentId,

      conflict: null,
    });
  });

  it('ignores recent activity from an independent organization', async () => {
    const activity = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',

      type: 'call' as const,

      organizationId: conflictingOrganizationId,

      occurredAt: new Date('2026-09-10T08:00:00.000Z'),
    };

    activityRepository.findCandidatesByEstablishment.mockResolvedValue([activity]);

    coordinationService.evaluate.mockResolvedValue({
      action: 'ignore',
      policy: 'independent',
      delayMinutes: null,
    });

    await expect(service.evaluate(input)).resolves.toEqual({
      decision: 'allow',

      reasonCode: 'NO_COLLISION',

      establishmentId,

      conflict: null,
    });

    expect(coolingOffService.evaluateActivity).not.toHaveBeenCalled();
  });

  it('selects the recent contact with the latest effective expiry', async () => {
    const firstActivity = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',

      type: 'call' as const,

      organizationId: conflictingOrganizationId,

      occurredAt: new Date('2026-09-10T08:00:00.000Z'),
    };

    const secondActivity = {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',

      type: 'email' as const,

      organizationId: conflictingOrganizationId,

      occurredAt: new Date('2026-09-10T09:00:00.000Z'),
    };

    activityRepository.findCandidatesByEstablishment.mockResolvedValue([
      firstActivity,
      secondActivity,
    ]);

    coordinationService.evaluate.mockResolvedValue({
      action: 'block',
      policy: 'coordinated',
      delayMinutes: null,
    });

    coolingOffService.evaluateActivity
      .mockReturnValueOnce({
        active: true,

        expiresAt: new Date('2026-09-10T13:00:00.000Z'),
      })
      .mockReturnValueOnce({
        active: true,

        expiresAt: new Date('2026-09-10T15:00:00.000Z'),
      });

    const result = await service.evaluate(input);

    expect(result.reasonCode).toBe('RECENT_CONTACT');

    expect(result.conflict).toEqual(
      expect.objectContaining({
        activityId: secondActivity.id,

        expiresAt: '2026-09-10T15:00:00.000Z',
      }),
    );
  });

  it('blocks an active assignment under coordinated policy', async () => {
    const assignedAt = new Date('2026-09-10T08:00:00.000Z');

    assignmentRepository.findConflictingCurrentCandidatesByEstablishment.mockResolvedValue([
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',

        tenantId,

        campaignId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',

        campaignProspectId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',

        organizationId: conflictingOrganizationId,

        teamId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',

        assignedUserId: null,

        assignedAt,

        endedAt: null,
      },
    ]);

    coordinationService.evaluate.mockResolvedValue({
      action: 'block',
      policy: 'coordinated',
      delayMinutes: null,
    });

    const result = await service.evaluate(input);

    expect(result).toEqual({
      decision: 'block',

      reasonCode: 'ACTIVE_ASSIGNMENT',

      establishmentId,

      conflict: {
        assignmentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',

        campaignId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',

        campaignProspectId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',

        organizationId: conflictingOrganizationId,

        teamId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',

        assignedUserId: null,

        assignedAt: assignedAt.toISOString(),
      },
    });
  });

  it('returns a warning for a shared advisory assignment', async () => {
    assignmentRepository.findConflictingCurrentCandidatesByEstablishment.mockResolvedValue([
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',

        tenantId,

        campaignId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',

        campaignProspectId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',

        organizationId: conflictingOrganizationId,

        teamId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',

        assignedUserId: null,

        assignedAt: new Date('2026-09-10T08:00:00.000Z'),

        endedAt: null,
      },
    ]);

    coordinationService.evaluate.mockResolvedValue({
      action: 'warn',
      policy: 'shared',
      delayMinutes: null,
    });

    const result = await service.evaluate(input);

    expect(result.decision).toBe('warn');

    expect(result.reasonCode).toBe('ACTIVE_ASSIGNMENT');
  });

  it('ignores an independent active assignment', async () => {
    assignmentRepository.findConflictingCurrentCandidatesByEstablishment.mockResolvedValue([
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',

        tenantId,

        campaignId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',

        campaignProspectId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',

        organizationId: conflictingOrganizationId,

        teamId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',

        assignedUserId: null,

        assignedAt: new Date('2026-09-10T08:00:00.000Z'),

        endedAt: null,
      },
    ]);

    coordinationService.evaluate.mockResolvedValue({
      action: 'ignore',
      policy: 'independent',
      delayMinutes: null,
    });

    await expect(service.evaluate(input)).resolves.toEqual({
      decision: 'allow',

      reasonCode: 'NO_COLLISION',

      establishmentId,

      conflict: null,
    });
  });

  it('fails closed when planned-action lookup fails', async () => {
    followUpRepository.findConflictingPendingCandidatesByEstablishment.mockRejectedValue(
      new Error('database unavailable'),
    );

    await expect(service.evaluate(input)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('fails closed when activity lookup fails', async () => {
    activityRepository.findCandidatesByEstablishment.mockRejectedValue(
      new Error('database unavailable'),
    );

    await expect(service.evaluate(input)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('fails closed when assignment lookup fails', async () => {
    assignmentRepository.findConflictingCurrentCandidatesByEstablishment.mockRejectedValue(
      new Error('database unavailable'),
    );

    await expect(service.evaluate(input)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('fails closed when delayed coordination has an invalid delay', async () => {
    const activity = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',

      type: 'call' as const,

      organizationId: conflictingOrganizationId,

      occurredAt: new Date('2026-09-10T08:00:00.000Z'),
    };

    activityRepository.findCandidatesByEstablishment.mockResolvedValue([activity]);

    coordinationService.evaluate.mockResolvedValue({
      action: 'delayed',

      policy: 'delayed',

      delayMinutes: 0,
    });

    await expect(service.evaluate(input)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
