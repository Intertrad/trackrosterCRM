import type { ImportExecutionResult } from '@/lib/api/import-types';

import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';

import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

import {
  getImportMultipartRequestOptions,
  toBrowserImportExecution,
} from '@/lib/server/import-bff';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.arrayBuffer();

    const result = await authenticatedBackendJson<ImportExecutionResult>(
      '/imports/execute',
      getImportMultipartRequestOptions(request, body),
    );

    if (!result) {
      return unauthenticatedResponse();
    }

    return Response.json(toBrowserImportExecution(result));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
