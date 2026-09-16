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

import { GET } from './route';

describe('GET /api/work-queue/:campaignId/:prospectId', () => {
  const campaignId = '11111111-1111-4111-8111-111111111111';

  const prospectId = '22222222-2222-4222-8222-222222222222';

  const teamId = '33333333-3333-4333-8333-333333333333';

  const responseBody: WorkQueueProspectDetail = {
    campaignProspectId: prospectId,

    campaign: {
      id: campaignId,
      name: 'Paris Expansion',
    },

    assignment: {
      id: '44444444-4444-4444-8444-444444444444',

      organizationId: '55555555-5555-4555-8555-555555555555',

      teamId,

      assignedAt: '2026-09-16T08:00:00.000Z',
    },

    establishment: {
      id: '66666666-6666-4666-8666-666666666666',

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

    authenticatedBackendJsonMock.mockResolvedValue(responseBody);

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
          statusCode: 403,

          code: 'FORBIDDEN',

          message: 'User does not have access to this prospector workspace',

          error: 'Forbidden',
        },
        {
          status: 403,
        },
      ),
    );
  });

  it('forwards the prospect detail request with only teamId', async () => {
    const request = new Request(
      'http://localhost:3000' +
        `/api/work-queue/${campaignId}/${prospectId}` +
        `?teamId=${teamId}` +
        '&tenantId=malicious-tenant' +
        '&userId=malicious-user' +
        '&assignedUserId=malicious-assignee' +
        '&organizationId=malicious-org' +
        '&role=client_admin' +
        '&scopeType=tenant' +
        '&unexpected=value',
    );

    const response = await GET(request, context);

    expect(authenticatedBackendJsonMock).toHaveBeenCalledTimes(1);

    expect(authenticatedBackendJsonMock).toHaveBeenCalledWith(
      `/work-queue/${campaignId}/${prospectId}` + `?teamId=${teamId}`,
    );

    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toEqual(responseBody);
  });

  it('does not forward browser-controlled identity or authorization fields', async () => {
    const request = new Request(
      'http://localhost:3000' +
        `/api/work-queue/${campaignId}/${prospectId}` +
        `?teamId=${teamId}` +
        '&tenantId=another-tenant' +
        '&userId=another-user' +
        '&role=manager' +
        '&scopeType=tenant',
    );

    await GET(request, context);

    expect(authenticatedBackendJsonMock).toHaveBeenCalledWith(
      `/work-queue/${campaignId}/${prospectId}` + `?teamId=${teamId}`,
    );
  });

  it('forwards the base detail path when teamId is missing so Nest performs validation', async () => {
    const request = new Request(
      'http://localhost:3000' + `/api/work-queue/${campaignId}/${prospectId}`,
    );

    await GET(request, context);

    expect(authenticatedBackendJsonMock).toHaveBeenCalledWith(
      `/work-queue/${campaignId}/${prospectId}`,
    );
  });

  it('returns the standard unauthenticated response when the session cannot be restored', async () => {
    authenticatedBackendJsonMock.mockResolvedValue(null);

    const request = new Request(
      'http://localhost:3000' + `/api/work-queue/${campaignId}/${prospectId}` + `?teamId=${teamId}`,
    );

    const response = await GET(request, context);

    expect(unauthenticatedResponseMock).toHaveBeenCalledTimes(1);

    expect(apiErrorResponseMock).not.toHaveBeenCalled();

    expect(response.status).toBe(401);

    await expect(response.json()).resolves.toMatchObject({
      statusCode: 401,

      code: 'UNAUTHORIZED',
    });
  });

  it('delegates backend errors to the shared API error response', async () => {
    const backendError = new Error('prospect detail forbidden');

    authenticatedBackendJsonMock.mockRejectedValue(backendError);

    const request = new Request(
      'http://localhost:3000' + `/api/work-queue/${campaignId}/${prospectId}` + `?teamId=${teamId}`,
    );

    const response = await GET(request, context);

    expect(apiErrorResponseMock).toHaveBeenCalledWith(backendError);

    expect(response.status).toBe(403);
  });
});
