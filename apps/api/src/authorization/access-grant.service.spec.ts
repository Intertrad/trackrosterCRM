import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OrganizationRepository } from '../organizations/organization.repository.js';
import { TeamRepository } from '../teams/team.repository.js';
import { UserRepository } from '../users/user.repository.js';
import { AccessGrantService } from './access-grant.service.js';
import { UserAccessGrantRepository } from './user-access-grant.repository.js';

describe('AccessGrantService', () => {
  let grantRepository: UserAccessGrantRepository;

  let userRepository: UserRepository;

  let organizationRepository: OrganizationRepository;

  let teamRepository: TeamRepository;

  let service: AccessGrantService;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const userId = '22222222-2222-4222-8222-222222222222';

  const organizationId = '33333333-3333-4333-8333-333333333333';

  const teamId = '44444444-4444-4444-8444-444444444444';

  beforeEach(() => {
    grantRepository = {
      create: vi.fn(),
      deleteById: vi.fn(),
    } as unknown as UserAccessGrantRepository;

    userRepository = {
      findById: vi.fn(),
    } as unknown as UserRepository;

    organizationRepository = {
      findById: vi.fn(),
    } as unknown as OrganizationRepository;

    teamRepository = {
      findById: vi.fn(),
    } as unknown as TeamRepository;

    service = new AccessGrantService(
      grantRepository,
      userRepository,
      organizationRepository,
      teamRepository,
    );
  });

  it('creates a tenant client-admin grant', async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({
      id: userId,
      tenantId,
      email: 'admin@test.com',
      passwordHash: 'hash',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(grantRepository.create).mockResolvedValue({
      id: '55555555-5555-4555-8555-555555555555',

      tenantId,
      userId,

      role: 'client_admin',
      scopeType: 'tenant',

      organizationId: null,
      teamId: null,

      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const grant = await service.create({
      tenantId,
      userId,
      role: 'client_admin',
      scopeType: 'tenant',
    });

    expect(grant.role).toBe('client_admin');
  });

  it('rejects a user outside the tenant', async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(null);

    await expect(
      service.create({
        tenantId,
        userId,
        role: 'client_admin',
        scopeType: 'tenant',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(grantRepository.create).not.toHaveBeenCalled();
  });

  it('rejects a team outside the requested organization', async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({
      id: userId,
      tenantId,
      email: 'manager@test.com',
      passwordHash: 'hash',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(organizationRepository.findById).mockResolvedValue({
      id: organizationId,
      tenantId,
      name: 'France Sales',
      slug: 'france-sales',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(teamRepository.findById).mockResolvedValue({
      id: teamId,
      tenantId,

      organizationId: '66666666-6666-4666-8666-666666666666',

      name: 'Other Team',
      slug: 'other-team',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      service.create({
        tenantId,
        userId,
        role: 'manager',
        scopeType: 'team',
        organizationId,
        teamId,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(grantRepository.create).not.toHaveBeenCalled();
  });

  it('maps duplicate grants to conflict', async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({
      id: userId,
      tenantId,
      email: 'admin@test.com',
      passwordHash: 'hash',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const databaseError = new Error('Insert failed', {
      cause: {
        code: '23505',
      },
    });

    vi.mocked(grantRepository.create).mockRejectedValue(databaseError);

    await expect(
      service.create({
        tenantId,
        userId,
        role: 'client_admin',
        scopeType: 'tenant',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('revokes an existing grant', async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({
      id: userId,
      tenantId,
      email: 'admin@test.com',
      passwordHash: 'hash',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(grantRepository.deleteById).mockResolvedValue(true);

    await expect(
      service.revoke(tenantId, userId, '55555555-5555-4555-8555-555555555555'),
    ).resolves.toBeUndefined();

    expect(grantRepository.deleteById).toHaveBeenCalledWith(
      tenantId,
      userId,
      '55555555-5555-4555-8555-555555555555',
    );
  });

  it('rejects revoking an unknown grant', async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({
      id: userId,
      tenantId,
      email: 'admin@test.com',
      passwordHash: 'hash',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(grantRepository.deleteById).mockResolvedValue(false);

    await expect(
      service.revoke(tenantId, userId, '55555555-5555-4555-8555-555555555555'),
    ).rejects.toMatchObject({
      response: {
        message: 'Access grant not found',
        statusCode: 404,
      },
    });

    expect(grantRepository.deleteById).toHaveBeenCalledWith(
      tenantId,
      userId,
      '55555555-5555-4555-8555-555555555555',
    );
  });

  it('rejects revocation when the target user does not exist in the tenant', async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(null);

    await expect(
      service.revoke(tenantId, userId, '55555555-5555-4555-8555-555555555555'),
    ).rejects.toMatchObject({
      response: {
        message: 'User not found',
        statusCode: 404,
      },
    });

    expect(grantRepository.deleteById).not.toHaveBeenCalled();
  });
});
