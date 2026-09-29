import { randomUUID } from 'node:crypto';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import type { AuthenticationTokens } from '../src/auth/auth.types.js';
import { PasswordService } from '../src/auth/password.service.js';
import { UserAccessGrantRepository } from '../src/authorization/user-access-grant.repository.js';
import type { Database } from '../src/database/database.types.js';
import { auditEvents } from '../src/database/schema/audit-events.js';
import { idempotencyRecords } from '../src/database/schema/idempotency-records.js';
import { regions, type Region } from '../src/database/schema/regions.js';
import { tenants } from '../src/database/schema/tenants.js';
import { userAccessGrants } from '../src/database/schema/user-access-grants.js';
import { users } from '../src/database/schema/users.js';
import { RegionService } from '../src/regions/region.service.js';
import { TenantService } from '../src/tenants/tenant.service.js';
import { UserRepository } from '../src/users/user.repository.js';
import { getSeedDatabase, withSeedScope } from './support/seed.js';

describe('Region HTTP and hierarchy integration', () => {
  let app: NestFastifyApplication | undefined;

  let database: Database | undefined;

  let regionService: RegionService | undefined;

  let tenantAId = '';

  let tenantBId = '';

  let userAId = '';

  let userBId = '';

  let adminEmail = '';

  let adminAccessToken = '';

  let tenantBRegionId = '';

  let hierarchyRootId = '';

  let hierarchyChildId = '';

  let hierarchyGrandchildId = '';

  let atomicUpdateRegionId = '';

  const password = 'RegionIntegrationAdmin123!';

  const suffix = randomUUID().replaceAll('-', '').slice(0, 10);

  function getApp(): NestFastifyApplication {
    if (!app) {
      throw new Error('Test application has not been initialized');
    }

    return app;
  }

  function getDatabase(): Database {
    if (!database) {
      throw new Error('Database has not been initialized');
    }

    return database;
  }

  function getRegionService(): RegionService {
    if (!regionService) {
      throw new Error('Region service has not been initialized');
    }

    return regionService;
  }

  function writeHeaders(): {
    authorization: string;
    'idempotency-key': string;
  } {
    return {
      authorization: `Bearer ${adminAccessToken}`,

      'idempotency-key': randomUUID(),
    };
  }

  async function login(email: string, loginPassword: string): Promise<AuthenticationTokens> {
    const response = await getApp().inject({
      method: 'POST',

      url: '/auth/login',

      payload: {
        email,

        password: loginPassword,
      },
    });

    expect(response.statusCode).toBe(200);

    return JSON.parse(response.payload) as AuthenticationTokens;
  }

  beforeAll(async () => {
    const application = await NestFactory.create<NestFastifyApplication>(
      AppModule,

      new FastifyAdapter(),

      {
        logger: false,

        abortOnError: false,
      },
    );

    application.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,

        forbidNonWhitelisted: true,

        transform: true,
      }),
    );

    await application.init();

    app = application;

    database = getSeedDatabase();

    /* Fixtures span several tenants and run through container-resolved
       repositories, so they need the privileged executor; see withSeedScope. */
    await withSeedScope(async () => {
      regionService = application.get(RegionService);

      const tenantService = application.get(TenantService);

      const userRepository = application.get(UserRepository);

      const passwordService = application.get(PasswordService);

      const grantRepository = application.get(UserAccessGrantRepository);

      const tenantA = await tenantService.create({
        name: `Region Integration Tenant A ${suffix}`,

        slug: `region-int-a-${suffix}`,
      });

      const tenantB = await tenantService.create({
        name: `Region Integration Tenant B ${suffix}`,

        slug: `region-int-b-${suffix}`,
      });

      tenantAId = tenantA.id;

      tenantBId = tenantB.id;

      const passwordHash = await passwordService.hash(password);

      adminEmail = `region-admin-${suffix}@trackroster.test`;

      const userA = await userRepository.create({
        tenantId: tenantAId,

        email: adminEmail,

        passwordHash,

        status: 'active',
      });

      const userB = await userRepository.create({
        tenantId: tenantBId,

        email: `region-user-b-${suffix}@trackroster.test`,

        passwordHash,

        status: 'active',
      });

      userAId = userA.id;

      userBId = userB.id;

      await grantRepository.create({
        tenantId: tenantAId,

        userId: userAId,

        role: 'client_admin',

        scopeType: 'tenant',
      });

      const tokens = await login(adminEmail, password);

      adminAccessToken = tokens.accessToken;

      /*
       * Tenant B region used to prove that
       * parent relationships cannot cross tenants.
       */
      const tenantBRegion = await getRegionService().create({
        tenantId: tenantBId,

        actorUserId: userBId,

        name: 'Tenant B Region',

        code: `B-${suffix}`,

        type: 'city',
      });

      tenantBRegionId = tenantBRegion.id;

      /*
       * Build:
       *
       * root
       *   └─ child
       *       └─ grandchild
       */
      const root = await getRegionService().create({
        tenantId: tenantAId,

        actorUserId: userAId,

        name: 'Hierarchy Root',

        code: `ROOT-${suffix}`,

        type: 'country',
      });

      hierarchyRootId = root.id;

      const child = await getRegionService().create({
        tenantId: tenantAId,

        actorUserId: userAId,

        name: 'Hierarchy Child',

        code: `CHILD-${suffix}`,

        type: 'administrative',

        parentRegionId: hierarchyRootId,
      });

      hierarchyChildId = child.id;

      const grandchild = await getRegionService().create({
        tenantId: tenantAId,

        actorUserId: userAId,

        name: 'Hierarchy Grandchild',

        code: `GRANDCHILD-${suffix}`,

        type: 'city',

        parentRegionId: hierarchyChildId,
      });

      hierarchyGrandchildId = grandchild.id;

      const atomicRegion = await getRegionService().create({
        tenantId: tenantAId,

        actorUserId: userAId,

        name: 'Atomic Update Original',

        code: `ATOMIC-UP-${suffix}`,

        type: 'sales_territory',
      });

      atomicUpdateRegionId = atomicRegion.id;
    });
  });

  afterAll(async () => {
    try {
      if (database) {
        for (const tenantId of [tenantAId, tenantBId]) {
          if (!tenantId) {
            continue;
          }

          /*
           * Idempotent HTTP writes create durable
           * rows referencing the authenticated user.
           */
          await getDatabase()
            .delete(idempotencyRecords)
            .where(eq(idempotencyRecords.tenantId, tenantId));

          /*
           * Audit events also reference users.
           */
          await getDatabase().delete(auditEvents).where(eq(auditEvents.tenantId, tenantId));

          await getDatabase()
            .delete(userAccessGrants)
            .where(eq(userAccessGrants.tenantId, tenantId));

          /*
           * Remove hierarchy edges before deleting
           * regions because parent deletion is
           * protected with ON DELETE RESTRICT.
           */
          await getDatabase()
            .update(regions)
            .set({
              parentRegionId: null,
            })
            .where(eq(regions.tenantId, tenantId));

          await getDatabase().delete(regions).where(eq(regions.tenantId, tenantId));

          await getDatabase().delete(users).where(eq(users.tenantId, tenantId));

          await getDatabase().delete(tenants).where(eq(tenants.id, tenantId));
        }
      }
    } finally {
      if (app) {
        await app.close();
      }
    }
  });

  it('creates a tenant-scoped region through the HTTP API', async () => {
    const response = await getApp().inject({
      method: 'POST',

      url: '/regions',

      headers: writeHeaders(),

      payload: {
        name: '  Paris Sales Territory  ',

        code: `paris-${suffix}`,

        type: 'sales_territory',
      },
    });

    expect(response.statusCode).toBe(201);

    const region = JSON.parse(response.payload) as Region;

    expect(region.tenantId).toBe(tenantAId);

    expect(region.name).toBe('Paris Sales Territory');

    expect(region.code).toBe(`PARIS-${suffix}`.toUpperCase());

    expect(region.status).toBe('active');

    expect(region.parentRegionId).toBeNull();
  });

  it('records region.created audit evidence in the same tenant', async () => {
    const response = await getApp().inject({
      method: 'POST',

      url: '/regions',

      headers: writeHeaders(),

      payload: {
        name: 'Audited Created Region',

        code: `AUDIT-C-${suffix}`,

        type: 'city',
      },
    });

    expect(response.statusCode).toBe(201);

    const region = JSON.parse(response.payload) as Region;

    const events = await getDatabase()
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.tenantId, tenantAId),

          eq(auditEvents.action, 'region.created'),

          eq(auditEvents.resourceId, region.id),
        ),
      );

    expect(events).toHaveLength(1);

    expect(events[0]?.actorUserId).toBe(userAId);

    expect(events[0]?.resourceType).toBe('region');
  });

  it('records region.updated audit evidence', async () => {
    const created = await withSeedScope(() =>
      getRegionService().create({
        tenantId: tenantAId,

        actorUserId: userAId,

        name: 'Audit Update Original',

        code: `AUDIT-U-${suffix}`,

        type: 'administrative',
      }),
    );

    const response = await getApp().inject({
      method: 'PATCH',

      url: `/regions/${created.id}`,

      headers: writeHeaders(),

      payload: {
        name: 'Audit Update Changed',
      },
    });

    expect(response.statusCode).toBe(200);

    const updated = JSON.parse(response.payload) as Region;

    expect(updated.name).toBe('Audit Update Changed');

    const events = await getDatabase()
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.tenantId, tenantAId),

          eq(auditEvents.action, 'region.updated'),

          eq(auditEvents.resourceId, created.id),
        ),
      );

    expect(events).toHaveLength(1);

    expect(events[0]?.actorUserId).toBe(userAId);
  });

  it('lists only direct children for a region', async () => {
    const response = await getApp().inject({
      method: 'GET',

      url: `/regions/${hierarchyRootId}/children`,

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const children = JSON.parse(response.payload) as Region[];

    expect(children.map((region) => region.id)).toContain(hierarchyChildId);

    expect(children.map((region) => region.id)).not.toContain(hierarchyGrandchildId);

    for (const region of children) {
      expect(region.tenantId).toBe(tenantAId);

      expect(region.parentRegionId).toBe(hierarchyRootId);
    }
  });

  it('rejects a parent region belonging to another tenant', async () => {
    const response = await getApp().inject({
      method: 'POST',

      url: '/regions',

      headers: writeHeaders(),

      payload: {
        name: 'Cross Tenant Child',

        code: `BAD-PARENT-${suffix}`,

        type: 'administrative',

        parentRegionId: tenantBRegionId,
      },
    });

    /*
     * Tenant-scoped parent lookup intentionally
     * makes another tenant's region look unknown.
     */
    expect(response.statusCode).toBe(404);
  });

  it('rejects duplicate region codes inside the same tenant', async () => {
    const code = `DUP-${suffix}`.toUpperCase();

    const first = await getApp().inject({
      method: 'POST',

      url: '/regions',

      headers: writeHeaders(),

      payload: {
        name: 'Duplicate Code One',

        code,

        type: 'city',
      },
    });

    expect(first.statusCode).toBe(201);

    const second = await getApp().inject({
      method: 'POST',

      url: '/regions',

      headers: writeHeaders(),

      payload: {
        name: 'Duplicate Code Two',

        code,

        type: 'sales_territory',
      },
    });

    expect(second.statusCode).toBe(409);
  });

  it('allows the same region code in different tenants', async () => {
    const sharedCode = `SHARED-${suffix}`.toUpperCase();

    const regionA = await withSeedScope(() =>
      getRegionService().create({
        tenantId: tenantAId,

        actorUserId: userAId,

        name: 'Shared Code Tenant A',

        code: sharedCode,

        type: 'city',
      }),
    );

    const regionB = await withSeedScope(() =>
      getRegionService().create({
        tenantId: tenantBId,

        actorUserId: userBId,

        name: 'Shared Code Tenant B',

        code: sharedCode,

        type: 'city',
      }),
    );

    expect(regionA.code).toBe(sharedCode);

    expect(regionB.code).toBe(sharedCode);

    expect(regionA.tenantId).toBe(tenantAId);

    expect(regionB.tenantId).toBe(tenantBId);
  });

  it('rejects a multi-level hierarchy cycle', async () => {
    /*
     * Existing hierarchy:
     *
     * root -> child -> grandchild
     *
     * Making root a child of grandchild would
     * produce:
     *
     * root -> child -> grandchild -> root
     */
    const response = await getApp().inject({
      method: 'PATCH',

      url: `/regions/${hierarchyRootId}`,

      headers: writeHeaders(),

      payload: {
        parentRegionId: hierarchyGrandchildId,
      },
    });

    expect(response.statusCode).toBe(400);

    const [root] = await getDatabase()
      .select()
      .from(regions)
      .where(eq(regions.id, hierarchyRootId))
      .limit(1);

    expect(root?.parentRegionId).toBeNull();
  });

  it('rejects a direct self-parent at the database boundary', async () => {
    await expect(
      getDatabase()
        .update(regions)
        .set({
          parentRegionId: hierarchyChildId,
        })
        .where(eq(regions.id, hierarchyChildId)),
    ).rejects.toThrow();

    const [child] = await getDatabase()
      .select()
      .from(regions)
      .where(eq(regions.id, hierarchyChildId))
      .limit(1);

    expect(child?.parentRegionId).toBe(hierarchyRootId);
  });

  it('rolls back region creation when audit persistence fails', async () => {
    const rollbackCode = `ROLLBACK-C-${suffix}`.toUpperCase();

    /*
     * userB belongs to Tenant B.
     *
     * The region insert for Tenant A succeeds first,
     * but audit_events enforces that a user actor
     * belongs to the same tenant. Audit insertion
     * therefore fails inside the transaction.
     *
     * The region mutation must roll back too.
     */
    await expect(
      withSeedScope(() =>
        getRegionService().create({
          tenantId: tenantAId,

          actorUserId: userBId,

          name: 'Must Roll Back',

          code: rollbackCode,

          type: 'sales_territory',
        }),
      ),
    ).rejects.toThrow();

    const persisted = await getDatabase()
      .select()
      .from(regions)
      .where(
        and(
          eq(regions.tenantId, tenantAId),

          eq(regions.code, rollbackCode),
        ),
      );

    expect(persisted).toHaveLength(0);
  });

  it('rolls back a region update when audit persistence fails', async () => {
    const [before] = await getDatabase()
      .select()
      .from(regions)
      .where(eq(regions.id, atomicUpdateRegionId))
      .limit(1);

    expect(before?.name).toBe('Atomic Update Original');

    /*
     * Again use a Tenant B actor for a Tenant A
     * mutation. The audit FK must fail after the
     * region update, proving both writes share the
     * same PostgreSQL transaction.
     */
    await expect(
      withSeedScope(() =>
        getRegionService().update(
          tenantAId,

          atomicUpdateRegionId,

          userBId,

          {
            name: 'This Must Not Persist',
          },
        ),
      ),
    ).rejects.toThrow();

    const [after] = await getDatabase()
      .select()
      .from(regions)
      .where(eq(regions.id, atomicUpdateRegionId))
      .limit(1);

    expect(after?.name).toBe('Atomic Update Original');

    const invalidAuditEvents = await getDatabase()
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.tenantId, tenantAId),

          eq(auditEvents.resourceId, atomicUpdateRegionId),

          eq(auditEvents.actorUserId, userBId),
        ),
      );

    expect(invalidAuditEvents).toHaveLength(0);
  });

  it('returns 404 when Tenant A reads a Tenant B region', async () => {
    const response = await getApp().inject({
      method: 'GET',

      url: `/regions/${tenantBRegionId}`,

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },
    });

    expect(response.statusCode).toBe(404);
  });
});
