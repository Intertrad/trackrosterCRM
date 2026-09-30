import { randomUUID } from 'node:crypto';

import { Test, TestingModule } from '@nestjs/testing';
import { like } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DATABASE } from '../database/database.constants.js';
import * as schema from '../database/schema/index.js';
import { tenants } from '../database/schema/tenants.js';
import { TenantRepository } from './tenant.repository.js';
import { createIntegrationPool } from '../../test/support/integration-pool.js';

describe('TenantRepository integration', () => {
  let pool: Pool | undefined;
  let repository: TenantRepository;

  const testRunId = `integration-${randomUUID()}`;

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL is required for integration tests');
    }

    pool = createIntegrationPool(connectionString);

    const database = drizzle(pool, {
      schema,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantRepository,
        {
          provide: DATABASE,
          useValue: database,
        },
      ],
    }).compile();

    repository = module.get(TenantRepository);
  });

  afterAll(async () => {
    if (!pool) {
      return;
    }

    const database = drizzle(pool, {
      schema,
    });

    await database.delete(tenants).where(like(tenants.slug, `${testRunId}%`));

    await pool.end();
  });

  it('creates and retrieves a tenant by slug', async () => {
    const slug = `${testRunId}-create`;

    const created = await repository.create({
      name: 'Integration Tenant',
      slug,
      status: 'active',
    });

    expect(created.id).toBeDefined();
    expect(created.slug).toBe(slug);

    const found = await repository.findBySlug(slug);

    expect(found).not.toBeNull();
    expect(found?.id).toBe(created.id);
    expect(found?.name).toBe('Integration Tenant');
  });

  it('retrieves a tenant by id', async () => {
    const created = await repository.create({
      name: 'Find By ID Tenant',
      slug: `${testRunId}-find-id`,
      status: 'active',
    });

    const found = await repository.findById(created.id);

    expect(found).not.toBeNull();
    expect(found?.id).toBe(created.id);
  });

  it('enforces the unique tenant slug constraint', async () => {
    const slug = `${testRunId}-duplicate`;

    await repository.create({
      name: 'First Tenant',
      slug,
      status: 'active',
    });

    await expect(
      repository.create({
        name: 'Second Tenant',
        slug,
        status: 'active',
      }),
    ).rejects.toMatchObject({
      cause: {
        code: '23505',
        constraint: 'tenants_slug_unique',
      },
    });
  });
});
