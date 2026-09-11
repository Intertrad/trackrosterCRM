import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditEvent } from '../database/schema/audit-events.js';
import type { DatabaseExecutor } from '../database/database.types.js';
import { AuditRepository } from './audit.repository.js';
import { AuditService } from './audit.service.js';

describe('AuditService', () => {
  let repository: {
    create: ReturnType<typeof vi.fn>;
  };

  let service: AuditService;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const actorUserId = '22222222-2222-4222-8222-222222222222';

  const resourceId = '33333333-3333-4333-8333-333333333333';

  const createdEvent: AuditEvent = {
    id: '44444444-4444-4444-8444-444444444444',

    tenantId,

    actorType: 'user',

    actorUserId,

    action: 'campaign.updated',

    resourceType: 'campaign',

    resourceId,

    metadata: {
      previousStatus: 'draft',

      newStatus: 'active',
    },

    occurredAt: new Date('2026-09-11T10:00:00.000Z'),
  };

  beforeEach(() => {
    repository = {
      create: vi.fn().mockResolvedValue(createdEvent),
    };

    service = new AuditService(repository as unknown as AuditRepository);
  });

  it('records a normalized authenticated user event', async () => {
    const result = await service.record({
      tenantId,

      actorType: 'user',

      actorUserId,

      action: '  campaign.updated  ',

      resourceType: '  campaign  ',

      resourceId: `  ${resourceId}  `,

      metadata: {
        previousStatus: 'draft',

        newStatus: 'active',
      },
    });

    expect(repository.create).toHaveBeenCalledWith(
      {
        tenantId,

        actorType: 'user',

        actorUserId,

        action: 'campaign.updated',

        resourceType: 'campaign',

        resourceId,

        metadata: {
          previousStatus: 'draft',

          newStatus: 'active',
        },
      },

      undefined,
    );

    expect(result).toBe(createdEvent);
  });

  it('records a system event without actorUserId', async () => {
    await service.record({
      tenantId,

      actorType: 'system',

      action: 'system.retry_started',

      resourceType: 'job',

      resourceId: 'retry:123',
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: 'system',

        actorUserId: null,

        metadata: {},
      }),

      undefined,
    );
  });

  it('passes the supplied database executor to the repository', async () => {
    const executor = {} as DatabaseExecutor;

    await service.record(
      {
        tenantId,

        actorType: 'user',

        actorUserId,

        action: 'assignment.reassigned',

        resourceType: 'campaign_prospect',

        resourceId,
      },

      executor,
    );

    expect(repository.create).toHaveBeenCalledWith(
      expect.any(Object),

      executor,
    );
  });

  it.each([
    'Campaign.updated',
    'campaign',
    'campaign.',
    '.updated',
    'campaign.UPDATED',
    'campaign updated',
    'campaign.updated.extra',
  ])('rejects invalid audit action %s', async (action) => {
    await expect(
      service.record({
        tenantId,

        actorType: 'user',

        actorUserId,

        action,

        resourceType: 'campaign',

        resourceId,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.create).not.toHaveBeenCalled();
  });

  it.each(['Campaign', 'campaign-prospect', 'campaign prospect', 'campaign.prospect', '', '   '])(
    'rejects invalid audit resource type %s',
    async (resourceType) => {
      await expect(
        service.record({
          tenantId,

          actorType: 'user',

          actorUserId,

          action: 'campaign.updated',

          resourceType,

          resourceId,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it('rejects a blank resourceId', async () => {
    await expect(
      service.record({
        tenantId,

        actorType: 'user',

        actorUserId,

        action: 'campaign.updated',

        resourceType: 'campaign',

        resourceId: '   ',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    'password',
    'passwordHash',
    'password_hash',
    'accessToken',
    'refreshToken',
    'refresh_token_hash',
    'authorization',
    'authorization_header',
    'cookie',
    'cookies',
    'apiKey',
    'api_key',
    'secret',
    'clientSecret',
  ])('rejects forbidden metadata field %s', async (key) => {
    await expect(
      service.record({
        tenantId,

        actorType: 'user',

        actorUserId,

        action: 'user.status_changed',

        resourceType: 'user',

        resourceId,

        metadata: {
          [key]: 'sensitive-value',
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects forbidden metadata fields recursively', async () => {
    await expect(
      service.record({
        tenantId,

        actorType: 'user',

        actorUserId,

        action: 'access_grant.created',

        resourceType: 'access_grant',

        resourceId,

        metadata: {
          scope: {
            team: {
              authorization: 'Bearer secret',
            },
          },
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts ordinary nested JSON metadata', async () => {
    await service.record({
      tenantId,

      actorType: 'user',

      actorUserId,

      action: 'assignment.reassigned',

      resourceType: 'campaign_prospect',

      resourceId,

      metadata: {
        previous: {
          teamId: 'team-a',

          assignedUserId: null,
        },

        next: {
          teamId: 'team-b',

          assignedUserId: 'user-b',
        },

        reasons: ['manual', 'manager-action'],
      },
    });

    expect(repository.create).toHaveBeenCalledOnce();
  });

  it('rejects non-JSON metadata objects', async () => {
    await expect(
      service.record({
        tenantId,

        actorType: 'user',

        actorUserId,

        action: 'campaign.updated',

        resourceType: 'campaign',

        resourceId,

        metadata: {
          date: new Date(),
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
