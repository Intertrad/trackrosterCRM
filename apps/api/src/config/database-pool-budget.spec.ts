import { describe, expect, it } from 'vitest';

import { validateAggregateDatabasePoolBudget } from './database-pool-budget.js';

describe('validateAggregateDatabasePoolBudget', () => {
  it('accepts the bounded default API and worker footprint', () => {
    expect(() => validateAggregateDatabasePoolBudget({})).not.toThrow();
  });

  it('rejects a combined pool size above the shared budget', () => {
    expect(() =>
      validateAggregateDatabasePoolBudget({
        API_DATABASE_POOL_MAX: '10',
        WORKER_DATABASE_POOL_MAX: '4',
      }),
    ).toThrow('Database pool budget exceeded');
  });

  it('accounts for replicas instead of validating each process independently', () => {
    expect(() =>
      validateAggregateDatabasePoolBudget({
        API_DATABASE_REPLICA_COUNT: '2',
        DATABASE_POOL_BUDGET: '19',
      }),
    ).toThrow('Database pool budget exceeded');
  });

  it('rejects invalid replica counts and budgets', () => {
    expect(() => validateAggregateDatabasePoolBudget({ API_DATABASE_REPLICA_COUNT: '0' })).toThrow(
      'API_DATABASE_REPLICA_COUNT',
    );
    expect(() => validateAggregateDatabasePoolBudget({ DATABASE_POOL_BUDGET: '0' })).toThrow(
      'DATABASE_POOL_BUDGET',
    );
  });
});
