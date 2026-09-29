import type { PushDevice } from '@/lib/api/notification-preference-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { writeHeaders } from '@/lib/server/write-headers';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  try {
    const device = await authenticatedBackendJson<PushDevice>('/devices', {
      method: 'POST',
      headers: writeHeaders(request),
      body: await request.text(),
    });

    if (!device) {
      return unauthenticatedResponse();
    }

    return Response.json(device, { status: 201, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
