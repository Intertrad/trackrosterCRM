import { Redis } from 'ioredis';

export function createQueueConnection(redisUrl: string): Redis {
  return new Redis(redisUrl, {
    lazyConnect: true,

    maxRetriesPerRequest: 3,

    enableReadyCheck: true,
  });
}

export function createWorkerConnection(redisUrl: string): Redis {
  return new Redis(redisUrl, {
    lazyConnect: true,

    /*
     * Required for BullMQ Worker blocking
     * connections.
     */
    maxRetriesPerRequest: null,

    enableReadyCheck: true,
  });
}
