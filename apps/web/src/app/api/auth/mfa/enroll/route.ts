import type { MfaEnrollment } from '@/lib/api/auth-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

/*
 * Starting enrolment re-proves the password and hands back a TOTP secret. The
 * secret must never be cached: it is single-use and short-lived, and the
 * challenge it belongs to expires in five minutes.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const enrollment = await authenticatedBackendJson<MfaEnrollment>('/auth/mfa/enroll', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: await request.text(),
    });

    if (!enrollment) {
      return unauthenticatedResponse();
    }

    return Response.json(enrollment, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
