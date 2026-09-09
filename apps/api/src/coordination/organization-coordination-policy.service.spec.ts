import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { OrganizationCoordinationPolicy } from '../database/schema/organization-coordination-policies.js';
import { OrganizationCoordinationPolicyRepository } from './organization-coordination-policy.repository.js';
import { OrganizationCoordinationPolicyService } from './organization-coordination-policy.service.js';

describe('OrganizationCoordinationPolicyService', () => {
  let policyRepository: {
    findByOrganizations: ReturnType<typeof vi.fn>;
  };

  let service: OrganizationCoordinationPolicyService;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const organizationAId = '22222222-2222-4222-8222-222222222222';

  const organizationBId = '33333333-3333-4333-8333-333333333333';

  beforeEach(() => {
    policyRepository = {
      findByOrganizations: vi.fn(),
    };

    service = new OrganizationCoordinationPolicyService(
      policyRepository as unknown as OrganizationCoordinationPolicyRepository,
    );
  });

  it('uses shared semantics for the same organization without querying the repository', async () => {
    await expect(service.resolve(tenantId, organizationAId, organizationAId)).resolves.toEqual({
      policy: 'shared',

      delayMinutes: null,

      source: 'same_organization',
    });

    expect(policyRepository.findByOrganizations).not.toHaveBeenCalled();
  });

  it('defaults to shared when no policy is configured', async () => {
    policyRepository.findByOrganizations.mockResolvedValue(null);

    await expect(service.resolve(tenantId, organizationAId, organizationBId)).resolves.toEqual({
      policy: 'shared',

      delayMinutes: null,

      source: 'default',
    });

    expect(policyRepository.findByOrganizations).toHaveBeenCalledWith(
      tenantId,
      organizationAId,
      organizationBId,
    );
  });

  it('returns a configured coordinated policy', async () => {
    policyRepository.findByOrganizations.mockResolvedValue({
      id: '44444444-4444-4444-8444-444444444444',

      tenantId,

      organizationAId,

      organizationBId,

      policy: 'coordinated',

      delayMinutes: null,

      createdAt: new Date(),

      updatedAt: new Date(),
    } satisfies OrganizationCoordinationPolicy);

    await expect(service.resolve(tenantId, organizationAId, organizationBId)).resolves.toEqual({
      policy: 'coordinated',

      delayMinutes: null,

      source: 'configured',
    });
  });

  it('returns the configured delay for delayed coordination', async () => {
    policyRepository.findByOrganizations.mockResolvedValue({
      id: '44444444-4444-4444-8444-444444444444',

      tenantId,

      organizationAId,

      organizationBId,

      policy: 'delayed',

      delayMinutes: 10_080,

      createdAt: new Date(),

      updatedAt: new Date(),
    } satisfies OrganizationCoordinationPolicy);

    await expect(service.resolve(tenantId, organizationAId, organizationBId)).resolves.toEqual({
      policy: 'delayed',

      delayMinutes: 10_080,

      source: 'configured',
    });
  });

  it('returns an independent policy', async () => {
    policyRepository.findByOrganizations.mockResolvedValue({
      id: '44444444-4444-4444-8444-444444444444',

      tenantId,

      organizationAId,

      organizationBId,

      policy: 'independent',

      delayMinutes: null,

      createdAt: new Date(),

      updatedAt: new Date(),
    } satisfies OrganizationCoordinationPolicy);

    await expect(service.resolve(tenantId, organizationAId, organizationBId)).resolves.toEqual({
      policy: 'independent',

      delayMinutes: null,

      source: 'configured',
    });
  });

  it('fails closed when policy lookup fails', async () => {
    policyRepository.findByOrganizations.mockRejectedValue(new Error('Database unavailable'));

    await expect(service.resolve(tenantId, organizationAId, organizationBId)).rejects.toThrow(
      'Coordination policy service is unavailable',
    );
  });
});
