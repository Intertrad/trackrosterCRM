import { describe, expect, it } from 'vitest';

import { validateEnvironment } from './environment.validation.js';

describe('validateEnvironment', () => {
  const validEnvironment = {
    DATABASE_URL: 'postgresql://user:password@localhost:5432/database',

    JWT_ACCESS_SECRET: 'a'.repeat(48),

    JWT_REFRESH_SECRET: 'b'.repeat(48),

    JWT_ACCESS_TTL: '15m',

    JWT_REFRESH_TTL: '7d',
  };

  it('accepts valid authentication configuration', () => {
    expect(
      validateEnvironment({
        ...validEnvironment,
      }),
    ).toEqual(validEnvironment);
  });

  it('rejects a missing access secret', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        JWT_ACCESS_SECRET: '',
      }),
    ).toThrow('JWT_ACCESS_SECRET');
  });

  it('rejects JWT secrets that are too short', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        JWT_REFRESH_SECRET: 'short',
      }),
    ).toThrow('JWT_REFRESH_SECRET');
  });

  it('rejects an invalid access token TTL', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        JWT_ACCESS_TTL: 'fifteen-minutes',
      }),
    ).toThrow('JWT_ACCESS_TTL');
  });

  it('rejects a missing database URL', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        DATABASE_URL: '',
      }),
    ).toThrow('DATABASE_URL');
  });
});
