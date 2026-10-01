import type { NotificationPage } from '@/lib/api/notification-types';
import type { NotificationItem } from '@/lib/api/notification-types';
import { ApiError } from '@/lib/api/api-error';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

const ALLOWED = ['severity', 'readState', 'cursor', 'limit'] as const;

export async function GET(request: Request): Promise<Response> {
  try {
    const requestUrl = new URL(request.url);
    const query = new URLSearchParams();

    for (const key of ALLOWED) {
      const value = requestUrl.searchParams.get(key);

      if (value !== null) {
        query.set(key, value);
      }
    }

    const search = query.toString();

    /* Prefer the cursor-aware contract, but keep older API deployments usable
     * while they roll forward. The neutral endpoint returns a bare array. */
    let page: NotificationPage | NotificationItem[] | null;

    try {
      page = await authenticatedBackendJson<NotificationPage>(
        search ? `/api/v1/notifications?${search}` : '/api/v1/notifications',
      );
    } catch (error) {
      if (!(error instanceof ApiError) || error.statusCode !== 404) {
        throw error;
      }

      page = await authenticatedBackendJson<NotificationPage | NotificationItem[]>(
        search ? `/notifications?${search}` : '/notifications',
      );
    }

    if (!page) {
      return unauthenticatedResponse();
    }

    return Response.json(Array.isArray(page) ? { items: page, nextCursor: null } : page, {
      headers: { 'cache-control': 'no-store' },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
