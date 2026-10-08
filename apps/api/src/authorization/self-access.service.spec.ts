import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { UserAccessGrant } from '../database/schema/user-access-grants.js';
import { UserRepository } from '../users/user.repository.js';
import { AuthorizationService } from './authorization.service.js';
import { SelfAccessService } from './self-access.service.js';
import type { Database } from '../database/database.types.js';

describe('SelfAccessService', () => {
  let authorizationService: {
    getUserGrants: ReturnType<typeof vi.fn>;
  };

  let userRepository: {
    findById: ReturnType<typeof vi.fn>;
  };

  let service: SelfAccessService;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const userId = '22222222-2222-4222-8222-222222222222';

  let databaseRows: Array<{ locale: string }> = [];
  let platformRows: Array<{ role: string }> = [];
  let queryCount = 0;

  beforeEach(() => {
    authorizationService = {
      getUserGrants: vi.fn(),
    };

    userRepository = {
      findById: vi.fn().mockResolvedValue({
        id: userId,

        tenantId,

        email: 'prospector@intertrad.test',

        displayName: 'Nabil Benali',

        passwordHash: 'test-password-hash',

        status: 'active',

        createdAt: new Date('2026-01-01T00:00:00.000Z'),

        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    };

    /* Only the settings lookup is exercised here; the locale falls back to the
     * column default when a membership has never saved preferences. */
    databaseRows = [];
    platformRows = [];
    queryCount = 0;

    const database = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve(queryCount++ === 0 ? databaseRows : platformRows),
          }),
        }),
      }),
    };

    service = new SelfAccessService(
      authorizationService as unknown as AuthorizationService,

      userRepository as unknown as UserRepository,

      database as unknown as Database,
    );
  });

  it.each([
    ['super_admin', true],
    ['support_admin', false],
    ['', false],
  ])(
    'reports platform authority only for an active super admin grant (%s)',
    async (role, expected) => {
      authorizationService.getUserGrants.mockResolvedValue([]);
      platformRows = role ? [{ role }] : [];
      const context = await service.getContext({
        tenantId,
        userId,
        identityId: '33333333-3333-4333-8333-333333333333',
      });
      expect(context.platformAdmin).toBe(expected);
      expect(queryCount).toBe(2);
    },
  );

  it('returns authenticated identity with sanitized access grants', async () => {
    const organizationId = '33333333-3333-4333-8333-333333333333';

    const teamId = '44444444-4444-4444-8444-444444444444';

    authorizationService.getUserGrants.mockResolvedValue([
      {
        id: '55555555-5555-4555-8555-555555555555',

        tenantId,

        userId,

        role: 'manager',

        scopeType: 'team',

        organizationId,

        teamId,

        createdAt: new Date('2026-01-01T00:00:00.000Z'),

        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      } satisfies UserAccessGrant,
    ]);

    await expect(
      service.getContext({
        tenantId,

        userId,
      }),
    ).resolves.toEqual({
      userId,

      locale: 'fr-FR',

      tenantId,

      email: 'prospector@intertrad.test',

      displayName: 'Nabil Benali',

      grants: [
        {
          role: 'manager',

          scopeType: 'team',

          organizationId,

          teamId,
        },
      ],
    });

    expect(authorizationService.getUserGrants).toHaveBeenCalledWith(tenantId, userId);
    expect(userRepository.findById).toHaveBeenCalledWith(tenantId, userId);
  });

  it('returns a nullable display name and an empty grant list', async () => {
    userRepository.findById.mockResolvedValue({
      id: userId,

      tenantId,

      email: 'prospector@intertrad.test',

      displayName: null,

      passwordHash: 'test-password-hash',

      status: 'active',

      createdAt: new Date('2026-01-01T00:00:00.000Z'),

      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    authorizationService.getUserGrants.mockResolvedValue([]);

    await expect(
      service.getContext({
        tenantId,

        userId,
      }),
    ).resolves.toEqual({
      userId,

      locale: 'fr-FR',

      tenantId,

      email: 'prospector@intertrad.test',

      displayName: null,

      grants: [],
    });
  });

  it('rejects a session whose authenticated user no longer exists', async () => {
    userRepository.findById.mockResolvedValue(null);

    await expect(
      service.getContext({
        tenantId,

        userId,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(authorizationService.getUserGrants).not.toHaveBeenCalled();
  });

  it('returns grants in deterministic order', async () => {
    const organizationId = '33333333-3333-4333-8333-333333333333';

    const teamId = '44444444-4444-4444-8444-444444444444';

    authorizationService.getUserGrants.mockResolvedValue([
      {
        id: '55555555-5555-4555-8555-555555555555',
        tenantId,
        userId,
        role: 'manager',
        scopeType: 'team',
        organizationId,
        teamId,
        createdAt: new Date(),
        updatedAt: new Date(),
      } satisfies UserAccessGrant,

      {
        id: '66666666-6666-4666-8666-666666666666',
        tenantId,
        userId,
        role: 'client_admin',
        scopeType: 'tenant',
        organizationId: null,
        teamId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } satisfies UserAccessGrant,

      {
        id: '77777777-7777-4777-8777-777777777777',
        tenantId,
        userId,
        role: 'director',
        scopeType: 'organization',
        organizationId,
        teamId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } satisfies UserAccessGrant,
    ]);

    const result = await service.getContext({
      tenantId,

      userId,
    });

    expect(result.grants.map((grant) => `${grant.scopeType}:${grant.role}`)).toEqual([
      'organization:director',
      'team:manager',
      'tenant:client_admin',
    ]);
  });
});
