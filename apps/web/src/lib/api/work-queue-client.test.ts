import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ProspectTimelinePage,
  WorkQueueProspectDetail,
  WorkQueueResponse,
} from './work-queue-types';

const { browserJsonMock } = vi.hoisted(() => ({
  browserJsonMock: vi.fn(),
}));

vi.mock('./browser-json', () => ({
  browserJson: browserJsonMock,
}));

import {
  getWorkQueueProspectDetail,
  listProspectTimeline,
  listWorkQueue,
} from './work-queue-client';

describe('work-queue-client', () => {
  const teamId = '11111111-1111-4111-8111-111111111111';

  const campaignId = '22222222-2222-4222-8222-222222222222';

  const prospectId = '33333333-3333-4333-8333-333333333333';

  const assignmentId = '44444444-4444-4444-8444-444444444444';

  const organizationId = '55555555-5555-4555-8555-555555555555';

  const establishmentId = '66666666-6666-4666-8666-666666666666';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listWorkQueue', () => {
    const emptyWorkQueueResponse: WorkQueueResponse = {
      items: [],

      page: {
        limit: 25,

        hasMore: false,

        nextCursor: null,
      },
    };

    beforeEach(() => {
      browserJsonMock.mockResolvedValue(emptyWorkQueueResponse);
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
      const response: WorkQueueResponse = {
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

  describe('getWorkQueueProspectDetail', () => {
    const detailResponse: WorkQueueProspectDetail = {
      campaignProspectId: prospectId,

      campaign: {
        id: campaignId,

        name: 'Paris Expansion',
      },

      assignment: {
        id: assignmentId,

        organizationId,

        teamId,

        assignedAt: '2026-09-16T08:00:00.000Z',
      },

      establishment: {
        id: establishmentId,

        regionId: null,

        name: 'Paris Clinic',

        addressLine1: '10 Rue de Rivoli',

        postalCode: '75001',

        city: 'Paris',

        countryCode: 'FR',

        phone: '+33100000000',

        website: 'https://paris-clinic.example',

        status: 'active',
      },
    };

    beforeEach(() => {
      browserJsonMock.mockResolvedValue(detailResponse);
    });

    it('requests prospect detail for the selected prospector team', async () => {
      await getWorkQueueProspectDetail({
        campaignId,

        prospectId,

        teamId,
      });

      expect(browserJsonMock).toHaveBeenCalledWith(
        `/api/work-queue/${campaignId}/${prospectId}` + `?teamId=${teamId}`,
        {
          method: 'GET',

          cache: 'no-store',
        },
      );
    });

    it('URL-encodes campaign and prospect route segments', async () => {
      await getWorkQueueProspectDetail({
        campaignId: 'campaign/value',

        prospectId: 'prospect value',

        teamId,
      });

      expect(browserJsonMock).toHaveBeenCalledWith(
        '/api/work-queue/campaign%2Fvalue/prospect%20value' + `?teamId=${teamId}`,
        {
          method: 'GET',

          cache: 'no-store',
        },
      );
    });

    it('returns the typed prospect detail response', async () => {
      browserJsonMock.mockResolvedValue(detailResponse);

      await expect(
        getWorkQueueProspectDetail({
          campaignId,

          prospectId,

          teamId,
        }),
      ).resolves.toEqual(detailResponse);
    });

    it('propagates prospect detail transport errors unchanged', async () => {
      const error = new Error('prospect detail request failed');

      browserJsonMock.mockRejectedValue(error);

      await expect(
        getWorkQueueProspectDetail({
          campaignId,

          prospectId,

          teamId,
        }),
      ).rejects.toBe(error);
    });
  });

  describe('listProspectTimeline', () => {
    const timelineResponse: ProspectTimelinePage = {
      items: [
        {
          kind: 'activity',

          id: '77777777-7777-4777-8777-777777777777',

          occurredAt: '2026-09-16T09:30:00.000Z',

          activityType: 'call',

          actor: {
            userId: '88888888-8888-4888-8888-888888888888',
          },

          context: {
            campaignId,

            campaignProspectId: prospectId,

            establishmentId,

            assignmentId,
          },
        },
      ],

      nextCursor: 'next-timeline-page',
    };

    beforeEach(() => {
      browserJsonMock.mockResolvedValue(timelineResponse);
    });

    it('requests the prospect timeline through the selected prospector team workspace', async () => {
      await listProspectTimeline({
        campaignId,

        prospectId,

        teamId,
      });

      expect(browserJsonMock).toHaveBeenCalledWith(
        `/api/work-queue/${campaignId}/${prospectId}/timeline` + `?teamId=${teamId}`,
        {
          method: 'GET',

          cache: 'no-store',
        },
      );
    });

    it('forwards timeline limit and cursor pagination', async () => {
      await listProspectTimeline({
        campaignId,

        prospectId,

        teamId,

        limit: 25,

        cursor: 'older-events',
      });

      expect(browserJsonMock).toHaveBeenCalledWith(
        `/api/work-queue/${campaignId}/${prospectId}/timeline` +
          `?teamId=${teamId}` +
          '&limit=25' +
          '&cursor=older-events',
        {
          method: 'GET',

          cache: 'no-store',
        },
      );
    });

    it('URL-encodes campaign and prospect timeline route segments', async () => {
      await listProspectTimeline({
        campaignId: 'campaign/value',

        prospectId: 'prospect value',

        teamId,

        limit: 25,
      });

      expect(browserJsonMock).toHaveBeenCalledWith(
        '/api/work-queue/campaign%2Fvalue/prospect%20value/timeline' +
          `?teamId=${teamId}` +
          '&limit=25',
        {
          method: 'GET',

          cache: 'no-store',
        },
      );
    });

    it('returns the typed timeline response', async () => {
      browserJsonMock.mockResolvedValue(timelineResponse);

      await expect(
        listProspectTimeline({
          campaignId,

          prospectId,

          teamId,
        }),
      ).resolves.toEqual(timelineResponse);
    });

    it('propagates timeline transport errors unchanged', async () => {
      const error = new Error('timeline request failed');

      browserJsonMock.mockRejectedValue(error);

      await expect(
        listProspectTimeline({
          campaignId,

          prospectId,

          teamId,
        }),
      ).rejects.toBe(error);
    });
  });
});
