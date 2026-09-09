import { describe, expect, it } from 'vitest';

import { createJobQueueConnection } from './queue-connection.js';

describe('API BullMQ Redis connection', () => {
  it('uses a lazy connection with bounded retries', () => {
    const connection = createJobQueueConnection('redis://127.0.0.1:6379');

    try {
      expect(connection.options.lazyConnect).toBe(true);

      expect(connection.options.maxRetriesPerRequest).toBe(3);

      expect(connection.status).toBe('wait');
    } finally {
      connection.disconnect();
    }
  });
});
