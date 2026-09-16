import { beforeEach, describe, expect, it, vi } from 'vitest';

const { browserJsonMock } = vi.hoisted(() => ({
  browserJsonMock: vi.fn(),
}));

vi.mock('./browser-json', () => ({
  browserJson: browserJsonMock,
}));

import { listWorkQueue } from './work-queue-client';

describe('listWorkQueue', () => {
  const teamId = '11111111-1111-4111-8111-111111111111';

  const campaignId = '22222222-2222-4222-8222-222222222222';

  beforeEach(() => {
    vi.clearAllMocks();

    browserJsonMock.mockResolvedValue({
      items: [],

      page: {
        limit: 25,

        hasMore: false,

        nextCursor: null,
      },
    });
  });

  it('requests the selected prospector team queue', async () => {
    await listWorkQueue({
      teamId,
    });

    expect(browserJsonMock).toHaveBeenCalledWith(`/api/work-queue?teamId=${teamId}`, {
      method: 'GET',

      cache: 'no-store',
    });
  });

  it('forwards supported filters and pagination', async () => {
    await listWorkQueue({
      teamId,

      campaignId,

      q: '  Paris Clinic  ',

      cursor: 'next-page',

      limit: 50,
    });

    expect(browserJsonMock).toHaveBeenCalledWith(
      '/api/work-queue' +
        `?teamId=${teamId}` +
        `&campaignId=${campaignId}` +
        '&q=Paris+Clinic' +
        '&cursor=next-page' +
        '&limit=50',
      {
        method: 'GET',

        cache: 'no-store',
      },
    );
  });

  it('does not send an empty search filter', async () => {
    await listWorkQueue({
      teamId,

      q: '   ',
    });

    expect(browserJsonMock).toHaveBeenCalledWith(`/api/work-queue?teamId=${teamId}`, {
      method: 'GET',

      cache: 'no-store',
    });
  });

  it('returns the typed work queue response', async () => {
    const response = {
      items: [],

      page: {
        limit: 25,

        hasMore: false,

        nextCursor: null,
      },
    };

    browserJsonMock.mockResolvedValue(response);

    await expect(
      listWorkQueue({
        teamId,
      }),
    ).resolves.toEqual(response);
  });

  it('propagates browser transport errors', async () => {
    const error = new Error('request failed');

    browserJsonMock.mockRejectedValue(error);

    await expect(
      listWorkQueue({
        teamId,
      }),
    ).rejects.toBe(error);
  });
});
