import { describe, expect, it } from 'vitest';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module.js';
import { DATABASE } from '../src/database/database.constants.js';
import type { Database } from '../src/database/database.types.js';
import { withTenantContext } from '../src/database/tenant-context.js';

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
});
