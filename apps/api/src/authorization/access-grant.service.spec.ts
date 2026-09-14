import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuditService } from '../audit/audit.service.js';
import { OrganizationRepository } from '../organizations/organization.repository.js';
import { TeamRepository } from '../teams/team.repository.js';
import { UserRepository } from '../users/user.repository.js';
import { AccessGrantService } from './access-grant.service.js';
import { UserAccessGrantRepository } from './user-access-grant.repository.js';

describe('AccessGrantService', () => {
  let transaction: object;

  let database: {
    transaction: ReturnType<typeof vi.fn>;
  };

  let grantRepository: {
    create: ReturnType<typeof vi.fn>;

    deleteById: ReturnType<typeof vi.fn>;

    findByIdForUser: ReturnType<typeof vi.fn>;

    findByUser: ReturnType<typeof vi.fn>;
  };

  let userRepository: {
    findById: ReturnType<typeof vi.fn>;
  };

  let organizationRepository: {
    findById: ReturnType<typeof vi.fn>;
  };

  let teamRepository: {
    findById: ReturnType<typeof vi.fn>;
  };

  let auditService: {
    record: ReturnType<typeof vi.fn>;
  };

  let service: AccessGrantService;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const actorUserId = '22222222-2222-4222-8222-222222222222';

  const userId = '33333333-3333-4333-8333-333333333333';

  const organizationId = '44444444-4444-4444-8444-444444444444';

  const teamId = '55555555-5555-4555-8555-555555555555';

  const grantId = '66666666-6666-4666-8666-666666666666';

  const user = {
    id: userId,

    tenantId,

    email: 'target@test.com',

    passwordHash: 'hash',

    status: 'active' as const,

    createdAt: new Date(),

    updatedAt: new Date(),
  };

  const tenantGrant = {
    id: grantId,

    tenantId,

    userId,

    role: 'client_admin' as const,

    scopeType: 'tenant' as const,

    organizationId: null,

    teamId: null,

    createdAt: new Date(),

    updatedAt: new Date(),
  };

  beforeEach(() => {
    transaction = {
      transaction: true,
    };

    database = {
      transaction: vi.fn(),
    };

    database.transaction.mockImplementation(async (callback: (executor: object) => unknown) =>
      callback(transaction),
    );

    grantRepository = {
      create: vi.fn(),

      deleteById: vi.fn(),

      findByIdForUser: vi.fn(),

      findByUser: vi.fn(),
    };

    userRepository = {
      findById: vi.fn(),
    };

    organizationRepository = {
      findById: vi.fn(),
    };

    teamRepository = {
      findById: vi.fn(),
    };

    auditService = {
      record: vi.fn(),
    };

    service = new AccessGrantService(
      database as never,

      grantRepository as unknown as UserAccessGrantRepository,

      userRepository as unknown as UserRepository,

      organizationRepository as unknown as OrganizationRepository,

      teamRepository as unknown as TeamRepository,

      auditService as unknown as AuditService,
    );
  });

  it('creates and audits a tenant client-admin grant in one transaction', async () => {
    userRepository.findById.mockResolvedValue(user);

    grantRepository.create.mockResolvedValue(tenantGrant);

    const result = await service.create({
      tenantId,

      actorUserId,

      userId,

      role: 'client_admin',

      scopeType: 'tenant',
    });

    expect(grantRepository.create).toHaveBeenCalledWith(
      {
        tenantId,

        userId,

        role: 'client_admin',

        scopeType: 'tenant',
      },

      transaction,
    );

    expect(auditService.record).toHaveBeenCalledWith(
      {
        tenantId,

        actorType: 'user',

        actorUserId,

        action: 'access_grant.created',

        resourceType: 'access_grant',

        resourceId: grantId,

        metadata: {
          targetUserId: userId,

          role: 'client_admin',

          scopeType: 'tenant',

          organizationId: null,

          teamId: null,
        },
      },

      transaction,
    );

    expect(result).toBe(tenantGrant);
  });

  it('rejects a user outside the tenant before opening the mutation transaction', async () => {
    userRepository.findById.mockResolvedValue(null);

    await expect(
      service.create({
        tenantId,

        actorUserId,

        userId,

        role: 'client_admin',

        scopeType: 'tenant',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(database.transaction).not.toHaveBeenCalled();

    expect(grantRepository.create).not.toHaveBeenCalled();

    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('rejects a team outside the requested organization', async () => {
    userRepository.findById.mockResolvedValue(user);

    organizationRepository.findById.mockResolvedValue({
      id: organizationId,

      tenantId,

      name: 'France Sales',

      slug: 'france-sales',

      status: 'active',

      createdAt: new Date(),

      updatedAt: new Date(),
    });

    teamRepository.findById.mockResolvedValue({
      id: teamId,

      tenantId,

      organizationId: '77777777-7777-4777-8777-777777777777',

      name: 'Other Team',

      slug: 'other-team',

      status: 'active',

      createdAt: new Date(),

      updatedAt: new Date(),
    });

    await expect(
      service.create({
        tenantId,

        actorUserId,

        userId,

        role: 'manager',

        scopeType: 'team',

        organizationId,

        teamId,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(database.transaction).not.toHaveBeenCalled();
  });

  it('maps duplicate grants to conflict', async () => {
    userRepository.findById.mockResolvedValue(user);

    const databaseError = new Error('Insert failed', {
      cause: {
        code: '23505',
      },
    });

    grantRepository.create.mockRejectedValue(databaseError);

    await expect(
      service.create({
        tenantId,

        actorUserId,

        userId,

        role: 'client_admin',

        scopeType: 'tenant',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('reads, revokes and audits an existing grant in one transaction', async () => {
    userRepository.findById.mockResolvedValue(user);

    grantRepository.findByIdForUser.mockResolvedValue(tenantGrant);

    grantRepository.deleteById.mockResolvedValue(true);

    await expect(
      service.revoke({
        tenantId,

        actorUserId,

        userId,

        grantId,
      }),
    ).resolves.toBeUndefined();

    expect(grantRepository.findByIdForUser).toHaveBeenCalledWith(
      tenantId,

      userId,

      grantId,

      transaction,
    );

    expect(grantRepository.deleteById).toHaveBeenCalledWith(
      tenantId,

      userId,

      grantId,

      transaction,
    );

    expect(auditService.record).toHaveBeenCalledWith(
      {
        tenantId,

        actorType: 'user',

        actorUserId,

        action: 'access_grant.revoked',

        resourceType: 'access_grant',

        resourceId: grantId,

        metadata: {
          targetUserId: userId,

          role: 'client_admin',

          scopeType: 'tenant',

          organizationId: null,

          teamId: null,
        },
      },

      transaction,
    );
  });

  it('fails closed when another request revokes the grant after it was read', async () => {
    userRepository.findById.mockResolvedValue(user);

    /*
     * Our transaction successfully observes the grant,
     * but another transaction wins the DELETE race
     * before our conditional delete executes.
     */
    grantRepository.findByIdForUser.mockResolvedValue(tenantGrant);

    grantRepository.deleteById.mockResolvedValue(false);

    await expect(
      service.revoke({
        tenantId,

        actorUserId,

        userId,

        grantId,
      }),
    ).rejects.toMatchObject({
      response: {
        message: 'Access grant not found',

        statusCode: 404,
      },
    });

    expect(database.transaction).toHaveBeenCalledTimes(1);

    expect(grantRepository.findByIdForUser).toHaveBeenCalledWith(
      tenantId,

      userId,

      grantId,

      transaction,
    );

    expect(grantRepository.deleteById).toHaveBeenCalledWith(
      tenantId,

      userId,

      grantId,

      transaction,
    );

    /*
     * Critical invariant:
     *
     * losing the deletion race must never create
     * false audit evidence claiming this request
     * performed the revocation.
     */
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('rejects revoking an unknown grant', async () => {
    userRepository.findById.mockResolvedValue(user);

    grantRepository.findByIdForUser.mockResolvedValue(null);

    await expect(
      service.revoke({
        tenantId,

        actorUserId,

        userId,

        grantId,
      }),
    ).rejects.toMatchObject({
      response: {
        message: 'Access grant not found',

        statusCode: 404,
      },
    });

    expect(grantRepository.deleteById).not.toHaveBeenCalled();

    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('rejects revocation when target user is outside the tenant', async () => {
    userRepository.findById.mockResolvedValue(null);

    await expect(
      service.revoke({
        tenantId,

        actorUserId,

        userId,

        grantId,
      }),
    ).rejects.toMatchObject({
      response: {
        message: 'User not found',

        statusCode: 404,
      },
    });

    expect(database.transaction).not.toHaveBeenCalled();
  });

  it('propagates audit failure so grant creation rolls back', async () => {
    userRepository.findById.mockResolvedValue(user);

    grantRepository.create.mockResolvedValue(tenantGrant);

    auditService.record.mockRejectedValue(new Error('audit insert failed'));

    await expect(
      service.create({
        tenantId,

        actorUserId,

        userId,

        role: 'client_admin',

        scopeType: 'tenant',
      }),
    ).rejects.toThrow('audit insert failed');

    expect(auditService.record).toHaveBeenCalledWith(
      expect.any(Object),

      transaction,
    );
  });

  it('propagates audit failure so grant revocation rolls back', async () => {
    userRepository.findById.mockResolvedValue(user);

    grantRepository.findByIdForUser.mockResolvedValue(tenantGrant);

    grantRepository.deleteById.mockResolvedValue(true);

    auditService.record.mockRejectedValue(new Error('audit insert failed'));

    await expect(
      service.revoke({
        tenantId,

        actorUserId,

        userId,

        grantId,
      }),
    ).rejects.toThrow('audit insert failed');
  });
});
