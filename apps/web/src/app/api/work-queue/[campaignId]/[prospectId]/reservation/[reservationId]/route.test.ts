import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WorkQueueProspectDetail } from '@/lib/api/work-queue-types';

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

import { DELETE } from './route';

describe('DELETE /api/work-queue/:campaignId/:prospectId/reservation/:reservationId', () => {
  const campaignId = '11111111-1111-4111-8111-111111111111';

  const prospectId = '22222222-2222-4222-8222-222222222222';

  const teamId = '33333333-3333-4333-8333-333333333333';

  const reservationId = '44444444-4444-4444-8444-444444444444';

  const detailPath = `/work-queue/${campaignId}/${prospectId}` + `?teamId=${teamId}`;

  const releasePath =
    `/campaigns/${campaignId}` + `/prospects/${prospectId}` + `/reservation/${reservationId}`;

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

      latitude: 49.1596,

      longitude: 5.3828,

      phone: '+33100000000',

      website: 'https://paris-clinic.example',

      status: 'active',
    },
  };

  const context = {
    params: Promise.resolve({
      campaignId,

      prospectId,

      reservationId,
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

          message: 'Reservation has changed',

          error: 'Conflict',
        },
        {
          status: 409,
        },
      ),
    );
  });

  it('verifies the personal work queue before releasing the reservation', async () => {
    authenticatedBackendJsonMock.mockResolvedValueOnce(detailResponse).mockResolvedValueOnce({
      released: true,

      reservationId,
    });

    const request = new Request(
      'http://localhost:3000' +
        `/api/work-queue/${campaignId}/${prospectId}` +
        `/reservation/${reservationId}` +
        `?teamId=${teamId}`,
      {
        method: 'DELETE',
      },
    );

    const response = await DELETE(request, context);

    expect(authenticatedBackendJsonMock).toHaveBeenCalledTimes(2);

    expect(authenticatedBackendJsonMock).toHaveBeenNthCalledWith(1, detailPath);

    expect(authenticatedBackendJsonMock).toHaveBeenNthCalledWith(2, releasePath, {
      method: 'DELETE',
    });

    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toEqual({
      released: true,

      reservationId,
    });
  });

  it('does not release when the personal work queue session cannot be restored', async () => {
    authenticatedBackendJsonMock.mockResolvedValueOnce(null);

    const request = new Request(
      'http://localhost:3000' +
        `/api/work-queue/${campaignId}/${prospectId}` +
        `/reservation/${reservationId}` +
        `?teamId=${teamId}`,
      {
        method: 'DELETE',
      },
    );

    const response = await DELETE(request, context);

    expect(authenticatedBackendJsonMock).toHaveBeenCalledTimes(1);

    expect(authenticatedBackendJsonMock).toHaveBeenCalledWith(detailPath);

    expect(unauthenticatedResponseMock).toHaveBeenCalledTimes(1);

    expect(apiErrorResponseMock).not.toHaveBeenCalled();

    expect(response.status).toBe(401);
  });

  it('does not release when the prospect is unavailable from the personal work queue', async () => {
    const queueError = new Error('prospect unavailable');

    authenticatedBackendJsonMock.mockRejectedValueOnce(queueError);

    const request = new Request(
      'http://localhost:3000' +
        `/api/work-queue/${campaignId}/${prospectId}` +
        `/reservation/${reservationId}` +
        `?teamId=${teamId}`,
      {
        method: 'DELETE',
      },
    );

    const response = await DELETE(request, context);

    expect(authenticatedBackendJsonMock).toHaveBeenCalledTimes(1);

    expect(apiErrorResponseMock).toHaveBeenCalledWith(queueError);

    expect(response.status).toBe(409);
  });

  it('delegates release conflicts after the personal work queue check', async () => {
    const releaseError = new Error('reservation changed');

    authenticatedBackendJsonMock
      .mockResolvedValueOnce(detailResponse)
      .mockRejectedValueOnce(releaseError);

    const request = new Request(
      'http://localhost:3000' +
        `/api/work-queue/${campaignId}/${prospectId}` +
        `/reservation/${reservationId}` +
        `?teamId=${teamId}`,
      {
        method: 'DELETE',
      },
    );

    const response = await DELETE(request, context);

    expect(authenticatedBackendJsonMock).toHaveBeenCalledTimes(2);

    expect(apiErrorResponseMock).toHaveBeenCalledWith(releaseError);

    expect(response.status).toBe(409);
  });

  it('URL-encodes the personal queue check and every release route segment', async () => {
    authenticatedBackendJsonMock.mockResolvedValueOnce(detailResponse).mockResolvedValueOnce({
      released: true,

      reservationId: 'reservation/id',
    });

    const encodedContext = {
      params: Promise.resolve({
        campaignId: 'campaign id',

        prospectId: 'prospect?id',

        reservationId: 'reservation/id',
      }),
    };

    const request = new Request(
      'http://localhost:3000/api/work-queue/example/example/reservation/example' +
        `?teamId=${teamId}`,
      {
        method: 'DELETE',
      },
    );

    await DELETE(request, encodedContext);

    expect(authenticatedBackendJsonMock).toHaveBeenNthCalledWith(
      1,
      '/work-queue/campaign%20id/prospect%3Fid' + `?teamId=${teamId}`,
    );

    expect(authenticatedBackendJsonMock).toHaveBeenNthCalledWith(
      2,
      '/campaigns/campaign%20id' + '/prospects/prospect%3Fid' + '/reservation/reservation%2Fid',
      {
        method: 'DELETE',
      },
    );
  });
});
