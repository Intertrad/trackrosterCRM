import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { UserAccessGrant } from '../database/schema/user-access-grants.js';
import { AuthorizationService } from './authorization.service.js';
import { SelfAccessService } from './self-access.service.js';

describe('SelfAccessService', () => {
  let authorizationService: {
    getUserGrants: ReturnType<typeof vi.fn>;
  };

  let service: SelfAccessService;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const userId = '22222222-2222-4222-8222-222222222222';

  beforeEach(() => {
    authorizationService = {
      getUserGrants: vi.fn(),
    };

    service = new SelfAccessService(authorizationService as unknown as AuthorizationService);
  });

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

      tenantId,

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
  });

  it('returns an empty grant list when the user has no grants', async () => {
    authorizationService.getUserGrants.mockResolvedValue([]);

    await expect(
      service.getContext({
        tenantId,

        userId,
      }),
    ).resolves.toEqual({
      userId,

      tenantId,

      grants: [],
    });
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
