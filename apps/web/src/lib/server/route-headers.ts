export function forwardedHeaders(request: Request): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };

  for (const header of ['idempotency-key', 'if-match']) {
    const value = request.headers.get(header);

    if (value) {
      headers[header] = value;
    }
  }

  return headers;
}

export function forwardedWriteHeaders(request: Request): HeadersInit {
  const headers: Record<string, string> = { 'content-type': 'application/json' };

  const ifMatch = request.headers.get('if-match');

  if (ifMatch) {
    headers['if-match'] = ifMatch;
  }

  const idempotencyKey = request.headers.get('idempotency-key');

  if (idempotencyKey) {
    headers['idempotency-key'] = idempotencyKey;
  }

  return headers;
}

export function routeWriteHeaders(request: Request): Record<string, string> {
  return forwardedHeaders(request);
}

export function campaignHeaders(etag: string | null): Record<string, string> {
  return resourceHeaders(etag);
}

export function membershipHeaders(etag: string | null): Record<string, string> {
  return resourceHeaders(etag);
}

export function teamHeaders(etag: string | null): Record<string, string> {
  return resourceHeaders(etag);
}

function resourceHeaders(etag: string | null): Record<string, string> {
  const headers: Record<string, string> = { 'cache-control': 'no-store' };

  if (etag) {
    headers.etag = etag;
  }

  return headers;
}
