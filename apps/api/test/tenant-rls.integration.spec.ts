import { describe, expect, it } from 'vitest';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module.js';
import { DATABASE } from '../src/database/database.constants.js';
import type { Database } from '../src/database/database.types.js';
import { withTenantContext } from '../src/database/tenant-context.js';
import { randomUUID } from 'node:crypto';
import { organizations } from '../src/database/schema/organizations.js';
import { tenants } from '../src/database/schema/tenants.js';
import { eq } from 'drizzle-orm';

const tenantId = '11111111-1111-4111-8111-111111111111';

describe.skipIf(!process.env.DATABASE_URL)('Tenant transaction integration', () => {
  it('sets transaction-local tenant context and restores it after commit', async () => {
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: false,
      abortOnError: false,
    });
    try {
      const db = app.get<Database>(DATABASE);
      await withTenantContext(db, tenantId, async (tx) => {
        const result = await tx.execute<{ tenantId: string }>(
          `select current_setting('trackroster.tenant_id', true) as "tenantId"`,
        );
        expect(result.rows[0]?.tenantId).toBe(tenantId);
        await tx.transaction(async (nested) => {
          const nestedResult = await nested.execute<{ tenantId: string }>(
            `select current_setting('trackroster.tenant_id', true) as "tenantId"`,
          );
          expect(nestedResult.rows[0]?.tenantId).toBe(tenantId);
        });
      });
    } finally {
      await app.close();
    }
  });

  it('enforces same-tenant writes and cross-tenant isolation under the runtime role', async () => {
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: false,
      abortOnError: false,
    });
    const tenantA = randomUUID();
    const tenantB = randomUUID();
    try {
      const db = app.get<Database>(DATABASE);
      await db.insert(tenants).values([
        { id: tenantA, name: tenantA, slug: `rls-${tenantA}` },
        { id: tenantB, name: tenantB, slug: `rls-${tenantB}` },
      ]);
      await withTenantContext(db, tenantA, (tx) =>
        tx
          .insert(organizations)
          .values({ tenantId: tenantA, name: 'Tenant A Org', slug: `org-${tenantA}` }),
      );
      await withTenantContext(db, tenantB, (tx) =>
        tx
          .insert(organizations)
          .values({ tenantId: tenantB, name: 'Tenant B Org', slug: `org-${tenantB}` }),
      );
      await withTenantContext(db, tenantA, async (tx) => {
        const visible = await tx
          .select()
          .from(organizations)
          .where(eq(organizations.tenantId, tenantA));
        expect(visible).toHaveLength(1);
        await expect(
          tx
            .insert(organizations)
            .values({ tenantId: tenantB, name: 'Cross Tenant', slug: `cross-${tenantA}` }),
        ).rejects.toThrow();
      });
      await withTenantContext(db, tenantB, async (tx) => {
        const visible = await tx
          .select()
          .from(organizations)
          .where(eq(organizations.tenantId, tenantA));
        expect(visible).toHaveLength(0);
      });
    } finally {
      await app.close();
    }
  });
});
