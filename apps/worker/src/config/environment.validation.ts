function requireString(config: Record<string, unknown>, key: string): string {
  const value = config[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Environment variable ${key} is required`);
  }

  return value;
}

function validateRedisUrl(config: Record<string, unknown>): void {
  const redisUrl = requireString(config, 'REDIS_URL');

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(redisUrl);
  } catch {
    throw new Error('Environment variable REDIS_URL must be a valid Redis URL');
  }

  if (parsedUrl.protocol !== 'redis:' && parsedUrl.protocol !== 'rediss:') {
    throw new Error('Environment variable REDIS_URL must use redis:// or rediss://');
  }
}

export function validateWorkerEnvironment(
  config: Record<string, unknown>,
): Record<string, unknown> {
  validateRedisUrl(config);

  const shutdownTimeout = config['WORKER_SHUTDOWN_TIMEOUT_MS'];

  if (shutdownTimeout !== undefined) {
    const parsed = Number(shutdownTimeout);

    if (!Number.isInteger(parsed) || parsed < 1_000) {
      throw new Error(
        'Environment variable WORKER_SHUTDOWN_TIMEOUT_MS must be an integer of at least 1000 milliseconds',
      );
    }
  }

  return config;
}
