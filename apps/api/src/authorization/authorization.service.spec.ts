import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserAccessGrant } from '../database/schema/user-access-grants.js';
import { AuthorizationService } from './authorization.service.js';
import { UserAccessGrantRepository } from './user-access-grant.repository.js';

describe('AuthorizationService', () => {
  let repository: UserAccessGrantRepository;

  let service: AuthorizationService;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const userId = '22222222-2222-4222-8222-222222222222';

  const organizationId = '33333333-3333-4333-8333-333333333333';

  const teamId = '44444444-4444-4444-8444-444444444444';

  function createGrant(input: Partial<UserAccessGrant>): UserAccessGrant {
    return {
      id: '55555555-5555-4555-8555-555555555555',

      tenantId,
      userId,

      role: 'observer',
      scopeType: 'tenant',

      organizationId: null,
      teamId: null,

      createdAt: new Date(),
      updatedAt: new Date(),

      ...input,
    };
  }

  beforeEach(() => {
    repository = {
      create: vi.fn(),
      findById: vi.fn(),
      findByUser: vi.fn(),
      deleteById: vi.fn(),
    } as unknown as UserAccessGrantRepository;

    service = new AuthorizationService(repository);
  });

  it('recognizes a tenant client admin', async () => {
    vi.mocked(repository.findByUser).mockResolvedValue([
      createGrant({
        role: 'client_admin',
        scopeType: 'tenant',
      }),
    ]);

    await expect(service.isClientAdmin(tenantId, userId)).resolves.toBe(true);
  });

  it('allows a director to view their organization', async () => {
    vi.mocked(repository.findByUser).mockResolvedValue([
      createGrant({
        role: 'director',
        scopeType: 'organization',
        organizationId,
      }),
    ]);

    await expect(service.canViewOrganization(tenantId, userId, organizationId)).resolves.toBe(true);
  });

  it('rejects a director from another organization', async () => {
    vi.mocked(repository.findByUser).mockResolvedValue([
      createGrant({
        role: 'director',
        scopeType: 'organization',
        organizationId: '66666666-6666-4666-8666-666666666666',
      }),
    ]);

    await expect(service.canViewOrganization(tenantId, userId, organizationId)).resolves.toBe(
      false,
    );
  });

  it('allows a manager to view their team', async () => {
    vi.mocked(repository.findByUser).mockResolvedValue([
      createGrant({
        role: 'manager',
        scopeType: 'team',
        organizationId,
        teamId,
      }),
    ]);

    await expect(service.canViewTeam(tenantId, userId, organizationId, teamId)).resolves.toBe(true);
  });

  it('rejects a manager from another team', async () => {
    vi.mocked(repository.findByUser).mockResolvedValue([
      createGrant({
        role: 'manager',
        scopeType: 'team',
        organizationId,
        teamId: '77777777-7777-4777-8777-777777777777',
      }),
    ]);

    await expect(service.canViewTeam(tenantId, userId, organizationId, teamId)).resolves.toBe(
      false,
    );
  });

  it('allows tenant observers to view teams', async () => {
    vi.mocked(repository.findByUser).mockResolvedValue([
      createGrant({
        role: 'observer',
        scopeType: 'tenant',
      }),
    ]);

    await expect(service.canViewTeam(tenantId, userId, organizationId, teamId)).resolves.toBe(true);
  });
});
