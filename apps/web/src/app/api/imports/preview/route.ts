import type { ImportPreviewResult } from '@/lib/api/import-types';

import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';

import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

import { getImportMultipartRequestOptions, toBrowserImportPreview } from '@/lib/server/import-bff';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.arrayBuffer();

    const result = await authenticatedBackendJson<ImportPreviewResult>(
      '/imports/preview',
      getImportMultipartRequestOptions(request, body),
    );

    if (!result) {
      return unauthenticatedResponse();
    }

    return Response.json(toBrowserImportPreview(result));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
