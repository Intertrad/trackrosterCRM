export function parseCorsOrigins(value: string | undefined): string[] {
  if (value === undefined || value.trim() === '') return [];

  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.includes('*')) {
    throw new Error('API_CORS_ORIGINS must not contain a wildcard origin');
  }

  for (const origin of origins) {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`API_CORS_ORIGINS contains an invalid origin: ${origin}`);
    }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.pathname !== '/') {
      throw new Error(`API_CORS_ORIGINS contains an invalid origin: ${origin}`);
    }
  }

  return origins;
}

export function parseTrustProxy(value: string | undefined): boolean | string[] {
  if (value === undefined || value.trim() === '' || value === 'false') return false;
  if (value === 'true') return true;

  const proxies = value
    .split(',')
    .map((proxy) => proxy.trim())
    .filter(Boolean);
  if (proxies.length === 0) return false;
  return proxies;
}

export function securityHeaders(isProduction: boolean): Record<string, string> {
  return {
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    ...(isProduction ? { 'strict-transport-security': 'max-age=31536000; includeSubDomains' } : {}),
  };
}
