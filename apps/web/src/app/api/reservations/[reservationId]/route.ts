import type { Reservation } from '@/lib/api/reservation-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ reservationId: string }> },
): Promise<Response> {
  try {
    const { reservationId } = await context.params;

    const reservation = await authenticatedBackendJson<Reservation>(
      `/reservations/${encodeURIComponent(reservationId)}`,
    );

    if (!reservation) {
      return unauthenticatedResponse();
    }

    return Response.json(reservation, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
