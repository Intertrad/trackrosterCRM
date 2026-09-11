import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedUser } from '../auth/auth.types.js';
import { AccessGrantController } from './access-grant.controller.js';
import { AccessGrantService } from './access-grant.service.js';
import { AuthorizationService } from './authorization.service.js';

describe('AccessGrantController', () => {
  let accessGrantService: {
    create: ReturnType<typeof vi.fn>;

    revoke: ReturnType<typeof vi.fn>;

    list: ReturnType<typeof vi.fn>;
  };

  let controller: AccessGrantController;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const actorUserId = '22222222-2222-4222-8222-222222222222';

  const targetUserId = '33333333-3333-4333-8333-333333333333';

  const grantId = '44444444-4444-4444-8444-444444444444';

  const auth = {
    tenantId,

    userId: actorUserId,
  } as AuthenticatedUser;

  beforeEach(() => {
    accessGrantService = {
      create: vi.fn(),

      revoke: vi.fn(),

      list: vi.fn(),
    };

    controller = new AccessGrantController(
      accessGrantService as unknown as AccessGrantService,

      {} as AuthorizationService,
    );
  });

  it('uses the authenticated client admin as the grant creation actor', async () => {
    await controller.create(
      auth,

      targetUserId,

      {
        role: 'client_admin',

        scopeType: 'tenant',
      },
    );

    expect(accessGrantService.create).toHaveBeenCalledWith({
      tenantId,

      actorUserId,

      userId: targetUserId,

      role: 'client_admin',

      scopeType: 'tenant',
    });
  });

  it('uses the authenticated client admin as the revocation actor', async () => {
    await controller.revoke(
      auth,

      targetUserId,

      grantId,
    );

    expect(accessGrantService.revoke).toHaveBeenCalledWith({
      tenantId,

      actorUserId,

      userId: targetUserId,

      grantId,
    });
  });
});
