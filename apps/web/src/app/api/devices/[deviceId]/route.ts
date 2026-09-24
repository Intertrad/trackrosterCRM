import { apiErrorResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { writeHeaders } from '@/lib/server/write-headers';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: Request,
  context: { params: Promise<{ deviceId: string }> },
): Promise<Response> {
  try {
    const { deviceId } = await context.params;

    await authenticatedBackendJson<undefined>(`/devices/${encodeURIComponent(deviceId)}`, {
      method: 'DELETE',
      headers: writeHeaders(request),
    });

    return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
