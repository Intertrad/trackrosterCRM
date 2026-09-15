import { NextResponse } from 'next/server';

import { backendFetch } from '@/lib/server/backend-fetch';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const response = await backendFetch('/health');

    const body = await response.text();

    return new Response(body, {
      status: response.status,

      headers: {
        'content-type': response.headers.get('content-type') ?? 'application/json; charset=utf-8',
      },
    });
  } catch {
    return NextResponse.json(
      {
        status: 'unavailable',
        message: 'Backend service is unavailable',
      },
      {
        status: 503,
      },
    );
  }
}
