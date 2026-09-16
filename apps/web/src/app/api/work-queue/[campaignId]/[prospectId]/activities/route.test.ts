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

import { POST } from './route';

describe('POST /api/work-queue/:campaignId/:prospectId/activities', () => {
  const campaignId = '11111111-1111-4111-8111-111111111111';

  const prospectId = '22222222-2222-4222-8222-222222222222';

  const teamId = '33333333-3333-4333-8333-333333333333';

  const activityId = '44444444-4444-4444-8444-444444444444';

  const idempotencyKey = 'activity-call-20260916-001';

  const detailPath = `/work-queue/${campaignId}/${prospectId}` + `?teamId=${teamId}`;

  const activityPath = `/campaigns/${campaignId}` + `/prospects/${prospectId}` + '/activities';

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

          message: 'Active reservation required',

          error: 'Conflict',
        },
        {
          status: 409,
        },
      ),
    );
  });

  it('checks the personal work queue before recording an activity', async () => {
    authenticatedBackendJsonMock.mockResolvedValueOnce(detailResponse).mockResolvedValueOnce({
      id: activityId,

      tenantId: 'internal-tenant',

      campaignId,

      campaignProspectId: prospectId,

      establishmentId: 'internal-establishment',

      assignmentId: 'internal-assignment',

      userId: 'internal-user',

      reservationId: 'internal-reservation',

      type: 'call',

      occurredAt: '2026-09-16T12:00:00.000Z',

      createdAt: '2026-09-16T12:00:00.100Z',
    });

    const request = new Request(
      'http://localhost:3000' +
        `/api/work-queue/${campaignId}/${prospectId}/activities` +
        `?teamId=${teamId}`,
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

    const response = await POST(request, context);

    expect(authenticatedBackendJsonMock).toHaveBeenCalledTimes(2);

    expect(authenticatedBackendJsonMock).toHaveBeenNthCalledWith(1, detailPath);

    expect(authenticatedBackendJsonMock).toHaveBeenNthCalledWith(2, activityPath, {
      method: 'POST',

      headers: {
        'idempotency-key': idempotencyKey,
      },

      body: JSON.stringify({
        type: 'call',
      }),
    });

    expect(response.status).toBe(201);
  });

  it('forwards the exact idempotency key unchanged', async () => {
    const exactKey = 'Case-Sensitive-Key_ABC-123';

    authenticatedBackendJsonMock.mockResolvedValueOnce(detailResponse).mockResolvedValueOnce({
      id: activityId,

      tenantId: 'internal-tenant',

      campaignId,

      campaignProspectId: prospectId,

      establishmentId: 'internal-establishment',

      assignmentId: 'internal-assignment',

      userId: 'internal-user',

      reservationId: 'internal-reservation',

      type: 'email',

      occurredAt: '2026-09-16T12:05:00.000Z',

      createdAt: '2026-09-16T12:05:00.100Z',
    });

    const request = new Request(
      'http://localhost:3000' +
        `/api/work-queue/${campaignId}/${prospectId}/activities` +
        `?teamId=${teamId}`,
      {
        method: 'POST',

        headers: {
          'content-type': 'application/json',

          'Idempotency-Key': exactKey,
        },

        body: JSON.stringify({
          type: 'email',
        }),
      },
    );

    await POST(request, context);

    expect(authenticatedBackendJsonMock).toHaveBeenNthCalledWith(2, activityPath, {
      method: 'POST',

      headers: {
        'idempotency-key': exactKey,
      },

      body: JSON.stringify({
        type: 'email',
      }),
    });
  });

  it('does not invent an idempotency key when the browser omits it', async () => {
    authenticatedBackendJsonMock.mockResolvedValueOnce(detailResponse).mockResolvedValueOnce({
      id: activityId,

      tenantId: 'internal-tenant',

      campaignId,

      campaignProspectId: prospectId,

      establishmentId: 'internal-establishment',

      assignmentId: 'internal-assignment',

      userId: 'internal-user',

      reservationId: 'internal-reservation',

      type: 'message',

      occurredAt: '2026-09-16T12:10:00.000Z',

      createdAt: '2026-09-16T12:10:00.100Z',
    });

    const request = new Request(
      'http://localhost:3000' +
        `/api/work-queue/${campaignId}/${prospectId}/activities` +
        `?teamId=${teamId}`,
      {
        method: 'POST',

        headers: {
          'content-type': 'application/json',
        },

        body: JSON.stringify({
          type: 'message',
        }),
      },
    );

    await POST(request, context);

    expect(authenticatedBackendJsonMock).toHaveBeenNthCalledWith(2, activityPath, {
      method: 'POST',

      headers: {},

      body: JSON.stringify({
        type: 'message',
      }),
    });
  });

  it('forwards only the activity type and strips browser-controlled identity fields', async () => {
    authenticatedBackendJsonMock.mockResolvedValueOnce(detailResponse).mockResolvedValueOnce({
      id: activityId,

      tenantId: 'internal-tenant',

      campaignId,

      campaignProspectId: prospectId,

      establishmentId: 'internal-establishment',

      assignmentId: 'internal-assignment',

      userId: 'internal-user',

      reservationId: 'internal-reservation',

      type: 'visit',

      occurredAt: '2026-09-16T12:15:00.000Z',

      createdAt: '2026-09-16T12:15:00.100Z',
    });

    const request = new Request(
      'http://localhost:3000' +
        `/api/work-queue/${campaignId}/${prospectId}/activities` +
        `?teamId=${teamId}` +
        '&tenantId=browser-tenant' +
        '&userId=browser-user' +
        '&role=client_admin',
      {
        method: 'POST',

        headers: {
          'content-type': 'application/json',

          'idempotency-key': idempotencyKey,
        },

        body: JSON.stringify({
          type: 'visit',

          tenantId: 'browser-tenant',

          userId: 'browser-user',

          assignmentId: 'browser-assignment',

          reservationId: 'browser-reservation',

          establishmentId: 'browser-establishment',

          role: 'client_admin',

          unexpected: 'value',
        }),
      },
    );

    await POST(request, context);

    expect(authenticatedBackendJsonMock).toHaveBeenNthCalledWith(1, detailPath);

    expect(authenticatedBackendJsonMock).toHaveBeenNthCalledWith(2, activityPath, {
      method: 'POST',

      headers: {
        'idempotency-key': idempotencyKey,
      },

      body: JSON.stringify({
        type: 'visit',
      }),
    });
  });

  it('sanitizes the recorded activity response', async () => {
    authenticatedBackendJsonMock.mockResolvedValueOnce(detailResponse).mockResolvedValueOnce({
      id: activityId,

      tenantId: 'internal-tenant',

      campaignId,

      campaignProspectId: prospectId,

      establishmentId: 'internal-establishment',

      assignmentId: 'internal-assignment',

      userId: 'internal-user',

      reservationId: 'internal-reservation',

      type: 'call',

      occurredAt: '2026-09-16T12:20:00.000Z',

      createdAt: '2026-09-16T12:20:00.100Z',
    });

    const request = new Request(
      'http://localhost:3000' +
        `/api/work-queue/${campaignId}/${prospectId}/activities` +
        `?teamId=${teamId}`,
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

    const response = await POST(request, context);

    const body = (await response.json()) as Record<string, unknown>;

    expect(body).toEqual({
      id: activityId,

      type: 'call',

      occurredAt: '2026-09-16T12:20:00.000Z',
    });

    expect(body).not.toHaveProperty('tenantId');
    expect(body).not.toHaveProperty('userId');
    expect(body).not.toHaveProperty('assignmentId');
    expect(body).not.toHaveProperty('reservationId');
    expect(body).not.toHaveProperty('establishmentId');
    expect(body).not.toHaveProperty('campaignId');
    expect(body).not.toHaveProperty('campaignProspectId');
    expect(body).not.toHaveProperty('createdAt');
  });

  it('does not record an activity when the personal queue session cannot be restored', async () => {
    authenticatedBackendJsonMock.mockResolvedValueOnce(null);

    const request = new Request(
      'http://localhost:3000' +
        `/api/work-queue/${campaignId}/${prospectId}/activities` +
        `?teamId=${teamId}`,
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

    const response = await POST(request, context);

    expect(authenticatedBackendJsonMock).toHaveBeenCalledTimes(1);

    expect(authenticatedBackendJsonMock).toHaveBeenCalledWith(detailPath);

    expect(unauthenticatedResponseMock).toHaveBeenCalledTimes(1);

    expect(apiErrorResponseMock).not.toHaveBeenCalled();

    expect(response.status).toBe(401);
  });

  it('delegates personal queue errors without attempting the mutation', async () => {
    const queueError = new Error('prospect unavailable');

    authenticatedBackendJsonMock.mockRejectedValueOnce(queueError);

    const request = new Request(
      'http://localhost:3000' +
        `/api/work-queue/${campaignId}/${prospectId}/activities` +
        `?teamId=${teamId}`,
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

    const response = await POST(request, context);

    expect(authenticatedBackendJsonMock).toHaveBeenCalledTimes(1);

    expect(apiErrorResponseMock).toHaveBeenCalledWith(queueError);

    expect(response.status).toBe(409);
  });

  it('delegates activity conflicts after the personal queue check', async () => {
    const activityError = new Error('active reservation required');

    authenticatedBackendJsonMock
      .mockResolvedValueOnce(detailResponse)
      .mockRejectedValueOnce(activityError);

    const request = new Request(
      'http://localhost:3000' +
        `/api/work-queue/${campaignId}/${prospectId}/activities` +
        `?teamId=${teamId}`,
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

    const response = await POST(request, context);

    expect(authenticatedBackendJsonMock).toHaveBeenCalledTimes(2);

    expect(apiErrorResponseMock).toHaveBeenCalledWith(activityError);

    expect(response.status).toBe(409);
  });

  it('URL-encodes the personal queue and activity route segments', async () => {
    authenticatedBackendJsonMock.mockResolvedValueOnce(detailResponse).mockResolvedValueOnce({
      id: activityId,

      tenantId: 'internal-tenant',

      campaignId: 'campaign id',

      campaignProspectId: 'prospect?id',

      establishmentId: 'internal-establishment',

      assignmentId: 'internal-assignment',

      userId: 'internal-user',

      reservationId: 'internal-reservation',

      type: 'call',

      occurredAt: '2026-09-16T12:25:00.000Z',

      createdAt: '2026-09-16T12:25:00.100Z',
    });

    const encodedContext = {
      params: Promise.resolve({
        campaignId: 'campaign id',

        prospectId: 'prospect?id',
      }),
    };

    const request = new Request(
      'http://localhost:3000/api/work-queue/example/example/activities' + `?teamId=${teamId}`,
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

    await POST(request, encodedContext);

    expect(authenticatedBackendJsonMock).toHaveBeenNthCalledWith(
      1,
      '/work-queue/campaign%20id/prospect%3Fid' + `?teamId=${teamId}`,
    );

    expect(authenticatedBackendJsonMock).toHaveBeenNthCalledWith(
      2,
      '/campaigns/campaign%20id' + '/prospects/prospect%3Fid' + '/activities',
      {
        method: 'POST',

        headers: {
          'idempotency-key': idempotencyKey,
        },

        body: JSON.stringify({
          type: 'call',
        }),
      },
    );
  });
});
