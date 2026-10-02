import { describe, expect, it } from 'vitest';

import { validateEnvironment } from './environment.validation';

describe('validateEnvironment', () => {
  const validConfig: Record<string, unknown> = {
    PROSPECT_COOLING_OFF_MINUTES: '1440',
    DATABASE_URL: 'postgresql://trackroster:trackroster@127.0.0.1:5433/trackroster',

    REDIS_URL: 'redis://127.0.0.1:6379',

    JWT_ACCESS_SECRET: 'test-access-secret-that-is-at-least-32-characters-long',

    JWT_ACCESS_TTL: '15m',

    JWT_REFRESH_SECRET: 'test-refresh-secret-that-is-at-least-32-characters-long',

    JWT_REFRESH_TTL: '7d',
  };

  it('accepts valid authentication configuration', () => {
    expect(() =>
      validateEnvironment({
        ...validConfig,
      }),
    ).not.toThrow();
  });

  it('accepts enforced tenant RLS configuration', () => {
    expect(() =>
      validateEnvironment({
        ...validConfig,
        TENANT_RLS_MODE: 'enforce',
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

  it('rejects Redis URLs using unsupported protocols', () => {
    expect(() =>
      validateEnvironment({
        ...validConfig,
        REDIS_URL: 'http://127.0.0.1:6379',
      }),
    ).toThrow('REDIS_URL');
  });

  it('rejects a missing cooling-off duration', () => {
    const config = {
      ...validConfig,
    };

    delete config.PROSPECT_COOLING_OFF_MINUTES;

    expect(() => validateEnvironment(config)).toThrow(
      'Environment variable PROSPECT_COOLING_OFF_MINUTES is required',
    );
  });

  it('rejects a non-positive cooling-off duration', () => {
    expect(() =>
      validateEnvironment({
        ...validConfig,

        PROSPECT_COOLING_OFF_MINUTES: '0',
      }),
    ).toThrow('Environment variable PROSPECT_COOLING_OFF_MINUTES must be a positive integer');
  });

  it('rejects a non-integer cooling-off duration', () => {
    expect(() =>
      validateEnvironment({
        ...validConfig,

        PROSPECT_COOLING_OFF_MINUTES: '10.5',
      }),
    ).toThrow('Environment variable PROSPECT_COOLING_OFF_MINUTES must be a positive integer');
  });

  it('rejects a missing cooling-off duration', () => {
    const config: Record<string, unknown> = {
      ...validConfig,
    };

    delete config.PROSPECT_COOLING_OFF_MINUTES;

    expect(() => validateEnvironment(config)).toThrow(
      'Environment variable PROSPECT_COOLING_OFF_MINUTES is required',
    );
  });

  it('rejects a non-positive cooling-off duration', () => {
    expect(() =>
      validateEnvironment({
        ...validConfig,

        PROSPECT_COOLING_OFF_MINUTES: '0',
      }),
    ).toThrow('Environment variable PROSPECT_COOLING_OFF_MINUTES must be a positive integer');
  });

  it('rejects a non-integer cooling-off duration', () => {
    expect(() =>
      validateEnvironment({
        ...validConfig,

        PROSPECT_COOLING_OFF_MINUTES: '10.5',
      }),
    ).toThrow('Environment variable PROSPECT_COOLING_OFF_MINUTES must be a positive integer');
  });
});
