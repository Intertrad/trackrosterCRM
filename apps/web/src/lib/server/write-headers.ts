/*
 * Conditional-write plumbing for the BFF.
 *
 * Idempotency-Key and If-Match are minted in the browser and re-checked
 * upstream under a row lock. The proxy must forward both verbatim: rewriting
 * either one would fork the concurrency algorithm and silently weaken the
 * protection the API believes it has.
 */
export function writeHeaders(request: Request): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };

  const idempotencyKey = request.headers.get('idempotency-key');

  if (idempotencyKey) {
    headers['idempotency-key'] = idempotencyKey;
  }

  const ifMatch = request.headers.get('if-match');

  if (ifMatch) {
    headers['if-match'] = ifMatch;
  }

  return headers;
}

/** Copies an allow-listed subset of the incoming query string. */
export function forwardQuery(request: Request, allowed: readonly string[]): string {
  const incoming = new URL(request.url).searchParams;
  const query = new URLSearchParams();

  for (const key of allowed) {
    const value = incoming.get(key);

    if (value !== null) {
      query.set(key, value);
    }
  }

  return query.toString();
}
