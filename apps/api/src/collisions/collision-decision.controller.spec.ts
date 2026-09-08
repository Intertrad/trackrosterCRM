import { describe, expect, it, vi } from 'vitest';

import { CollisionDecisionController } from './collision-decision.controller.js';
import { CollisionDecisionService } from './collision-decision.service.js';

describe('CollisionDecisionController', () => {
  it('uses tenant and user identity from authentication context', async () => {
    const evaluate = vi.fn().mockResolvedValue({
      decision: 'allow',

      reasonCode: 'NO_COLLISION',

      establishmentId: '33333333-3333-4333-8333-333333333333',

      conflict: null,
    });

    const service = {
      evaluate,
    } as unknown as CollisionDecisionService;

    const controller = new CollisionDecisionController(service);

    const tenantId = '11111111-1111-4111-8111-111111111111';

    const userId = '22222222-2222-4222-8222-222222222222';

    const campaignId = '44444444-4444-4444-8444-444444444444';

    const prospectId = '55555555-5555-4555-8555-555555555555';

    const result = await controller.evaluate(
      {
        tenantId,
        userId,
      },
      campaignId,
      prospectId,
    );

    expect(evaluate).toHaveBeenCalledWith({
      tenantId,
      userId,
      campaignId,
      campaignProspectId: prospectId,
    });

    expect(result).toEqual({
      decision: 'allow',

      reasonCode: 'NO_COLLISION',

      establishmentId: '33333333-3333-4333-8333-333333333333',

      conflict: null,
    });
  });

  it('does not expose internal conflict ownership details', async () => {
    const service = {
      evaluate: vi.fn().mockResolvedValue({
        decision: 'block',

        reasonCode: 'ACTIVE_RESERVATION',

        establishmentId: '33333333-3333-4333-8333-333333333333',

        conflict: {
          reservationId: '66666666-6666-4666-8666-666666666666',

          campaignId: '77777777-7777-4777-8777-777777777777',

          campaignProspectId: '88888888-8888-4888-8888-888888888888',

          assignmentId: '99999999-9999-4999-8999-999999999999',

          teamId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',

          userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',

          acquiredAt: '2026-09-08T08:00:00.000Z',

          expiresAt: '2026-09-08T08:20:00.000Z',
        },
      }),
    } as unknown as CollisionDecisionService;

    const controller = new CollisionDecisionController(service);

    const result = await controller.evaluate(
      {
        tenantId: '11111111-1111-4111-8111-111111111111',

        userId: '22222222-2222-4222-8222-222222222222',
      },
      '44444444-4444-4444-8444-444444444444',
      '55555555-5555-4555-8555-555555555555',
    );

    expect(result.conflict).toEqual({
      expiresAt: '2026-09-08T08:20:00.000Z',
    });
  });
});
