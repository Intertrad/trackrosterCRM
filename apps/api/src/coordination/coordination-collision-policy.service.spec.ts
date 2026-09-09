import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OrganizationCoordinationPolicyService } from './organization-coordination-policy.service.js';
import { CoordinationCollisionPolicyService } from './coordination-collision-policy.service.js';

describe('CoordinationCollisionPolicyService', () => {
  let coordinationPolicyService: {
    resolve: ReturnType<typeof vi.fn>;
  };

  let service: CoordinationCollisionPolicyService;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const targetOrganizationId = '22222222-2222-4222-8222-222222222222';

  const conflictingOrganizationId = '33333333-3333-4333-8333-333333333333';

  beforeEach(() => {
    coordinationPolicyService = {
      resolve: vi.fn(),
    };

    service = new CoordinationCollisionPolicyService(
      coordinationPolicyService as unknown as OrganizationCoordinationPolicyService,
    );
  });

  it('ignores cross-organization conflicts for independent organizations', async () => {
    coordinationPolicyService.resolve.mockResolvedValue({
      policy: 'independent',
      delayMinutes: null,
      source: 'configured',
    });

    for (const collisionType of [
      'active_reservation',
      'planned_action',
      'recent_contact',
      'active_assignment',
    ] as const) {
      await expect(
        service.evaluate({
          tenantId,
          targetOrganizationId,
          conflictingOrganizationId,
          collisionType,
        }),
      ).resolves.toEqual({
        action: 'ignore',
        policy: 'independent',
        delayMinutes: null,
      });
    }
  });

  it('keeps active assignment advisory for shared organizations', async () => {
    coordinationPolicyService.resolve.mockResolvedValue({
      policy: 'shared',
      delayMinutes: null,
      source: 'configured',
    });

    await expect(
      service.evaluate({
        tenantId,
        targetOrganizationId,
        conflictingOrganizationId,
        collisionType: 'active_assignment',
      }),
    ).resolves.toEqual({
      action: 'warn',
      policy: 'shared',
      delayMinutes: null,
    });
  });

  it('blocks active assignment for coordinated organizations', async () => {
    coordinationPolicyService.resolve.mockResolvedValue({
      policy: 'coordinated',
      delayMinutes: null,
      source: 'configured',
    });

    await expect(
      service.evaluate({
        tenantId,
        targetOrganizationId,
        conflictingOrganizationId,
        collisionType: 'active_assignment',
      }),
    ).resolves.toEqual({
      action: 'block',
      policy: 'coordinated',
      delayMinutes: null,
    });
  });

  it('returns delayed handling for recent contact under delayed policy', async () => {
    coordinationPolicyService.resolve.mockResolvedValue({
      policy: 'delayed',
      delayMinutes: 10_080,
      source: 'configured',
    });

    await expect(
      service.evaluate({
        tenantId,
        targetOrganizationId,
        conflictingOrganizationId,
        collisionType: 'recent_contact',
      }),
    ).resolves.toEqual({
      action: 'delayed',
      policy: 'delayed',
      delayMinutes: 10_080,
    });
  });

  it('blocks active reservations under delayed policy', async () => {
    coordinationPolicyService.resolve.mockResolvedValue({
      policy: 'delayed',
      delayMinutes: 10_080,
      source: 'configured',
    });

    await expect(
      service.evaluate({
        tenantId,
        targetOrganizationId,
        conflictingOrganizationId,
        collisionType: 'active_reservation',
      }),
    ).resolves.toEqual({
      action: 'block',
      policy: 'delayed',
      delayMinutes: 10_080,
    });
  });

  it('blocks planned actions under shared policy', async () => {
    coordinationPolicyService.resolve.mockResolvedValue({
      policy: 'shared',
      delayMinutes: null,
      source: 'default',
    });

    await expect(
      service.evaluate({
        tenantId,
        targetOrganizationId,
        conflictingOrganizationId,
        collisionType: 'planned_action',
      }),
    ).resolves.toEqual({
      action: 'block',
      policy: 'shared',
      delayMinutes: null,
    });
  });

  it('blocks recent contact under coordinated policy', async () => {
    coordinationPolicyService.resolve.mockResolvedValue({
      policy: 'coordinated',
      delayMinutes: null,
      source: 'configured',
    });

    await expect(
      service.evaluate({
        tenantId,
        targetOrganizationId,
        conflictingOrganizationId,
        collisionType: 'recent_contact',
      }),
    ).resolves.toEqual({
      action: 'block',
      policy: 'coordinated',
      delayMinutes: null,
    });
  });
});
