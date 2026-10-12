import { describe, expect, it } from 'vitest';

import { parseCorsOrigins, parseTrustProxy, securityHeaders } from './http-security.js';

describe('HTTP security configuration', () => {
  it('parses an explicit CORS origin list', () => {
    expect(parseCorsOrigins('https://trackroster.com, http://localhost:3000')).toEqual([
      'https://trackroster.com',
      'http://localhost:3000',
    ]);
  });

  it('rejects wildcard and malformed CORS origins', () => {
    expect(() => parseCorsOrigins('*')).toThrow('wildcard');
    expect(() => parseCorsOrigins('trackroster.com')).toThrow('invalid origin');
  });

  it('supports disabled, enabled, and explicit trusted proxies', () => {
    expect(parseTrustProxy(undefined)).toBe(false);
    expect(parseTrustProxy('true')).toBe(true);
    expect(parseTrustProxy('10.0.0.1, 10.0.0.2')).toEqual(['10.0.0.1', '10.0.0.2']);
  });

  it('returns baseline headers and adds HSTS only in production', () => {
    expect(securityHeaders(false)).not.toHaveProperty('strict-transport-security');
    expect(securityHeaders(true)).toMatchObject({
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'strict-transport-security': expect.stringContaining('max-age=31536000'),
    });
  });
});
