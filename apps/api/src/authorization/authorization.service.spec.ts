import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { UserAccessGrant } from '../database/schema/user-access-grants.js';
import { AuthorizationService } from './authorization.service.js';
import { UserAccessGrantRepository } from './user-access-grant.repository.js';

describe('AuthorizationService', () => {
  let repository: UserAccessGrantRepository;
  let service: AuthorizationService;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const userId = '22222222-2222-4222-8222-222222222222';

  const organizationId = '33333333-3333-4333-8333-333333333333';

  const teamId = '44444444-4444-4444-8444-444444444444';

  const otherOrganizationId = '66666666-6666-4666-8666-666666666666';

  const otherTeamId = '77777777-7777-4777-8777-777777777777';

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

  describe('existing authorization rules', () => {
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

      await expect(service.canViewOrganization(tenantId, userId, organizationId)).resolves.toBe(
        true,
      );
    });

    it('rejects a director from another organization', async () => {
      vi.mocked(repository.findByUser).mockResolvedValue([
        createGrant({
          role: 'director',
          scopeType: 'organization',
          organizationId: otherOrganizationId,
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

      await expect(service.canViewTeam(tenantId, userId, organizationId, teamId)).resolves.toBe(
        true,
      );
    });

    it('rejects a manager from another team', async () => {
      vi.mocked(repository.findByUser).mockResolvedValue([
        createGrant({
          role: 'manager',
          scopeType: 'team',
          organizationId,
          teamId: otherTeamId,
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

      await expect(service.canViewTeam(tenantId, userId, organizationId, teamId)).resolves.toBe(
        true,
      );
    });
  });

  describe('resolveViewScope', () => {
    it('prefers tenant authority over narrower grants', async () => {
      vi.mocked(repository.findByUser).mockResolvedValue([
        createGrant({
          role: 'prospector',
          scopeType: 'team',
          organizationId,
          teamId,
        }),
        createGrant({
          id: '88888888-8888-4888-8888-888888888888',
          role: 'observer',
          scopeType: 'tenant',
        }),
      ]);

      await expect(
        service.resolveViewScope(tenantId, userId, organizationId, teamId),
      ).resolves.toEqual({
        scopeType: 'tenant',

        organizationId: null,

        teamId: null,
      });
    });

    it('returns organization authority before an exact team grant', async () => {
      vi.mocked(repository.findByUser).mockResolvedValue([
        createGrant({
          role: 'prospector',
          scopeType: 'team',
          organizationId,
          teamId,
        }),
        createGrant({
          id: '88888888-8888-4888-8888-888888888888',
          role: 'director',
          scopeType: 'organization',
          organizationId,
        }),
      ]);

      await expect(
        service.resolveViewScope(tenantId, userId, organizationId, teamId),
      ).resolves.toEqual({
        scopeType: 'organization',

        organizationId,

        teamId: null,
      });
    });

    it('does not promote a team grant to organization authority', async () => {
      vi.mocked(repository.findByUser).mockResolvedValue([
        createGrant({
          role: 'prospector',
          scopeType: 'team',
          organizationId,
          teamId,
        }),
      ]);

      await expect(service.resolveViewScope(tenantId, userId, organizationId)).resolves.toBeNull();
    });
  });

  describe('canOverrideTeam', () => {
    it('allows a tenant client admin to approve an override', async () => {
      vi.mocked(repository.findByUser).mockResolvedValue([
        createGrant({
          role: 'client_admin',
          scopeType: 'tenant',
        }),
      ]);

      await expect(service.canOverrideTeam(tenantId, userId, organizationId, teamId)).resolves.toBe(
        true,
      );
    });

    it('allows a director to approve an override inside their organization', async () => {
      vi.mocked(repository.findByUser).mockResolvedValue([
        createGrant({
          role: 'director',
          scopeType: 'organization',
          organizationId,
        }),
      ]);

      await expect(service.canOverrideTeam(tenantId, userId, organizationId, teamId)).resolves.toBe(
        true,
      );
    });

    it('rejects a director from another organization', async () => {
      vi.mocked(repository.findByUser).mockResolvedValue([
        createGrant({
          role: 'director',
          scopeType: 'organization',
          organizationId: otherOrganizationId,
        }),
      ]);

      await expect(service.canOverrideTeam(tenantId, userId, organizationId, teamId)).resolves.toBe(
        false,
      );
    });

    it('allows a manager to approve an override for their exact team', async () => {
      vi.mocked(repository.findByUser).mockResolvedValue([
        createGrant({
          role: 'manager',
          scopeType: 'team',
          organizationId,
          teamId,
        }),
      ]);

      await expect(service.canOverrideTeam(tenantId, userId, organizationId, teamId)).resolves.toBe(
        true,
      );
    });

    it('rejects a manager from another team', async () => {
      vi.mocked(repository.findByUser).mockResolvedValue([
        createGrant({
          role: 'manager',
          scopeType: 'team',
          organizationId,
          teamId: otherTeamId,
        }),
      ]);

      await expect(service.canOverrideTeam(tenantId, userId, organizationId, teamId)).resolves.toBe(
        false,
      );
    });

    it('rejects a manager from another organization', async () => {
      vi.mocked(repository.findByUser).mockResolvedValue([
        createGrant({
          role: 'manager',
          scopeType: 'team',
          organizationId: otherOrganizationId,
          teamId,
        }),
      ]);

      await expect(service.canOverrideTeam(tenantId, userId, organizationId, teamId)).resolves.toBe(
        false,
      );
    });

    it('does not allow a prospector to approve an override', async () => {
      vi.mocked(repository.findByUser).mockResolvedValue([
        createGrant({
          role: 'prospector',
          scopeType: 'team',
          organizationId,
          teamId,
        }),
      ]);

      await expect(service.canOverrideTeam(tenantId, userId, organizationId, teamId)).resolves.toBe(
        false,
      );
    });

    it('does not allow an observer to approve an override', async () => {
      vi.mocked(repository.findByUser).mockResolvedValue([
        createGrant({
          role: 'observer',
          scopeType: 'tenant',
        }),
      ]);

      await expect(service.canOverrideTeam(tenantId, userId, organizationId, teamId)).resolves.toBe(
        false,
      );
    });
  });

  describe('getAssignmentAuthority', () => {
    it('returns manager only for the exact team scope', async () => {
      vi.mocked(repository.findByUser).mockResolvedValue([
        createGrant({
          role: 'manager',
          scopeType: 'team',
          organizationId,
          teamId,
        }),
      ]);

      await expect(
        service.getAssignmentAuthority(tenantId, userId, organizationId, teamId),
      ).resolves.toBe('manager');

      await expect(
        service.getAssignmentAuthority(tenantId, userId, organizationId, otherTeamId),
      ).resolves.toBeNull();
    });

    it('allows organization directors and tenant client admins', async () => {
      vi.mocked(repository.findByUser).mockResolvedValue([
        createGrant({
          role: 'director',
          scopeType: 'organization',
          organizationId,
        }),
      ]);

      await expect(
        service.getAssignmentAuthority(tenantId, userId, organizationId, teamId),
      ).resolves.toBe('director');

      vi.mocked(repository.findByUser).mockResolvedValue([
        createGrant({
          role: 'client_admin',
          scopeType: 'tenant',
        }),
      ]);

      await expect(
        service.getAssignmentAuthority(tenantId, userId, organizationId, teamId),
      ).resolves.toBe('client_admin');
    });

    it('rejects prospectors and observers', async () => {
      vi.mocked(repository.findByUser).mockResolvedValue([
        createGrant({
          role: 'prospector',
          scopeType: 'team',
          organizationId,
          teamId,
        }),
        createGrant({
          id: '88888888-8888-4888-8888-888888888888',
          role: 'observer',
          scopeType: 'tenant',
        }),
      ]);

      await expect(
        service.getAssignmentAuthority(tenantId, userId, organizationId, teamId),
      ).resolves.toBeNull();
    });
  });
});
