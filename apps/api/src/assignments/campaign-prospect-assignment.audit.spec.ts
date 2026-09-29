import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuditService } from '../audit/audit.service.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { CampaignProspectRepository } from '../campaigns/campaign-prospect.repository.js';
import { CampaignRepository } from '../campaigns/campaign.repository.js';
import type { CampaignProspectAssignment } from '../database/schema/campaign-prospect-assignments.js';
import { TeamRepository } from '../teams/team.repository.js';
import { UserRepository } from '../users/user.repository.js';
import { CampaignProspectAssignmentRepository } from './campaign-prospect-assignment.repository.js';
import { CampaignProspectAssignmentService } from './campaign-prospect-assignment.service.js';

describe('CampaignProspectAssignmentService audit integration', () => {
  let transaction: object;

  let database: {
    transaction: ReturnType<typeof vi.fn>;
  };

  let assignmentRepository: {
    create: ReturnType<typeof vi.fn>;

    findCurrent: ReturnType<typeof vi.fn>;

    findCurrentForUpdate: ReturnType<typeof vi.fn>;

    findHistory: ReturnType<typeof vi.fn>;

    endCurrent: ReturnType<typeof vi.fn>;
  };

  let campaignRepository: {
    findById: ReturnType<typeof vi.fn>;
  };

  let prospectRepository: {
    findById: ReturnType<typeof vi.fn>;
  };

  let teamRepository: {
    findById: ReturnType<typeof vi.fn<(...args: unknown[]) => unknown>>;
    findByIdForUpdate: ReturnType<typeof vi.fn>;
  };

  let userRepository: {
    findById: ReturnType<typeof vi.fn>;
  };

  let authorizationService: {
    getUserGrants: ReturnType<typeof vi.fn>;
    getAssignmentAuthority: ReturnType<typeof vi.fn>;
  };

  let auditService: {
    record: ReturnType<typeof vi.fn>;
  };

  let service: CampaignProspectAssignmentService;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const actorUserId = '22222222-2222-4222-8222-222222222222';

  const organizationId = '33333333-3333-4333-8333-333333333333';

  const campaignId = '44444444-4444-4444-8444-444444444444';

  const prospectId = '55555555-5555-4555-8555-555555555555';

  const teamId = '66666666-6666-4666-8666-666666666666';

  const oldUserId = '77777777-7777-4777-8777-777777777777';

  const newUserId = '88888888-8888-4888-8888-888888888888';

  const oldAssignmentId = '99999999-9999-4999-8999-999999999999';

  const newAssignmentId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const campaign = {
    id: campaignId,

    tenantId,

    organizationId,

    name: 'Audit Campaign',

    description: null,

    status: 'active' as const,

    startsAt: null,

    endsAt: null,

    createdAt: new Date(),

    updatedAt: new Date(),
  };

  const prospect = {
    id: prospectId,

    tenantId,

    campaignId,

    establishmentId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',

    status: 'active' as const,

    createdAt: new Date(),

    updatedAt: new Date(),
  };

  const currentAssignment: CampaignProspectAssignment = {
    status: 'active',
    priority: 'normal',
    endReason: null,
    updatedAt: new Date(),
    id: oldAssignmentId,

    tenantId,

    campaignId,

    campaignProspectId: prospectId,

    organizationId,

    teamId,

    assignedUserId: oldUserId,

    assignedAt: new Date(),

    endedAt: null,
  };

  beforeEach(() => {
    transaction = {
      transaction: true,
      execute: vi.fn().mockResolvedValue({
        rows: [
          { eligible: true, capacity: null, workload: 0, team_capacity: 100, team_workload: 0 },
        ],
      }),
    };

    database = {
      transaction: vi.fn(),
    };

    database.transaction.mockImplementation(async (callback: (executor: object) => unknown) =>
      callback(transaction),
    );

    assignmentRepository = {
      create: vi.fn(),

      findCurrent: vi.fn(),

      findCurrentForUpdate: vi.fn(),

      findHistory: vi.fn(),

      endCurrent: vi.fn(),
    };

    campaignRepository = {
      findById: vi.fn().mockResolvedValue(campaign),
    };

    prospectRepository = {
      findById: vi.fn().mockResolvedValue(prospect),
    };

    teamRepository = {
      findByIdForUpdate: vi
        .fn()
        .mockImplementation((tenantId, teamId) => teamRepository.findById(tenantId, teamId)),
      findById: vi.fn().mockResolvedValue({
        id: teamId,

        tenantId,

        organizationId,

        status: 'active',
      }),
    };

    userRepository = {
      findById: vi.fn(),
    };

    authorizationService = {
      getUserGrants: vi.fn(),
      getAssignmentAuthority: vi.fn().mockResolvedValue('client_admin'),
    };

    auditService = {
      record: vi.fn(),
    };

    service = new CampaignProspectAssignmentService(
      database as never,

      assignmentRepository as unknown as CampaignProspectAssignmentRepository,

      campaignRepository as unknown as CampaignRepository,

      prospectRepository as unknown as CampaignProspectRepository,

      teamRepository as unknown as TeamRepository,

      userRepository as unknown as UserRepository,

      authorizationService as unknown as AuthorizationService,

      auditService as unknown as AuditService,
    );
  });

  it('records assignment creation using the same transaction', async () => {
    assignmentRepository.findCurrentForUpdate.mockResolvedValue(null);

    const created = {
      ...currentAssignment,

      assignedUserId: null,
    };

    assignmentRepository.create.mockResolvedValue(created);

    await service.assign({
      tenantId,

      actorUserId,

      campaignId,

      campaignProspectId: prospectId,

      teamId,
    });

    expect(auditService.record).toHaveBeenCalledWith(
      {
        tenantId,

        actorType: 'user',

        actorUserId,

        action: 'assignment.assigned',

        resourceType: 'campaign_prospect',

        resourceId: prospectId,

        metadata: {
          assignmentId: oldAssignmentId,

          campaignId,

          organizationId,

          teamId,

          assignedUserId: null,
        },
      },

      transaction,
    );
  });

  it('records reassignment with previous and new ownership', async () => {
    userRepository.findById.mockResolvedValue({
      id: newUserId,

      tenantId,

      status: 'active',
    });

    authorizationService.getUserGrants.mockResolvedValue([
      {
        role: 'prospector',

        scopeType: 'team',

        organizationId,

        teamId,
      },
    ]);

    assignmentRepository.findCurrentForUpdate.mockResolvedValue(currentAssignment);

    assignmentRepository.endCurrent.mockResolvedValue({
      ...currentAssignment,

      endedAt: new Date(),
    });

    const nextAssignment = {
      ...currentAssignment,

      id: newAssignmentId,

      assignedUserId: newUserId,
    };

    assignmentRepository.create.mockResolvedValue(nextAssignment);

    await service.reassign({
      tenantId,

      actorUserId,

      campaignId,

      campaignProspectId: prospectId,

      teamId,

      assignedUserId: newUserId,
    });

    expect(auditService.record).toHaveBeenCalledWith(
      {
        tenantId,

        actorType: 'user',

        actorUserId,

        action: 'assignment.reassigned',

        resourceType: 'campaign_prospect',

        resourceId: prospectId,

        metadata: {
          campaignId,

          previousAssignmentId: oldAssignmentId,

          newAssignmentId: newAssignmentId,

          previousTeamId: teamId,

          newTeamId: teamId,

          previousAssignedUserId: oldUserId,

          newAssignedUserId: newUserId,
        },
      },

      transaction,
    );
  });

  it('does not audit a no-op reassignment', async () => {
    userRepository.findById.mockResolvedValue({
      id: oldUserId,

      tenantId,

      status: 'active',
    });

    authorizationService.getUserGrants.mockResolvedValue([
      {
        role: 'prospector',

        scopeType: 'team',

        organizationId,

        teamId,
      },
    ]);

    assignmentRepository.findCurrentForUpdate.mockResolvedValue(currentAssignment);

    const result = await service.reassign({
      tenantId,

      actorUserId,

      campaignId,

      campaignProspectId: prospectId,

      teamId,

      assignedUserId: oldUserId,
    });

    expect(result).toBe(currentAssignment);

    expect(assignmentRepository.endCurrent).not.toHaveBeenCalled();

    expect(assignmentRepository.create).not.toHaveBeenCalled();

    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('propagates audit failure from inside the assignment transaction', async () => {
    assignmentRepository.findCurrentForUpdate.mockResolvedValue(null);

    assignmentRepository.create.mockResolvedValue({
      ...currentAssignment,

      assignedUserId: null,
    });

    auditService.record.mockRejectedValue(new Error('audit insert failed'));

    await expect(
      service.assign({
        tenantId,

        actorUserId,

        campaignId,

        campaignProspectId: prospectId,

        teamId,
      }),
    ).rejects.toThrow('audit insert failed');

    expect(auditService.record).toHaveBeenCalledWith(
      expect.any(Object),

      transaction,
    );
  });
});
