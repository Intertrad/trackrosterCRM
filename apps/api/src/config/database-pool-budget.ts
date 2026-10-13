type PoolConfig = Record<string, unknown>;

const DEFAULT_API_POOL_MAX = 8;
const DEFAULT_WORKER_POOL_MAX = 4;
const DEFAULT_POOL_BUDGET = 12;
const DEFAULT_REPLICA_COUNT = 1;

function readBoundedInteger(
  config: PoolConfig,
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

export function validateAggregateDatabasePoolBudget(config: PoolConfig): void {
  const apiPoolMax = readBoundedInteger(
    config,
    'API_DATABASE_POOL_MAX',
    DEFAULT_API_POOL_MAX,
    1,
    15,
  );
  const workerPoolMax = readBoundedInteger(
    config,
    'WORKER_DATABASE_POOL_MAX',
    DEFAULT_WORKER_POOL_MAX,
    1,
    15,
  );
  const apiReplicas = readBoundedInteger(
    config,
    'API_DATABASE_REPLICA_COUNT',
    DEFAULT_REPLICA_COUNT,
    1,
    100,
  );
  const workerReplicas = readBoundedInteger(
    config,
    'WORKER_DATABASE_REPLICA_COUNT',
    DEFAULT_REPLICA_COUNT,
    1,
    100,
  );
  const budget = readBoundedInteger(config, 'DATABASE_POOL_BUDGET', DEFAULT_POOL_BUDGET, 1, 1_000);
  const estimatedConnections = apiPoolMax * apiReplicas + workerPoolMax * workerReplicas;

  if (estimatedConnections > budget) {
    throw new Error(
      `Database pool budget exceeded: API (${apiPoolMax} x ${apiReplicas}) + ` +
        `worker (${workerPoolMax} x ${workerReplicas}) = ${estimatedConnections}, ` +
        `budget is ${budget}`,
    );
  }
}
