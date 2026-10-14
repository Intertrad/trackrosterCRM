/* global clearInterval, console, setInterval */

import { createRequire } from 'node:module';
import process from 'node:process';

const require = createRequire(import.meta.url);
const { Pool } = require('../apps/api/node_modules/pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('Set DATABASE_URL to an isolated test database');

const poolMax = Number(process.env.POOL_MAX ?? 4);
const concurrency = Number(process.env.POOL_CONCURRENCY ?? 20);
const sleepMs = Number(process.env.POOL_SLEEP_MS ?? 100);
if (!Number.isInteger(poolMax) || poolMax < 1 || poolMax > 15) {
  throw new Error('POOL_MAX must be an integer between 1 and 15');
}
if (!Number.isInteger(concurrency) || concurrency < poolMax) {
  throw new Error('POOL_CONCURRENCY must be an integer at least POOL_MAX');
}

const pool = new Pool({
  connectionString,
  max: poolMax,
  connectionTimeoutMillis: 3_000,
  idleTimeoutMillis: 30_000,
});
let maxTotal = 0;
let maxWaiting = 0;
const sample = () => {
  maxTotal = Math.max(maxTotal, pool.totalCount);
  maxWaiting = Math.max(maxWaiting, pool.waitingCount);
};
const interval = setInterval(sample, 5);

try {
  await Promise.all(
    Array.from({ length: concurrency }, (_, index) =>
      pool.query('select pg_sleep($1::double precision), $2::integer', [sleepMs / 1000, index]),
    ),
  );
  sample();
  if (maxTotal > poolMax) {
    throw new Error(`Pool exceeded configured max: observed ${maxTotal}, max ${poolMax}`);
  }
  if (maxWaiting === 0) {
    throw new Error('Concurrency probe did not exercise the pool wait queue');
  }
  console.log(
    JSON.stringify({
      poolMax,
      concurrency,
      sleepMs,
      maxTotal,
      maxWaiting,
      sharedClientQueryWarning: false,
    }),
  );
} finally {
  clearInterval(interval);
  await pool.end();
}
