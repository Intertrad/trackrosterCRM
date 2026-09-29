import { afterAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { WorkerArtifactStorageService } from '../src/providers/worker-artifact-storage.service.js';
import { WorkerMailService } from '../src/providers/worker-mail.service.js';

const database = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;
const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;

describe.skipIf(!database)('PostgreSQL integration', () => {
  afterAll(async () => {
    await database?.end();
  });
  it('connects and exposes the worker tables', async () => {
    const result = await database!.query(
      "SELECT to_regclass('public.scheduled_report_deliveries') AS table_name",
    );
    expect(result.rows[0].table_name).toBe('scheduled_report_deliveries');
  });
});

describe.skipIf(!redis)('Redis integration', () => {
  afterAll(async () => {
    await redis?.quit();
  });
  it('round-trips an isolated worker probe key', async () => {
    const key = `trackroster:integration:${Date.now()}`;
    await redis!.set(key, 'ok', 'EX', 30);
    expect(await redis!.get(key)).toBe('ok');
    await redis!.del(key);
  });
});

const config = new ConfigService(process.env as Record<string, unknown>);
describe.skipIf(process.env.R2_INTEGRATION !== '1')('R2 integration', () => {
  it('uploads an artifact through the signed S3 client', async () => {
    const storage = new WorkerArtifactStorageService(config);
    expect(storage.configured()).toBe(true);
    const result = await storage.put(
      `integration/${Date.now()}.txt`,
      'trackroster-r2-probe',
      'text/plain',
    );
    expect(result.uploaded).toBe(true);
  });
});

describe.skipIf(process.env.BREVO_INTEGRATION !== '1')('Brevo integration', () => {
  it('accepts a provider delivery response', async () => {
    const mail = new WorkerMailService(config);
    const result = await mail.sendReport(
      [process.env.BREVO_TEST_RECIPIENT!],
      'TrackRoster integration probe',
      'probe.txt',
      'probe',
    );
    expect(result.sent).toBe(true);
  });
});
