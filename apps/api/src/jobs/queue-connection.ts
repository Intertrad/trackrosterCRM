import { Redis } from 'ioredis';

/*
 * BullMQ gets its own ioredis connection.
 *
 * Do not reuse RedisService here. RedisService
 * remains dedicated to reservation/collision
 * infrastructure using node-redis.
 */
export function createJobQueueConnection(redisUrl: string): Redis {
  return new Redis(redisUrl, {
    lazyConnect: true,

    /*
     * API queue producers execute bounded Redis
     * commands rather than blocking worker reads.
     */
    maxRetriesPerRequest: 3,

    enableReadyCheck: true,
  });
}
