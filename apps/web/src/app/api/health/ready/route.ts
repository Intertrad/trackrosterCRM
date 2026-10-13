import { NextResponse } from 'next/server';

import { backendFetch } from '@/lib/server/backend-fetch';

export const dynamic = 'force-dynamic';

/**
 * Public readiness proxy for deployment monitors. The API response is already
 * redacted to dependency status and aggregate counts; no session is required.
 */
export async function GET(): Promise<Response> {
  try {
    const response = await backendFetch('/health/ready');
    const body = await response.text();

    return new Response(body, {
      status: response.status,
      headers: {
        'content-type': response.headers.get('content-type') ?? 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json(
      { status: 'unavailable', message: 'Backend readiness is unavailable' },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }
}
