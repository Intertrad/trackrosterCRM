import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProspectReservationState, WorkQueueProspectDetail } from '@/lib/api/work-queue-types';

const { authenticatedBackendJsonMock, apiErrorResponseMock, unauthenticatedResponseMock } =
  vi.hoisted(() => ({
    authenticatedBackendJsonMock: vi.fn(),

    apiErrorResponseMock: vi.fn(),

    unauthenticatedResponseMock: vi.fn(),
  }));

vi.mock('@/lib/server/authenticated-backend-json', () => ({
  authenticatedBackendJson: authenticatedBackendJsonMock,
}));

vi.mock('@/lib/server/api-error-response', () => ({
  apiErrorResponse: apiErrorResponseMock,

  unauthenticatedResponse: unauthenticatedResponseMock,
}));

import { GET, POST } from './route';

describe('reservation BFF', () => {
  const campaignId = '11111111-1111-4111-8111-111111111111';

  const prospectId = '22222222-2222-4222-8222-222222222222';

  const teamId = '33333333-3333-4333-8333-333333333333';

  const reservationId = '44444444-4444-4444-8444-444444444444';

  const acquiredAt = '2026-09-16T10:00:00.000Z';

  const expiresAt = '2026-09-16T10:20:00.000Z';

  const detailPath = `/work-queue/${campaignId}/${prospectId}` + `?teamId=${teamId}`;

  const reservationPath = `/campaigns/${campaignId}` + `/prospects/${prospectId}` + '/reservation';

  const detailResponse: WorkQueueProspectDetail = {
    campaignProspectId: prospectId,

    campaign: {
      id: campaignId,

      name: 'Paris Expansion',
    },

    assignment: {
      id: '55555555-5555-4555-8555-555555555555',

      organizationId: '66666666-6666-4666-8666-666666666666',

      teamId,

      assignedAt: '2026-09-16T08:00:00.000Z',
    },

    establishment: {
      id: '77777777-7777-4777-8777-777777777777',

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

  const context = {
    params: Promise.resolve({
      campaignId,

      prospectId,
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    unauthenticatedResponseMock.mockReturnValue(
      Response.json(
        {
          statusCode: 401,

          code: 'UNAUTHORIZED',

          message: 'Authentication required',

          error: 'Unauthorized',
        },
        {
          status: 401,
        },
      ),
    );

    apiErrorResponseMock.mockReturnValue(
      Response.json(
        {
          statusCode: 409,

          code: 'CONFLICT',

          message: 'Campaign prospect is currently reserved',

          error: 'Conflict',
        },
        {
          status: 409,
        },
      ),
    );
  });

  describe('GET', () => {
    it('verifies the personal work queue before reading reservation state', async () => {
      const reservationState: ProspectReservationState = {
        state: 'owned',

        reservationId,

        acquiredAt,

        expiresAt,
      };

      authenticatedBackendJsonMock
        .mockResolvedValueOnce(detailResponse)
        .mockResolvedValueOnce(reservationState);

      const request = new Request(
        'http://localhost:3000' +
          `/api/work-queue/${campaignId}/${prospectId}/reservation` +
          `?teamId=${teamId}`,
      );

      const response = await GET(request, context);

      expect(authenticatedBackendJsonMock).toHaveBeenCalledTimes(2);

      expect(authenticatedBackendJsonMock).toHaveBeenNthCalledWith(1, detailPath);

      expect(authenticatedBackendJsonMock).toHaveBeenNthCalledWith(2, reservationPath);

      expect(response.status).toBe(200);

      await expect(response.json()).resolves.toEqual(reservationState);
    });

    it('does not perform the reservation read when personal work queue authentication cannot be restored', async () => {
      authenticatedBackendJsonMock.mockResolvedValueOnce(null);

      const request = new Request(
        'http://localhost:3000' +
          `/api/work-queue/${campaignId}/${prospectId}/reservation` +
          `?teamId=${teamId}`,
      );

      const response = await GET(request, context);

      expect(authenticatedBackendJsonMock).toHaveBeenCalledTimes(1);

      expect(authenticatedBackendJsonMock).toHaveBeenCalledWith(detailPath);

      expect(unauthenticatedResponseMock).toHaveBeenCalledTimes(1);

      expect(response.status).toBe(401);
    });

    it('returns reserved state without exposing another reservation owner', async () => {
      authenticatedBackendJsonMock.mockResolvedValueOnce(detailResponse).mockResolvedValueOnce({
        state: 'reserved',

        expiresAt,
      } satisfies ProspectReservationState);

      const request = new Request(
        'http://localhost:3000' +
          `/api/work-queue/${campaignId}/${prospectId}/reservation` +
          `?teamId=${teamId}`,
      );

      const response = await GET(request, context);

      const body = (await response.json()) as Record<string, unknown>;

      expect(body).toEqual({
        state: 'reserved',

        expiresAt,
      });

      expect(body).not.toHaveProperty('reservationId');
      expect(body).not.toHaveProperty('userId');
      expect(body).not.toHaveProperty('tenantId');
      expect(body).not.toHaveProperty('assignmentId');
      expect(body).not.toHaveProperty('teamId');
      expect(body).not.toHaveProperty('organizationId');
      expect(body).not.toHaveProperty('establishmentId');
    });

    it('delegates reservation-read errors after the personal queue check', async () => {
      const backendError = new Error('reservation read failed');

      authenticatedBackendJsonMock
        .mockResolvedValueOnce(detailResponse)
        .mockRejectedValueOnce(backendError);

      const request = new Request(
        'http://localhost:3000' +
          `/api/work-queue/${campaignId}/${prospectId}/reservation` +
          `?teamId=${teamId}`,
      );

      const response = await GET(request, context);

      expect(apiErrorResponseMock).toHaveBeenCalledWith(backendError);

      expect(response.status).toBe(409);
    });
  });

  describe('POST', () => {
    it('checks the personal work queue, strips browser identity fields, and sanitizes the response', async () => {
      authenticatedBackendJsonMock.mockResolvedValueOnce(detailResponse).mockResolvedValueOnce({
        reservationId,

        tenantId: 'internal-tenant',

        organizationId: 'internal-organization',

        campaignId,

        campaignProspectId: prospectId,

        establishmentId: 'internal-establishment',

        assignmentId: 'internal-assignment',

        teamId,

        userId: 'internal-user',

        acquiredAt,

        expiresAt,
      });

      const request = new Request(
        'http://localhost:3000' +
          `/api/work-queue/${campaignId}/${prospectId}/reservation` +
          `?teamId=${teamId}` +
          '&tenantId=browser-tenant' +
          '&userId=browser-user' +
          '&role=client_admin',
        {
          method: 'POST',

          headers: {
            'content-type': 'application/json',
          },

          body: JSON.stringify({
            tenantId: 'browser-tenant',

            userId: 'browser-user',

            teamId: 'browser-team',

            organizationId: 'browser-organization',

            role: 'client_admin',

            unexpected: 'value',
          }),
        },
      );

      const response = await POST(request, context);

      expect(authenticatedBackendJsonMock).toHaveBeenCalledTimes(2);

      expect(authenticatedBackendJsonMock).toHaveBeenNthCalledWith(1, detailPath);

      expect(authenticatedBackendJsonMock).toHaveBeenNthCalledWith(2, reservationPath, {
        method: 'POST',

        body: JSON.stringify({}),
      });

      expect(response.status).toBe(201);

      const body = (await response.json()) as Record<string, unknown>;

      expect(body).toEqual({
        reservationId,

        acquiredAt,

        expiresAt,
      });

      expect(body).not.toHaveProperty('tenantId');
      expect(body).not.toHaveProperty('userId');
      expect(body).not.toHaveProperty('assignmentId');
      expect(body).not.toHaveProperty('teamId');
      expect(body).not.toHaveProperty('organizationId');
      expect(body).not.toHaveProperty('establishmentId');
      expect(body).not.toHaveProperty('campaignId');
      expect(body).not.toHaveProperty('campaignProspectId');
    });

    it('forwards only overrideId in the acquisition payload', async () => {
      const overrideId = '88888888-8888-4888-8888-888888888888';

      authenticatedBackendJsonMock.mockResolvedValueOnce(detailResponse).mockResolvedValueOnce({
        reservationId,

        tenantId: 'internal-tenant',

        organizationId: 'internal-organization',

        campaignId,

        campaignProspectId: prospectId,

        establishmentId: 'internal-establishment',

        assignmentId: 'internal-assignment',

        teamId,

        userId: 'internal-user',

        acquiredAt,

        expiresAt,
      });

      const request = new Request(
        'http://localhost:3000' +
          `/api/work-queue/${campaignId}/${prospectId}/reservation` +
          `?teamId=${teamId}`,
        {
          method: 'POST',

          headers: {
            'content-type': 'application/json',
          },

          body: JSON.stringify({
            overrideId,

            tenantId: 'browser-tenant',

            userId: 'browser-user',

            unexpected: 'value',
          }),
        },
      );

      await POST(request, context);

      expect(authenticatedBackendJsonMock).toHaveBeenNthCalledWith(2, reservationPath, {
        method: 'POST',

        body: JSON.stringify({
          overrideId,
        }),
      });
    });

    it('does not acquire when the prospect is unavailable from the personal work queue', async () => {
      const queueError = new Error('prospect unavailable');

      authenticatedBackendJsonMock.mockRejectedValueOnce(queueError);

      const request = new Request(
        'http://localhost:3000' +
          `/api/work-queue/${campaignId}/${prospectId}/reservation` +
          `?teamId=${teamId}`,
        {
          method: 'POST',
        },
      );

      const response = await POST(request, context);

      expect(authenticatedBackendJsonMock).toHaveBeenCalledTimes(1);

      expect(apiErrorResponseMock).toHaveBeenCalledWith(queueError);

      expect(response.status).toBe(409);
    });
  });

  it('URL-encodes both the personal queue check and reservation backend path', async () => {
    authenticatedBackendJsonMock.mockResolvedValueOnce(detailResponse).mockResolvedValueOnce({
      state: 'none',
    });

    const encodedContext = {
      params: Promise.resolve({
        campaignId: 'campaign id',

        prospectId: 'prospect?id',
      }),
    };

    const request = new Request(
      'http://localhost:3000/api/work-queue/example/example/reservation' + `?teamId=${teamId}`,
    );

    await GET(request, encodedContext);

    expect(authenticatedBackendJsonMock).toHaveBeenNthCalledWith(
      1,
      '/work-queue/campaign%20id/prospect%3Fid' + `?teamId=${teamId}`,
    );

    expect(authenticatedBackendJsonMock).toHaveBeenNthCalledWith(
      2,
      '/campaigns/campaign%20id/prospects/prospect%3Fid/reservation',
    );
  });
});
