import type { NotificationPreferences } from '@/lib/api/notification-preference-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const preferences = await authenticatedBackendJson<NotificationPreferences>(
      '/notification-preferences',
    );

    if (!preferences) {
      return unauthenticatedResponse();
    }

    return Response.json(preferences, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    const preferences = await authenticatedBackendJson<NotificationPreferences>(
      '/notification-preferences',
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: await request.text(),
      },
    );

    if (!preferences) {
      return unauthenticatedResponse();
    }

    return Response.json(preferences, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
