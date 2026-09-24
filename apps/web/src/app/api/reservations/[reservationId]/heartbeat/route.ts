import type { Reservation } from '@/lib/api/reservation-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { writeHeaders } from '@/lib/server/write-headers';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  context: { params: Promise<{ reservationId: string }> },
): Promise<Response> {
  try {
    const { reservationId } = await context.params;

    const reservation = await authenticatedBackendJson<Reservation>(
      `/reservations/${encodeURIComponent(reservationId)}/heartbeat`,
      { method: 'POST', headers: writeHeaders(request), body: await request.text() },
    );

    if (!reservation) {
      return unauthenticatedResponse();
    }

    return Response.json(reservation, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
