import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProspectorTodayResponse } from './prospector-today-types';

const { browserJsonMock } = vi.hoisted(() => ({
  browserJsonMock: vi.fn(),
}));

vi.mock('./browser-json', () => ({
  browserJson: browserJsonMock,
}));

import { getProspectorToday } from './prospector-today-client';

describe('prospector-today-client', () => {
  const response: ProspectorTodayResponse = {
    generatedAt: '2026-09-20T10:00:00.000Z',
    day: {
      date: '2026-09-20',
      timeZone: 'Europe/Paris',
      startsAt: '2026-09-19T22:00:00.000Z',
      endsAt: '2026-09-20T22:00:00.000Z',
    },
    summary: {
      actionsLeft: 0,
      toDo: 0,
      followUps: 0,
      meetings: 0,
      overdue: 0,
      completedToday: 12,
    },
    completed: [],
    priorities: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    browserJsonMock.mockResolvedValue(response);
  });

  it('requests Today through the relative BFF URL with encoded context', async () => {
    const controller = new AbortController();

    await getProspectorToday({
      teamId: 'team/value + east',
      timeZone: 'Europe/Paris',
      signal: controller.signal,
    });

    expect(browserJsonMock).toHaveBeenCalledWith(
      '/api/prospector/today?teamId=team%2Fvalue+%2B+east&timeZone=Europe%2FParis',
      {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      },
    );
  });

  it('returns the typed Today response', async () => {
    await expect(
      getProspectorToday({
        teamId: '11111111-1111-4111-8111-111111111111',
        timeZone: 'UTC',
      }),
    ).resolves.toEqual(response);
  });

  it('propagates browser transport errors unchanged', async () => {
    const error = new Error('today request failed');

    browserJsonMock.mockRejectedValue(error);

    await expect(
      getProspectorToday({
        teamId: '11111111-1111-4111-8111-111111111111',
        timeZone: 'UTC',
      }),
    ).rejects.toBe(error);
  });
});
