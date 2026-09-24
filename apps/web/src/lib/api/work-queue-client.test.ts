import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  AcquiredProspectReservation,
  ProspectCollisionDecision,
  ProspectReservationState,
  ProspectTimelinePage,
  RecordedProspectActivity,
  ReleasedProspectReservation,
  WorkQueueOptionsResponse,
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
  acquireProspectReservation,
  getProspectCollisionDecision,
  getProspectReservation,
  getWorkQueueOptions,
  getWorkQueueProspectDetail,
  listProspectTimeline,
  listWorkQueue,
  releaseProspectReservation,
  recordProspectActivity,
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

        lifecycleStage: 'follow_up',

        q: '  Paris Clinic  ',

        cursor: 'next-page',

        limit: 50,
      });

      expect(browserJsonMock).toHaveBeenCalledWith(
        '/api/work-queue' +
          `?teamId=${teamId}` +
          `&campaignId=${campaignId}` +
          '&lifecycleStage=follow_up' +
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

  describe('getWorkQueueOptions', () => {
    const optionsResponse: WorkQueueOptionsResponse = {
      campaigns: [
        {
          id: campaignId,

          name: 'Paris Expansion',
        },
      ],
    };

    beforeEach(() => {
      browserJsonMock.mockResolvedValue(optionsResponse);
    });

    it('requests options through the relative BFF URL and encodes teamId', async () => {
      await getWorkQueueOptions({
        teamId: 'team/value + west',
      });

      expect(browserJsonMock).toHaveBeenCalledTimes(1);

      expect(browserJsonMock).toHaveBeenCalledWith(
        '/api/work-queue/options?teamId=team%2Fvalue+%2B+west',
        {
          method: 'GET',

          cache: 'no-store',
        },
      );
    });

    it('returns the typed work queue options response', async () => {
      await expect(
        getWorkQueueOptions({
          teamId,
        }),
      ).resolves.toEqual(optionsResponse);
    });

    it('propagates work queue options transport errors unchanged', async () => {
      const error = new Error('work queue options request failed');

      browserJsonMock.mockRejectedValue(error);

      await expect(
        getWorkQueueOptions({
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

        latitude: 49.1596,

        longitude: 5.3828,

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

  describe('getProspectReservation', () => {
    const reservationResponse: ProspectReservationState = {
      state: 'owned',

      reservationId: '77777777-7777-4777-8777-777777777777',

      acquiredAt: '2026-09-16T10:00:00.000Z',

      expiresAt: '2026-09-16T10:20:00.000Z',
    };

    beforeEach(() => {
      browserJsonMock.mockResolvedValue(reservationResponse);
    });

    it('requests reservation state through the selected prospector team workspace', async () => {
      await getProspectReservation({
        campaignId,

        prospectId,

        teamId,
      });

      expect(browserJsonMock).toHaveBeenCalledWith(
        `/api/work-queue/${campaignId}/${prospectId}/reservation` + `?teamId=${teamId}`,
        {
          method: 'GET',

          cache: 'no-store',
        },
      );
    });

    it('URL-encodes campaign and prospect reservation route segments', async () => {
      await getProspectReservation({
        campaignId: 'campaign/value',

        prospectId: 'prospect value',

        teamId,
      });

      expect(browserJsonMock).toHaveBeenCalledWith(
        '/api/work-queue/campaign%2Fvalue/prospect%20value/reservation' + `?teamId=${teamId}`,
        {
          method: 'GET',

          cache: 'no-store',
        },
      );
    });

    it('returns the typed reservation state', async () => {
      await expect(
        getProspectReservation({
          campaignId,

          prospectId,

          teamId,
        }),
      ).resolves.toEqual(reservationResponse);
    });

    it('propagates reservation-state transport errors unchanged', async () => {
      const error = new Error('reservation request failed');

      browserJsonMock.mockRejectedValue(error);

      await expect(
        getProspectReservation({
          campaignId,

          prospectId,

          teamId,
        }),
      ).rejects.toBe(error);
    });
  });

  describe('acquireProspectReservation', () => {
    const reservationId = '77777777-7777-4777-8777-777777777777';

    const acquiredResponse: AcquiredProspectReservation = {
      reservationId,

      acquiredAt: '2026-09-16T10:00:00.000Z',

      expiresAt: '2026-09-16T10:20:00.000Z',
    };

    beforeEach(() => {
      browserJsonMock.mockResolvedValue(acquiredResponse);
    });

    it('acquires a reservation through the selected prospector team workspace', async () => {
      await acquireProspectReservation({
        campaignId,

        prospectId,

        teamId,
      });

      expect(browserJsonMock).toHaveBeenCalledWith(
        `/api/work-queue/${campaignId}/${prospectId}/reservation` + `?teamId=${teamId}`,
        {
          method: 'POST',

          headers: {
            'content-type': 'application/json',
          },

          body: JSON.stringify({}),
        },
      );
    });

    it('forwards only the optional override identifier in the acquisition body', async () => {
      const overrideId = '88888888-8888-4888-8888-888888888888';

      await acquireProspectReservation({
        campaignId,

        prospectId,

        teamId,

        overrideId,
      });

      expect(browserJsonMock).toHaveBeenCalledWith(
        `/api/work-queue/${campaignId}/${prospectId}/reservation` + `?teamId=${teamId}`,
        {
          method: 'POST',

          headers: {
            'content-type': 'application/json',
          },

          body: JSON.stringify({
            overrideId,
          }),
        },
      );
    });

    it('URL-encodes campaign and prospect acquisition route segments', async () => {
      await acquireProspectReservation({
        campaignId: 'campaign/value',

        prospectId: 'prospect value',

        teamId,
      });

      expect(browserJsonMock).toHaveBeenCalledWith(
        '/api/work-queue/campaign%2Fvalue/prospect%20value/reservation' + `?teamId=${teamId}`,
        {
          method: 'POST',

          headers: {
            'content-type': 'application/json',
          },

          body: JSON.stringify({}),
        },
      );
    });

    it('returns the typed acquired reservation', async () => {
      await expect(
        acquireProspectReservation({
          campaignId,

          prospectId,

          teamId,
        }),
      ).resolves.toEqual(acquiredResponse);
    });

    it('propagates reservation acquisition errors unchanged', async () => {
      const error = new Error('reservation acquisition failed');

      browserJsonMock.mockRejectedValue(error);

      await expect(
        acquireProspectReservation({
          campaignId,

          prospectId,

          teamId,
        }),
      ).rejects.toBe(error);
    });
  });

  describe('releaseProspectReservation', () => {
    const reservationId = '77777777-7777-4777-8777-777777777777';

    const releasedResponse: ReleasedProspectReservation = {
      released: true,

      reservationId,
    };

    beforeEach(() => {
      browserJsonMock.mockResolvedValue(releasedResponse);
    });

    it('releases the exact reservation through the selected prospector team workspace', async () => {
      await releaseProspectReservation({
        campaignId,

        prospectId,

        teamId,

        reservationId,
      });

      expect(browserJsonMock).toHaveBeenCalledWith(
        `/api/work-queue/${campaignId}/${prospectId}` +
          `/reservation/${reservationId}` +
          `?teamId=${teamId}`,
        {
          method: 'DELETE',
        },
      );
    });

    it('URL-encodes every reservation release route segment', async () => {
      await releaseProspectReservation({
        campaignId: 'campaign/value',

        prospectId: 'prospect value',

        teamId,

        reservationId: 'reservation/value',
      });

      expect(browserJsonMock).toHaveBeenCalledWith(
        '/api/work-queue/campaign%2Fvalue/prospect%20value' +
          '/reservation/reservation%2Fvalue' +
          `?teamId=${teamId}`,
        {
          method: 'DELETE',
        },
      );
    });

    it('returns the typed release response', async () => {
      await expect(
        releaseProspectReservation({
          campaignId,

          prospectId,

          teamId,

          reservationId,
        }),
      ).resolves.toEqual(releasedResponse);
    });

    it('propagates reservation release errors unchanged', async () => {
      const error = new Error('reservation release failed');

      browserJsonMock.mockRejectedValue(error);

      await expect(
        releaseProspectReservation({
          campaignId,

          prospectId,

          teamId,

          reservationId,
        }),
      ).rejects.toBe(error);
    });
  });

  describe('getProspectCollisionDecision', () => {
    const collisionResponse: ProspectCollisionDecision = {
      decision: 'block',

      reasonCode: 'RECENT_CONTACT',

      conflict: {
        expiresAt: '2026-09-16T11:00:00.000Z',
      },
    };

    beforeEach(() => {
      browserJsonMock.mockResolvedValue(collisionResponse);
    });

    it('requests the collision decision through the selected prospector team workspace', async () => {
      await getProspectCollisionDecision({
        campaignId,

        prospectId,

        teamId,
      });

      expect(browserJsonMock).toHaveBeenCalledWith(
        `/api/work-queue/${campaignId}/${prospectId}/collision-decision` + `?teamId=${teamId}`,
        {
          method: 'GET',

          cache: 'no-store',
        },
      );
    });

    it('URL-encodes campaign and prospect collision route segments', async () => {
      await getProspectCollisionDecision({
        campaignId: 'campaign/value',

        prospectId: 'prospect value',

        teamId,
      });

      expect(browserJsonMock).toHaveBeenCalledWith(
        '/api/work-queue/campaign%2Fvalue/prospect%20value/collision-decision' +
          `?teamId=${teamId}`,
        {
          method: 'GET',

          cache: 'no-store',
        },
      );
    });

    it('returns the typed collision decision', async () => {
      await expect(
        getProspectCollisionDecision({
          campaignId,

          prospectId,

          teamId,
        }),
      ).resolves.toEqual(collisionResponse);
    });

    it('propagates collision-decision transport errors unchanged', async () => {
      const error = new Error('collision decision request failed');

      browserJsonMock.mockRejectedValue(error);

      await expect(
        getProspectCollisionDecision({
          campaignId,

          prospectId,

          teamId,
        }),
      ).rejects.toBe(error);
    });

    describe('recordProspectActivity', () => {
      const activityId = '77777777-7777-4777-8777-777777777777';

      const activityResponse: RecordedProspectActivity = {
        id: activityId,
        type: 'call',
        occurredAt: '2026-09-16T12:00:00.000Z',
      };

      beforeEach(() => {
        browserJsonMock.mockResolvedValue(activityResponse);
      });

      it('records an activity through the selected prospector team workspace', async () => {
        const idempotencyKey = 'activity-call-20260916-001';

        await recordProspectActivity({
          campaignId,
          prospectId,
          teamId,
          type: 'call',
          idempotencyKey,
        });

        expect(browserJsonMock).toHaveBeenCalledWith(
          `/api/work-queue/${campaignId}/${prospectId}/activities` + `?teamId=${teamId}`,
          {
            method: 'POST',

            headers: {
              'content-type': 'application/json',
              'idempotency-key': idempotencyKey,
            },

            body: JSON.stringify({
              type: 'call',
            }),
          },
        );
      });

      it('forwards the exact idempotency key unchanged', async () => {
        const idempotencyKey = 'Case-Sensitive-Key_ABC-123';

        await recordProspectActivity({
          campaignId,
          prospectId,
          teamId,
          type: 'email',
          idempotencyKey,
        });

        expect(browserJsonMock).toHaveBeenCalledWith(
          `/api/work-queue/${campaignId}/${prospectId}/activities` + `?teamId=${teamId}`,
          {
            method: 'POST',

            headers: {
              'content-type': 'application/json',
              'idempotency-key': idempotencyKey,
            },

            body: JSON.stringify({
              type: 'email',
            }),
          },
        );
      });

      it('URL-encodes campaign and prospect route segments', async () => {
        await recordProspectActivity({
          campaignId: 'campaign/value',
          prospectId: 'prospect value',
          teamId,
          type: 'visit',
          idempotencyKey: 'activity-visit-001',
        });

        expect(browserJsonMock).toHaveBeenCalledWith(
          '/api/work-queue/campaign%2Fvalue/prospect%20value/activities' + `?teamId=${teamId}`,
          {
            method: 'POST',

            headers: {
              'content-type': 'application/json',
              'idempotency-key': 'activity-visit-001',
            },

            body: JSON.stringify({
              type: 'visit',
            }),
          },
        );
      });

      it('returns the typed recorded activity', async () => {
        await expect(
          recordProspectActivity({
            campaignId,
            prospectId,
            teamId,
            type: 'call',
            idempotencyKey: 'activity-call-001',
          }),
        ).resolves.toEqual(activityResponse);
      });

      it('propagates activity transport errors unchanged', async () => {
        const error = new Error('activity request failed');

        browserJsonMock.mockRejectedValue(error);

        await expect(
          recordProspectActivity({
            campaignId,
            prospectId,
            teamId,
            type: 'message',
            idempotencyKey: 'activity-message-001',
          }),
        ).rejects.toBe(error);
      });
    });
  });
});
