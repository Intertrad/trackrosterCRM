import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OrganizationRepository } from '../organizations/organization.repository.js';
import { OrganizationCoordinationPolicyService } from './organization-coordination-policy.service.js';
import { ReservationCoordinationScopeService } from './reservation-coordination-scope.service.js';

describe('ReservationCoordinationScopeService', () => {
  let organizationRepository: {
    findByTenant: ReturnType<typeof vi.fn>;
  };

  let coordinationPolicyService: {
    resolve: ReturnType<typeof vi.fn>;
  };

  let service: ReservationCoordinationScopeService;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const organizationAId = '22222222-2222-4222-8222-222222222222';

  const organizationBId = '33333333-3333-4333-8333-333333333333';

  const organizationCId = '44444444-4444-4444-8444-444444444444';

  const organizationDId = '55555555-5555-4555-8555-555555555555';

  const organizationEId = '66666666-6666-4666-8666-666666666666';

  beforeEach(() => {
    organizationRepository = {
      findByTenant: vi
        .fn()
        .mockResolvedValue([
          createOrganization(organizationAId),

          createOrganization(organizationBId),

          createOrganization(organizationCId),

          createOrganization(organizationDId),

          createOrganization(organizationEId),
        ]),
    };

    coordinationPolicyService = {
      resolve: vi
        .fn()
        .mockImplementation(
          (_tenantId: string, _targetOrganizationId: string, conflictingOrganizationId: string) => {
            if (conflictingOrganizationId === organizationCId) {
              return Promise.resolve({
                policy: 'independent',

                delayMinutes: null,

                source: 'configured',
              });
            }

            if (conflictingOrganizationId === organizationBId) {
              return Promise.resolve({
                policy: 'coordinated',

                delayMinutes: null,

                source: 'configured',
              });
            }

            if (conflictingOrganizationId === organizationEId) {
              return Promise.resolve({
                policy: 'delayed',

                delayMinutes: 10_080,

                source: 'configured',
              });
            }

            return Promise.resolve({
              policy: 'shared',

              delayMinutes: null,

              source: 'default',
            });
          },
        ),
    };

    service = new ReservationCoordinationScopeService(
      organizationRepository as unknown as OrganizationRepository,

      coordinationPolicyService as unknown as OrganizationCoordinationPolicyService,
    );
  });

  it('always includes the target organization', async () => {
    organizationRepository.findByTenant.mockResolvedValue([createOrganization(organizationAId)]);

    await expect(service.resolve(tenantId, organizationAId)).resolves.toEqual({
      targetOrganizationId: organizationAId,

      blockingOrganizationIds: [organizationAId],
    });

    expect(coordinationPolicyService.resolve).not.toHaveBeenCalled();
  });

  it('includes shared coordinated and delayed organizations but excludes independent organizations', async () => {
    const result = await service.resolve(tenantId, organizationAId);

    expect(result.targetOrganizationId).toBe(organizationAId);

    expect(result.blockingOrganizationIds).toEqual(
      [organizationAId, organizationBId, organizationDId, organizationEId].sort(),
    );

    expect(result.blockingOrganizationIds).not.toContain(organizationCId);
  });

  it('treats a missing policy as shared through the policy resolver', async () => {
    const result = await service.resolve(tenantId, organizationAId);

    expect(result.blockingOrganizationIds).toContain(organizationDId);
  });

  it('fails closed when organization lookup fails', async () => {
    organizationRepository.findByTenant.mockRejectedValue(new Error('Database unavailable'));

    await expect(service.resolve(tenantId, organizationAId)).rejects.toThrow(
      'Reservation coordination service is unavailable',
    );
  });

  it('fails closed when the target organization is missing', async () => {
    organizationRepository.findByTenant.mockResolvedValue([createOrganization(organizationBId)]);

    await expect(service.resolve(tenantId, organizationAId)).rejects.toThrow(
      'Reservation coordination service is unavailable',
    );
  });

  function createOrganization(id: string) {
    return {
      id,

      tenantId,

      name: `Organization ${id}`,

      slug: id,

      status: 'active' as const,

      createdAt: new Date('2026-09-09T08:00:00.000Z'),

      updatedAt: new Date('2026-09-09T08:00:00.000Z'),
    };
  }
});
