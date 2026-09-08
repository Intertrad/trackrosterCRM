import { describe, expect, it } from 'vitest';

import { validateEnvironment } from '../../api/src/config/environment.validation';

describe('validateEnvironment', () => {
  const validConfig: Record<string, unknown> = {
    DATABASE_URL: 'postgresql://trackroster:trackroster@127.0.0.1:5433/trackroster',

    REDIS_URL: 'redis://127.0.0.1:6379',

    JWT_ACCESS_SECRET: 'test-access-secret-that-is-at-least-32-characters-long',

    JWT_ACCESS_TTL: '15m',

    JWT_REFRESH_SECRET: 'test-refresh-secret-that-is-at-least-32-characters-long',

    JWT_REFRESH_TTL: '7d',
    PROSPECT_COOLING_OFF_MINUTES: '1440',
  };

  it('accepts valid authentication configuration', () => {
    expect(() =>
      validateEnvironment({
        ...validConfig,
      }),
    ).not.toThrow();
  });

  it('rejects a missing access secret', () => {
    expect(() =>
      validateEnvironment({
        ...validConfig,

        JWT_ACCESS_SECRET: '',
      }),
    ).toThrow('JWT_ACCESS_SECRET');
  });

  it('rejects JWT secrets that are too short', () => {
    expect(() =>
      validateEnvironment({
        ...validConfig,

        JWT_REFRESH_SECRET: 'short',
      }),
    ).toThrow('JWT_REFRESH_SECRET');
  });

  it('rejects an invalid access token TTL', () => {
    expect(() =>
      validateEnvironment({
        ...validConfig,

        JWT_ACCESS_TTL: 'fifteen-minutes',
      }),
    ).toThrow('JWT_ACCESS_TTL');
  });

  it('rejects a missing database URL', () => {
    expect(() =>
      validateEnvironment({
        ...validConfig,

        DATABASE_URL: '',
      }),
    ).toThrow('DATABASE_URL');
  });

  it('rejects a missing Redis URL', () => {
    expect(() =>
      validateEnvironment({
        ...validConfig,

        REDIS_URL: '',
      }),
    ).toThrow('REDIS_URL');
  });

  it('rejects an invalid Redis URL', () => {
    expect(() =>
      validateEnvironment({
        ...validConfig,

        REDIS_URL: 'not-a-url',
      }),
    ).toThrow('REDIS_URL');
  });

  it('rejects a Redis URL using an unsupported protocol', () => {
    expect(() =>
      validateEnvironment({
        ...validConfig,

        REDIS_URL: 'http://127.0.0.1:6379',
      }),
    ).toThrow('REDIS_URL');
  });
});
