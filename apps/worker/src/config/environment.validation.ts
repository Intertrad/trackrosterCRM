function requireString(config: Record<string, unknown>, key: string): string {
  const value = config[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Environment variable ${key} is required`);
  }

  return value;
}

function validateAggregateDatabasePoolBudget(config: Record<string, unknown>): void {
  const apiPoolMax = readBoundedInteger(config, 'API_DATABASE_POOL_MAX', 8, 1, 15);
  const workerPoolMax = readBoundedInteger(config, 'WORKER_DATABASE_POOL_MAX', 4, 1, 15);
  const apiReplicas = readBoundedInteger(config, 'API_DATABASE_REPLICA_COUNT', 1, 1, 100);
  const workerReplicas = readBoundedInteger(config, 'WORKER_DATABASE_REPLICA_COUNT', 1, 1, 100);
  const budget = readBoundedInteger(config, 'DATABASE_POOL_BUDGET', 12, 1, 1_000);
  const estimatedConnections = apiPoolMax * apiReplicas + workerPoolMax * workerReplicas;

  if (estimatedConnections > budget) {
    throw new Error(
      `Database pool budget exceeded: API (${apiPoolMax} x ${apiReplicas}) + ` +
        `worker (${workerPoolMax} x ${workerReplicas}) = ${estimatedConnections}, ` +
        `budget is ${budget}`,
    );
  }
}

function readBoundedInteger(
  config: Record<string, unknown>,
  key: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (config[key] === undefined) return fallback;
  const value = Number(config[key]);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `Environment variable ${key} must be an integer between ${minimum} and ${maximum}`,
    );
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

function validateOptionalBoundedInteger(
  config: Record<string, unknown>,
  key: string,
  minimum: number,
  maximum: number,
): void {
  if (config[key] === undefined) return;
  const value = Number(config[key]);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `Environment variable ${key} must be an integer between ${minimum} and ${maximum}`,
    );
  }
}

export function validateWorkerEnvironment(
  config: Record<string, unknown>,
): Record<string, unknown> {
  validateRedisUrl(config);
  validateOptionalBoundedInteger(config, 'WORKER_DATABASE_POOL_MAX', 1, 15);
  validateOptionalBoundedInteger(config, 'DATABASE_CONNECTION_TIMEOUT_MS', 250, 30_000);
  validateOptionalBoundedInteger(config, 'DATABASE_IDLE_TIMEOUT_MS', 1_000, 300_000);
  validateAggregateDatabasePoolBudget(config);

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
