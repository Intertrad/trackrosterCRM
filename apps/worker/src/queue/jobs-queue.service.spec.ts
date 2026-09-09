import { describe, expect, it } from 'vitest';

import { createQueueConnection, createWorkerConnection } from './queue-connection.js';

describe('BullMQ Redis connection configuration', () => {
  it('creates a lazy queue connection with bounded request retries', () => {
    const connection = createQueueConnection('redis://127.0.0.1:6379');

    try {
      expect(connection.options.lazyConnect).toBe(true);

      expect(connection.options.maxRetriesPerRequest).toBe(3);

      expect(connection.status).toBe('wait');
    } finally {
      connection.disconnect();
    }
  });

  it('creates a BullMQ worker connection with unlimited blocking-request retries', () => {
    const connection = createWorkerConnection('redis://127.0.0.1:6379');

    try {
      expect(connection.options.lazyConnect).toBe(true);

      expect(connection.options.maxRetriesPerRequest).toBeNull();

      expect(connection.status).toBe('wait');
    } finally {
      connection.disconnect();
    }
  });
});
