import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CollisionOverride } from '../database/schema/collision-overrides.js';
import { ManagerOverrideController } from './manager-override.controller.js';
import { ManagerOverrideService } from './manager-override.service.js';

describe('ManagerOverrideController', () => {
  let service: ManagerOverrideService;

  let controller: ManagerOverrideController;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const approverUserId = '22222222-2222-4222-8222-222222222222';

  const prospectorUserId = '33333333-3333-4333-8333-333333333333';

  const campaignId = '44444444-4444-4444-8444-444444444444';

  const campaignProspectId = '55555555-5555-4555-8555-555555555555';

  const overrideId = '66666666-6666-4666-8666-666666666666';

  beforeEach(() => {
    service = {
      create: vi.fn(),
    } as unknown as ManagerOverrideService;

    controller = new ManagerOverrideController(service);
  });

  it('creates an override using authenticated approver context', async () => {
    const createdAt = new Date('2026-09-10T12:00:00.000Z');

    const expiresAt = new Date('2026-09-10T12:10:00.000Z');

    vi.mocked(service.create).mockResolvedValue({
      id: overrideId,

      tenantId,

      campaignId,

      campaignProspectId,

      establishmentId: '77777777-7777-4777-8777-777777777777',

      assignmentId: '88888888-8888-4888-8888-888888888888',

      organizationId: '99999999-9999-4999-8999-999999999999',

      teamId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',

      prospectorUserId,

      approvedByUserId: approverUserId,

      approvedByRole: 'manager',

      reasonCode: 'PLANNED_ACTION',

      conflictKey: 'planned_action:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb:2026-09-11T10:00:00.000Z',

      conflictSnapshot: {
        followUpId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      },

      reason: 'Approved after team coordination.',

      expiresAt,

      createdAt,
    } satisfies CollisionOverride);

    const result = await controller.create(
      {
        tenantId,
        userId: approverUserId,
      },

      campaignId,

      campaignProspectId,

      {
        prospectorUserId,

        reason: 'Approved after team coordination.',
      },
    );

    expect(service.create).toHaveBeenCalledWith({
      tenantId,

      approvedByUserId: approverUserId,

      prospectorUserId,

      campaignId,

      campaignProspectId,

      reason: 'Approved after team coordination.',
    });

    expect(result).toEqual({
      overrideId,

      reasonCode: 'PLANNED_ACTION',

      approvedByRole: 'manager',

      expiresAt: '2026-09-10T12:10:00.000Z',

      createdAt: '2026-09-10T12:00:00.000Z',
    });
  });

  it('does not expose the stored collision snapshot', async () => {
    vi.mocked(service.create).mockResolvedValue({
      id: overrideId,

      tenantId,

      campaignId,

      campaignProspectId,

      establishmentId: '77777777-7777-4777-8777-777777777777',

      assignmentId: '88888888-8888-4888-8888-888888888888',

      organizationId: '99999999-9999-4999-8999-999999999999',

      teamId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',

      prospectorUserId,

      approvedByUserId: approverUserId,

      approvedByRole: 'director',

      reasonCode: 'RECENT_CONTACT',

      conflictKey: 'recent_contact:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb:2026-09-10T13:00:00.000Z',

      conflictSnapshot: {
        activityId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',

        confidentialInternalField: 'must-not-leak',
      },

      reason: 'Approved after coordination.',

      expiresAt: new Date('2026-09-10T12:10:00.000Z'),

      createdAt: new Date('2026-09-10T12:00:00.000Z'),
    } satisfies CollisionOverride);

    const result = await controller.create(
      {
        tenantId,
        userId: approverUserId,
      },

      campaignId,

      campaignProspectId,

      {
        prospectorUserId,

        reason: 'Approved after coordination.',
      },
    );

    expect(result).not.toHaveProperty('conflictSnapshot');

    expect(result).not.toHaveProperty('conflictKey');

    expect(result).not.toHaveProperty('approvedByUserId');
  });
});
