import {
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthorizationService } from '../authorization/authorization.service.js';
import { ProspectorTodayRepository } from './prospector-today.repository.js';
import { ProspectorTodayService } from './prospector-today.service.js';

describe('ProspectorTodayService', () => {
  let authorizationService: {
    getUserGrants: ReturnType<typeof vi.fn>;
  };

  let repository: {
    findToday: ReturnType<typeof vi.fn>;
  };

  let service: ProspectorTodayService;

  const tenantId = '11111111-1111-4111-8111-111111111111';
  const userId = '22222222-2222-4222-8222-222222222222';
  const organizationId = '33333333-3333-4333-8333-333333333333';
  const teamId = '44444444-4444-4444-8444-444444444444';
  const campaignId = '55555555-5555-4555-8555-555555555555';
  const campaignProspectId = '66666666-6666-4666-8666-666666666666';
  const followUpId = '77777777-7777-4777-8777-777777777777';
  const establishmentId = '88888888-8888-4888-8888-888888888888';

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-20T10:00:00.000Z'));

    authorizationService = {
      getUserGrants: vi.fn().mockResolvedValue([
        {
          role: 'prospector',
          scopeType: 'team',
          organizationId,
          teamId,
        },
      ]),
    };

    repository = {
      findToday: vi.fn().mockResolvedValue({
        summary: {
          actionsLeft: 4,
          toDo: 1,
          followUps: 1,
          meetings: 1,
          overdue: 1,
        },
        completed: [],
        priorities: [
          {
            id: followUpId,
            campaignId,
            campaignProspectId,
            dueAt: new Date('2026-09-20T09:00:00.000Z'),
            category: 'follow_up',
            channel: 'call',
            establishment: {
              id: establishmentId,
              name: 'Nancy central police station',
              city: 'Nancy',
              /* The driver hands numeric back as a string. */
              latitude: '48.6921',
              longitude: '6.1844',
            },
          },
        ],
      }),
    };

    service = new ProspectorTodayService(
      authorizationService as unknown as AuthorizationService,
      repository as unknown as ProspectorTodayRepository,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('authorizes the exact workspace before loading and serializing today', async () => {
    await expect(
      service.getToday({
        tenantId,
        userId,
        teamId,
        timeZone: 'Europe/Paris',
      }),
    ).resolves.toEqual({
      generatedAt: '2026-09-20T10:00:00.000Z',
      day: {
        date: '2026-09-20',
        timeZone: 'Europe/Paris',
        startsAt: '2026-09-19T22:00:00.000Z',
        endsAt: '2026-09-20T22:00:00.000Z',
      },
      summary: {
        actionsLeft: 4,
        toDo: 1,
        followUps: 1,
        meetings: 1,
        overdue: 1,
      },
      completed: [],
      priorities: [
        {
          id: followUpId,
          campaignId,
          campaignProspectId,
          dueAt: '2026-09-20T09:00:00.000Z',
          isOverdue: true,
          category: 'follow_up',
          channel: 'call',
          establishment: {
            id: establishmentId,
            name: 'Nancy central police station',
            city: 'Nancy',
            latitude: 48.6921,
            longitude: 6.1844,
          },
        },
      ],
    });

    expect(authorizationService.getUserGrants).toHaveBeenCalledWith(tenantId, userId);
    expect(repository.findToday).toHaveBeenCalledWith({
      tenantId,
      organizationId,
      teamId,
      userId,
      now: new Date('2026-09-20T10:00:00.000Z'),
      /* Start of the caller's local day, which bounds completed work. */
      startsAt: new Date('2026-09-19T22:00:00.000Z'),
      endsAt: new Date('2026-09-20T22:00:00.000Z'),
    });

    expect(authorizationService.getUserGrants.mock.invocationCallOrder[0]).toBeLessThan(
      repository.findToday.mock.invocationCallOrder[0]!,
    );
  });

  it('rejects a grant for a different team before repository access', async () => {
    authorizationService.getUserGrants.mockResolvedValue([
      {
        role: 'prospector',
        scopeType: 'team',
        organizationId,
        teamId: '99999999-9999-4999-8999-999999999999',
      },
    ]);

    await expect(
      service.getToday({ tenantId, userId, teamId, timeZone: 'Europe/Paris' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(repository.findToday).not.toHaveBeenCalled();
  });

  it('defensively rejects an invalid time zone before repository access', async () => {
    await expect(
      service.getToday({
        tenantId,
        userId,
        teamId,
        timeZone: 'Mars/Olympus_Mons',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.findToday).not.toHaveBeenCalled();
  });

  it('does not mark an action due exactly at generatedAt as overdue', async () => {
    repository.findToday.mockResolvedValue({
      summary: {
        actionsLeft: 1,
        toDo: 1,
        followUps: 0,
        meetings: 0,
        overdue: 0,
      },
      completed: [],
      priorities: [
        {
          id: followUpId,
          campaignId,
          campaignProspectId,
          dueAt: new Date('2026-09-20T10:00:00.000Z'),
          category: 'todo',
          channel: null,
          establishment: {
            id: establishmentId,
            name: 'Nancy central police station',
            city: 'Nancy',
            latitude: 48.6921,
            longitude: 6.1844,
          },
        },
      ],
    });

    const result = await service.getToday({
      tenantId,
      userId,
      teamId,
      timeZone: 'Europe/Paris',
    });

    expect(result.priorities[0]?.isOverdue).toBe(false);
  });

  it('maps repository failures to service unavailable', async () => {
    repository.findToday.mockRejectedValue(new Error('database unavailable'));

    await expect(
      service.getToday({ tenantId, userId, teamId, timeZone: 'Europe/Paris' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
