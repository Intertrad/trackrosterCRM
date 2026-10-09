import { describe, expect, it } from 'vitest';

import { validateWorkerEnvironment } from './environment.validation.js';

describe('validateWorkerEnvironment', () => {
  it('accepts a redis URL', () => {
    const config = {
      REDIS_URL: 'redis://127.0.0.1:6379',
    };

    expect(validateWorkerEnvironment(config)).toBe(config);
  });

  it('accepts a secure redis URL', () => {
    expect(() =>
      validateWorkerEnvironment({
        REDIS_URL: 'rediss://redis.example.com:6379',
      }),
    ).not.toThrow();
  });

  it('accepts bounded database pool settings', () => {
    expect(() =>
      validateWorkerEnvironment({
        REDIS_URL: 'redis://127.0.0.1:6379',
        WORKER_DATABASE_POOL_MAX: '4',
        DATABASE_CONNECTION_TIMEOUT_MS: '3000',
        DATABASE_IDLE_TIMEOUT_MS: '30000',
      }),
    ).not.toThrow();
  });

  it('rejects an oversized worker pool', () => {
    expect(() =>
      validateWorkerEnvironment({
        REDIS_URL: 'redis://127.0.0.1:6379',
        WORKER_DATABASE_POOL_MAX: '16',
      }),
    ).toThrow('WORKER_DATABASE_POOL_MAX');
  });

  it('rejects a missing redis URL', () => {
    expect(() => validateWorkerEnvironment({})).toThrow('REDIS_URL');
  });

  it('rejects an empty redis URL', () => {
    expect(() =>
      validateWorkerEnvironment({
        REDIS_URL: '',
      }),
    ).toThrow('REDIS_URL');
  });

  it('rejects an invalid redis URL', () => {
    expect(() =>
      validateWorkerEnvironment({
        REDIS_URL: 'not-a-url',
      }),
    ).toThrow('valid Redis URL');
  });

  it('rejects an unsupported redis protocol', () => {
    expect(() =>
      validateWorkerEnvironment({
        REDIS_URL: 'http://127.0.0.1:6379',
      }),
    ).toThrow('redis:// or rediss://');
  });

  it('accepts a valid worker shutdown timeout', () => {
    expect(() =>
      validateWorkerEnvironment({
        REDIS_URL: 'redis://127.0.0.1:6379',

        WORKER_SHUTDOWN_TIMEOUT_MS: '45000',
      }),
    ).not.toThrow();
  });

  it('rejects an invalid worker shutdown timeout', () => {
    expect(() =>
      validateWorkerEnvironment({
        REDIS_URL: 'redis://127.0.0.1:6379',

        WORKER_SHUTDOWN_TIMEOUT_MS: 'abc',
      }),
    ).toThrow('WORKER_SHUTDOWN_TIMEOUT_MS');
  });

  it('rejects an unreasonably small worker shutdown timeout', () => {
    expect(() =>
      validateWorkerEnvironment({
        REDIS_URL: 'redis://127.0.0.1:6379',

        WORKER_SHUTDOWN_TIMEOUT_MS: '500',
      }),
    ).toThrow('WORKER_SHUTDOWN_TIMEOUT_MS');
  });
});
