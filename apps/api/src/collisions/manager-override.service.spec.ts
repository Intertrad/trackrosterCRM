import { ConflictException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CampaignProspectAssignmentRepository } from '../assignments/campaign-prospect-assignment.repository.js';
import type { AuditService } from '../audit/audit.service.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import type { CampaignProspectAssignment } from '../database/schema/campaign-prospect-assignments.js';
import type { Database } from '../database/database.types.js';
import { ReservationService } from '../reservations/reservation.service.js';
import { CollisionDecisionService } from './collision-decision.service.js';
import { CollisionOverrideRepository } from './collision-override.repository.js';
import { ManagerOverrideService } from './manager-override.service.js';

describe('ManagerOverrideService', () => {
  let database: {
    transaction: ReturnType<typeof vi.fn>;
  };

  let assignmentRepository: CampaignProspectAssignmentRepository;

  let auditService: {
    record: ReturnType<typeof vi.fn>;
  };

  let collisionDecisionService: CollisionDecisionService;

  let collisionOverrideRepository: CollisionOverrideRepository;

  let authorizationService: AuthorizationService;

  let reservationService: ReservationService;

  let service: ManagerOverrideService;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const approverUserId = '22222222-2222-4222-8222-222222222222';

  const prospectorUserId = '33333333-3333-4333-8333-333333333333';

  const campaignId = '44444444-4444-4444-8444-444444444444';

  const campaignProspectId = '55555555-5555-4555-8555-555555555555';

  const establishmentId = '66666666-6666-4666-8666-666666666666';

  const assignmentId = '77777777-7777-4777-8777-777777777777';

  const organizationId = '88888888-8888-4888-8888-888888888888';

  const teamId = '99999999-9999-4999-8999-999999999999';

  const followUpId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const overrideId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

  const transaction = {};

  const assignment = {
    id: assignmentId,

    tenantId,

    campaignId,

    campaignProspectId,

    organizationId,

    teamId,

    assignedUserId: prospectorUserId,

    assignedAt: new Date(),

    endedAt: null,
  } as CampaignProspectAssignment;

  beforeEach(() => {
    database = {
      transaction: vi.fn(async (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };

    auditService = {
      record: vi.fn(),
    };

    collisionDecisionService = {
      evaluate: vi.fn(),
    } as unknown as CollisionDecisionService;

    collisionOverrideRepository = {
      create: vi.fn(),

      findById: vi.fn(),

      findApplicableById: vi.fn(),
    } as unknown as CollisionOverrideRepository;

    assignmentRepository = {
      findCurrentForUpdate: vi.fn(),
    } as unknown as CampaignProspectAssignmentRepository;

    authorizationService = {
      hasAnyOverrideAuthority: vi.fn(),

      getOverrideAuthority: vi.fn(),
    } as unknown as AuthorizationService;

    reservationService = {
      resolveReservationTargetScope: vi.fn(),

      requireReservationEligibility: vi.fn(),
    } as unknown as ReservationService;

    service = new ManagerOverrideService(
      database as unknown as Database,

      collisionDecisionService,

      collisionOverrideRepository,

      assignmentRepository,

      authorizationService,

      reservationService,

      auditService as unknown as AuditService,
    );

    vi.mocked(authorizationService.hasAnyOverrideAuthority).mockResolvedValue(true);

    vi.mocked(reservationService.resolveReservationTargetScope).mockResolvedValue({
      assignment,

      establishmentId,
    });

    vi.mocked(reservationService.requireReservationEligibility).mockResolvedValue({
      assignment,

      establishmentId,
    });

    vi.mocked(authorizationService.getOverrideAuthority).mockResolvedValue('manager');

    vi.mocked(assignmentRepository.findCurrentForUpdate).mockResolvedValue(assignment);
  });

  it('creates and audits an override for a blocking planned action', async () => {
    const dueAt = '2026-09-11T10:00:00.000Z';

    vi.mocked(collisionDecisionService.evaluate).mockResolvedValue({
      decision: 'block',

      reasonCode: 'PLANNED_ACTION',

      establishmentId,

      conflict: {
        followUpId,

        campaignId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',

        campaignProspectId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',

        assignmentId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',

        assignedUserId: null,

        dueAt,
      },
    });

    vi.mocked(collisionOverrideRepository.create).mockImplementation(
      async (input) =>
        ({
          id: overrideId,

          createdAt: new Date(),

          ...input,
        }) as never,
    );

    auditService.record.mockResolvedValue({});

    const result = await service.create({
      tenantId,

      approvedByUserId: approverUserId,

      prospectorUserId,

      campaignId,

      campaignProspectId,

      reason: '  Approved after coordination with the other team.  ',
    });

    expect(authorizationService.hasAnyOverrideAuthority).toHaveBeenCalledWith(
      tenantId,
      approverUserId,
    );

    expect(reservationService.resolveReservationTargetScope).toHaveBeenCalledWith({
      tenantId,

      campaignId,

      campaignProspectId,
    });

    expect(authorizationService.getOverrideAuthority).toHaveBeenCalledWith(
      tenantId,

      approverUserId,

      organizationId,

      teamId,
    );

    expect(reservationService.requireReservationEligibility).toHaveBeenCalledWith({
      tenantId,

      userId: prospectorUserId,

      campaignId,

      campaignProspectId,
    });

    expect(collisionDecisionService.evaluate).toHaveBeenCalledWith({
      tenantId,

      userId: prospectorUserId,

      campaignId,

      campaignProspectId,
    });

    expect(database.transaction).toHaveBeenCalledTimes(1);

    expect(assignmentRepository.findCurrentForUpdate).toHaveBeenCalledWith(
      tenantId,

      campaignId,

      campaignProspectId,

      transaction,
    );

    expect(collisionOverrideRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,

        campaignId,

        campaignProspectId,

        establishmentId,

        assignmentId,

        organizationId,

        teamId,

        prospectorUserId,

        approvedByUserId: approverUserId,

        approvedByRole: 'manager',

        reasonCode: 'PLANNED_ACTION',

        conflictKey: ['planned_action', followUpId, dueAt].join(':'),

        reason: 'Approved after coordination with the other team.',
      }),

      transaction,
    );

    expect(auditService.record).toHaveBeenCalledWith(
      {
        tenantId,

        actorType: 'user',

        actorUserId: approverUserId,

        action: 'collision_override.approved',

        resourceType: 'collision_override',

        resourceId: overrideId,

        metadata: {
          campaignId,

          campaignProspectId,

          prospectorUserId,

          organizationId,

          teamId,

          approvedByRole: 'manager',

          reasonCode: 'PLANNED_ACTION',

          conflictKey: ['planned_action', followUpId, dueAt].join(':'),
        },
      },

      transaction,
    );

    expect(result.reasonCode).toBe('PLANNED_ACTION');
  });

  it('rejects a caller with no override authority before resolving the target', async () => {
    vi.mocked(authorizationService.hasAnyOverrideAuthority).mockResolvedValue(false);

    await expect(
      service.create({
        tenantId,

        approvedByUserId: approverUserId,

        prospectorUserId,

        campaignId,

        campaignProspectId,

        reason: 'Manager approval reason is valid.',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(reservationService.resolveReservationTargetScope).not.toHaveBeenCalled();

    expect(reservationService.requireReservationEligibility).not.toHaveBeenCalled();

    expect(authorizationService.getOverrideAuthority).not.toHaveBeenCalled();

    expect(collisionDecisionService.evaluate).not.toHaveBeenCalled();

    expect(database.transaction).not.toHaveBeenCalled();

    expect(assignmentRepository.findCurrentForUpdate).not.toHaveBeenCalled();

    expect(collisionOverrideRepository.create).not.toHaveBeenCalled();

    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('masks a target outside the approver exact organization or team scope', async () => {
    vi.mocked(authorizationService.getOverrideAuthority).mockResolvedValue(null);

    await expect(
      service.create({
        tenantId,

        approvedByUserId: approverUserId,

        prospectorUserId,

        campaignId,

        campaignProspectId,

        reason: 'Manager approval reason is valid.',
      }),
    ).rejects.toThrow('Campaign prospect not found');

    expect(reservationService.resolveReservationTargetScope).toHaveBeenCalledWith({
      tenantId,

      campaignId,

      campaignProspectId,
    });

    expect(reservationService.requireReservationEligibility).not.toHaveBeenCalled();

    expect(collisionDecisionService.evaluate).not.toHaveBeenCalled();

    expect(database.transaction).not.toHaveBeenCalled();

    expect(assignmentRepository.findCurrentForUpdate).not.toHaveBeenCalled();

    expect(collisionOverrideRepository.create).not.toHaveBeenCalled();

    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('rechecks approver authority when the prospect assignment scope changes', async () => {
    const movedAssignment = {
      ...assignment,

      organizationId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',

      teamId: 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff',
    } as CampaignProspectAssignment;

    vi.mocked(reservationService.requireReservationEligibility).mockResolvedValue({
      assignment: movedAssignment,

      establishmentId,
    });

    vi.mocked(authorizationService.getOverrideAuthority)
      .mockResolvedValueOnce('manager')
      .mockResolvedValueOnce(null);

    await expect(
      service.create({
        tenantId,

        approvedByUserId: approverUserId,

        prospectorUserId,

        campaignId,

        campaignProspectId,

        reason: 'Manager approval reason is valid.',
      }),
    ).rejects.toThrow('Campaign prospect not found');

    expect(authorizationService.getOverrideAuthority).toHaveBeenNthCalledWith(
      2,

      tenantId,

      approverUserId,

      movedAssignment.organizationId,

      movedAssignment.teamId,
    );

    expect(collisionDecisionService.evaluate).not.toHaveBeenCalled();

    expect(database.transaction).not.toHaveBeenCalled();

    expect(assignmentRepository.findCurrentForUpdate).not.toHaveBeenCalled();

    expect(collisionOverrideRepository.create).not.toHaveBeenCalled();
  });

  it('never allows an active reservation to be overridden', async () => {
    vi.mocked(collisionDecisionService.evaluate).mockResolvedValue({
      decision: 'block',

      reasonCode: 'ACTIVE_RESERVATION',

      establishmentId,

      conflict: {
        reservationId: 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',

        campaignId: 'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb',

        campaignProspectId: 'cccccccc-1111-4111-8111-cccccccccccc',

        assignmentId: 'dddddddd-1111-4111-8111-dddddddddddd',

        teamId: 'eeeeeeee-1111-4111-8111-eeeeeeeeeeee',

        userId: 'ffffffff-1111-4111-8111-ffffffffffff',

        acquiredAt: '2026-09-10T12:00:00.000Z',

        expiresAt: '2026-09-10T12:20:00.000Z',
      },
    });

    await expect(
      service.create({
        tenantId,

        approvedByUserId: approverUserId,

        prospectorUserId,

        campaignId,

        campaignProspectId,

        reason: 'Manager approval reason is valid.',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(database.transaction).not.toHaveBeenCalled();

    expect(assignmentRepository.findCurrentForUpdate).not.toHaveBeenCalled();

    expect(collisionOverrideRepository.create).not.toHaveBeenCalled();

    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('rejects an override when the current decision is allow', async () => {
    vi.mocked(collisionDecisionService.evaluate).mockResolvedValue({
      decision: 'allow',

      reasonCode: 'NO_COLLISION',

      establishmentId,

      conflict: null,
    });

    await expect(
      service.create({
        tenantId,

        approvedByUserId: approverUserId,

        prospectorUserId,

        campaignId,

        campaignProspectId,

        reason: 'Manager approval reason is valid.',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(database.transaction).not.toHaveBeenCalled();

    expect(assignmentRepository.findCurrentForUpdate).not.toHaveBeenCalled();

    expect(collisionOverrideRepository.create).not.toHaveBeenCalled();

    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('rejects an override for an advisory warning', async () => {
    vi.mocked(collisionDecisionService.evaluate).mockResolvedValue({
      decision: 'warn',

      reasonCode: 'ACTIVE_ASSIGNMENT',

      establishmentId,

      conflict: {
        assignmentId: 'aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa',

        campaignId: 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb',

        campaignProspectId: 'cccccccc-2222-4222-8222-cccccccccccc',

        organizationId: 'dddddddd-2222-4222-8222-dddddddddddd',

        teamId: 'eeeeeeee-2222-4222-8222-eeeeeeeeeeee',

        assignedUserId: null,

        assignedAt: '2026-09-10T11:00:00.000Z',
      },
    });

    await expect(
      service.create({
        tenantId,

        approvedByUserId: approverUserId,

        prospectorUserId,

        campaignId,

        campaignProspectId,

        reason: 'Manager approval reason is valid.',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(database.transaction).not.toHaveBeenCalled();

    expect(assignmentRepository.findCurrentForUpdate).not.toHaveBeenCalled();

    expect(collisionOverrideRepository.create).not.toHaveBeenCalled();

    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('rejects inconsistent canonical establishment context', async () => {
    vi.mocked(collisionDecisionService.evaluate).mockResolvedValue({
      decision: 'block',

      reasonCode: 'PLANNED_ACTION',

      establishmentId: 'aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa',

      conflict: {
        followUpId,

        campaignId,

        campaignProspectId,

        assignmentId,

        assignedUserId: prospectorUserId,

        dueAt: '2026-09-11T10:00:00.000Z',
      },
    });

    await expect(
      service.create({
        tenantId,

        approvedByUserId: approverUserId,

        prospectorUserId,

        campaignId,

        campaignProspectId,

        reason: 'Manager approval reason is valid.',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(database.transaction).not.toHaveBeenCalled();

    expect(assignmentRepository.findCurrentForUpdate).not.toHaveBeenCalled();

    expect(collisionOverrideRepository.create).not.toHaveBeenCalled();

    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('rejects override persistence when the assignment changes after collision evaluation', async () => {
    const dueAt = '2026-09-11T10:00:00.000Z';

    vi.mocked(collisionDecisionService.evaluate).mockResolvedValue({
      decision: 'block',

      reasonCode: 'PLANNED_ACTION',

      establishmentId,

      conflict: {
        followUpId,

        campaignId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',

        campaignProspectId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',

        assignmentId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',

        assignedUserId: null,

        dueAt,
      },
    });

    const newerAssignment = {
      ...assignment,

      id: '12121212-1212-4121-8121-121212121212',
    } as CampaignProspectAssignment;

    vi.mocked(assignmentRepository.findCurrentForUpdate).mockResolvedValue(newerAssignment);

    await expect(
      service.create({
        tenantId,

        approvedByUserId: approverUserId,

        prospectorUserId,

        campaignId,

        campaignProspectId,

        reason: 'Manager approval reason is valid.',
      }),
    ).rejects.toThrow('Campaign prospect changed during override approval');

    expect(database.transaction).toHaveBeenCalledTimes(1);

    expect(assignmentRepository.findCurrentForUpdate).toHaveBeenCalledWith(
      tenantId,

      campaignId,

      campaignProspectId,

      transaction,
    );

    expect(collisionOverrideRepository.create).not.toHaveBeenCalled();

    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('maps override persistence failure to service unavailable', async () => {
    vi.mocked(collisionDecisionService.evaluate).mockResolvedValue({
      decision: 'block',

      reasonCode: 'PLANNED_ACTION',

      establishmentId,

      conflict: {
        followUpId,

        campaignId,

        campaignProspectId,

        assignmentId,

        assignedUserId: prospectorUserId,

        dueAt: '2026-09-11T10:00:00.000Z',
      },
    });

    vi.mocked(collisionOverrideRepository.create).mockRejectedValue(
      new Error('database unavailable'),
    );

    await expect(
      service.create({
        tenantId,

        approvedByUserId: approverUserId,

        prospectorUserId,

        campaignId,

        campaignProspectId,

        reason: 'Manager approval reason is valid.',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(database.transaction).toHaveBeenCalledTimes(1);

    expect(assignmentRepository.findCurrentForUpdate).toHaveBeenCalledWith(
      tenantId,

      campaignId,

      campaignProspectId,

      transaction,
    );

    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('maps audit persistence failure to service unavailable', async () => {
    const dueAt = '2026-09-11T10:00:00.000Z';

    vi.mocked(collisionDecisionService.evaluate).mockResolvedValue({
      decision: 'block',

      reasonCode: 'PLANNED_ACTION',

      establishmentId,

      conflict: {
        followUpId,

        campaignId,

        campaignProspectId,

        assignmentId,

        assignedUserId: prospectorUserId,

        dueAt,
      },
    });

    vi.mocked(collisionOverrideRepository.create).mockImplementation(
      async (input) =>
        ({
          id: overrideId,

          createdAt: new Date(),

          ...input,
        }) as never,
    );

    auditService.record.mockRejectedValue(new Error('audit unavailable'));

    await expect(
      service.create({
        tenantId,

        approvedByUserId: approverUserId,

        prospectorUserId,

        campaignId,

        campaignProspectId,

        reason: 'Manager approval reason is valid.',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(database.transaction).toHaveBeenCalledTimes(1);

    expect(assignmentRepository.findCurrentForUpdate).toHaveBeenCalledWith(
      tenantId,

      campaignId,

      campaignProspectId,

      transaction,
    );

    expect(collisionOverrideRepository.create).toHaveBeenCalledWith(
      expect.any(Object),

      transaction,
    );

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,

        actorType: 'user',

        actorUserId: approverUserId,

        action: 'collision_override.approved',

        resourceType: 'collision_override',

        resourceId: overrideId,
      }),

      transaction,
    );
  });
});
