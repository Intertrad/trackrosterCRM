import { clearSessionEvidenceForUsers } from './support/session-evidence.js';
import { randomUUID } from 'node:crypto';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import type { AuthenticationTokens } from '../src/auth/auth.types.js';
import { PasswordService } from '../src/auth/password.service.js';
import { UserAccessGrantRepository } from '../src/authorization/user-access-grant.repository.js';
import type { Database } from '../src/database/database.types.js';
import { establishments } from '../src/database/schema/establishments.js';
import { regions } from '../src/database/schema/regions.js';
import { tenants } from '../src/database/schema/tenants.js';
import { users } from '../src/database/schema/users.js';
import { TenantService } from '../src/tenants/tenant.service.js';
import { UserRepository } from '../src/users/user.repository.js';
import { getSeedDatabase } from './support/seed.js';

interface NearbyEstablishmentResponse {
  id: string;

  tenantId: string;

  regionId: string | null;

  name: string;

  latitude: number | null;

  longitude: number | null;

  distanceMeters: number;
}

describe('Region and PostGIS integration', () => {
  let app: NestFastifyApplication | undefined;

  let database: Database | undefined;

  let tenantAId = '';

  let tenantBId = '';

  let adminEmail = '';

  let adminAccessToken = '';

  let regionAId = '';

  let regionBId = '';

  let restrictedRegionId = '';

  let originEstablishmentId = '';

  let nearEstablishmentId = '';

  let midEstablishmentId = '';

  let farEstablishmentId = '';

  let noCoordinateEstablishmentId = '';

  let crossTenantSpatialEstablishmentId = '';

  let updateLocationEstablishmentId = '';

  const adminPassword = 'GeospatialIntegrationAdmin123!';

  const originLatitude = 48.8566;

  const originLongitude = 2.3522;

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

  async function login(email: string, password: string): Promise<AuthenticationTokens> {
    const response = await getApp().inject({
      method: 'POST',

      url: '/auth/login',

      payload: {
        email,

        password,
      },
    });

    expect(response.statusCode).toBe(200);

    return JSON.parse(response.payload) as AuthenticationTokens;
  }

  async function createEstablishmentFixture(input: {
    tenantId: string;

    name: string;

    latitude?: number | null;

    longitude?: number | null;

    regionId?: string | null;
  }): Promise<string> {
    const [establishment] = await getDatabase()
      .insert(establishments)
      .values({
        tenantId: input.tenantId,

        regionId: input.regionId ?? null,

        name: input.name,

        normalizedName: input.name.trim().toLowerCase().replace(/\s+/g, ' '),

        countryCode: 'FR',

        latitude: input.latitude ?? null,

        longitude: input.longitude ?? null,

        status: 'active',

        source: 'manual',
      })
      .returning({
        id: establishments.id,
      });

    if (!establishment) {
      throw new Error('Failed to create establishment fixture');
    }

    return establishment.id;
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

    const tenantService = application.get(TenantService);

    const userRepository = application.get(UserRepository);

    const passwordService = application.get(PasswordService);

    const grantRepository = application.get(UserAccessGrantRepository);

    const suffix = randomUUID().replaceAll('-', '').slice(0, 10);

    const tenantA = await tenantService.create({
      name: `Geospatial Tenant A ${suffix}`,

      slug: `geospatial-a-${suffix}`,
    });

    const tenantB = await tenantService.create({
      name: `Geospatial Tenant B ${suffix}`,

      slug: `geospatial-b-${suffix}`,
    });

    tenantAId = tenantA.id;

    tenantBId = tenantB.id;

    adminEmail = `geo-admin-${suffix}@trackroster.test`;

    const passwordHash = await passwordService.hash(adminPassword);

    const adminUser = await userRepository.create({
      tenantId: tenantAId,

      email: adminEmail,

      passwordHash,

      status: 'active',
    });

    await grantRepository.create({
      tenantId: tenantAId,

      userId: adminUser.id,

      role: 'client_admin',

      scopeType: 'tenant',
    });

    const tokens = await login(adminEmail, adminPassword);

    adminAccessToken = tokens.accessToken;

    const [regionA] = await getDatabase()
      .insert(regions)
      .values({
        tenantId: tenantAId,

        name: 'Paris Test Region',

        code: `PAR-${suffix}`.toUpperCase(),

        type: 'city',

        status: 'active',
      })
      .returning({
        id: regions.id,
      });

    if (!regionA) {
      throw new Error('Failed to create Tenant A region');
    }

    regionAId = regionA.id;

    const [regionB] = await getDatabase()
      .insert(regions)
      .values({
        tenantId: tenantBId,

        name: 'Tenant B Test Region',

        code: `TB-${suffix}`.toUpperCase(),

        type: 'city',

        status: 'active',
      })
      .returning({
        id: regions.id,
      });

    if (!regionB) {
      throw new Error('Failed to create Tenant B region');
    }

    regionBId = regionB.id;

    const [restrictedRegion] = await getDatabase()
      .insert(regions)
      .values({
        tenantId: tenantAId,

        name: 'Linked Restricted Region',

        code: `RESTRICT-${suffix}`.toUpperCase(),

        type: 'sales_territory',

        status: 'active',
      })
      .returning({
        id: regions.id,
      });

    if (!restrictedRegion) {
      throw new Error('Failed to create restricted region');
    }

    restrictedRegionId = restrictedRegion.id;

    /*
     * Spatial fixtures.
     *
     * Query origin:
     * Paris center-ish
     * 48.8566, 2.3522
     */

    originEstablishmentId = await createEstablishmentFixture({
      tenantId: tenantAId,

      name: 'Geo Origin',

      latitude: originLatitude,

      longitude: originLongitude,
    });

    /*
     * Roughly 111 metres north.
     */
    nearEstablishmentId = await createEstablishmentFixture({
      tenantId: tenantAId,

      name: 'Geo Near',

      latitude: 48.8576,

      longitude: originLongitude,
    });

    /*
     * Roughly 500 metres north.
     */
    midEstablishmentId = await createEstablishmentFixture({
      tenantId: tenantAId,

      name: 'Geo Mid',

      latitude: 48.8611,

      longitude: originLongitude,
    });

    /*
     * Roughly 5.5 km north, outside
     * the 1 km test radius.
     */
    farEstablishmentId = await createEstablishmentFixture({
      tenantId: tenantAId,

      name: 'Geo Far',

      latitude: 48.9066,

      longitude: originLongitude,
    });

    noCoordinateEstablishmentId = await createEstablishmentFixture({
      tenantId: tenantAId,

      name: 'Geo Without Coordinates',
    });

    /*
     * Intentionally extremely close to the query
     * point, but belongs to Tenant B and must never
     * appear in Tenant A's spatial results.
     */
    crossTenantSpatialEstablishmentId = await createEstablishmentFixture({
      tenantId: tenantBId,

      name: 'Tenant B Geo Nearby',

      latitude: 48.8567,

      longitude: originLongitude,
    });

    updateLocationEstablishmentId = await createEstablishmentFixture({
      tenantId: tenantAId,

      name: 'Geo Coordinate Update',
    });
  });

  afterAll(async () => {
    try {
      if (database) {
        if (tenantAId) {
          /*
           * Establishments must be removed before
           * regions because establishment -> region
           * uses ON DELETE RESTRICT.
           */
          await getDatabase().delete(establishments).where(eq(establishments.tenantId, tenantAId));

          await getDatabase().delete(regions).where(eq(regions.tenantId, tenantAId));

          await clearSessionEvidenceForUsers(getDatabase(), eq(users.tenantId, tenantAId));
          await getDatabase().delete(users).where(eq(users.tenantId, tenantAId));

          await getDatabase().delete(tenants).where(eq(tenants.id, tenantAId));
        }

        if (tenantBId) {
          await getDatabase().delete(establishments).where(eq(establishments.tenantId, tenantBId));

          await getDatabase().delete(regions).where(eq(regions.tenantId, tenantBId));

          await clearSessionEvidenceForUsers(getDatabase(), eq(users.tenantId, tenantBId));
          await getDatabase().delete(users).where(eq(users.tenantId, tenantBId));

          await getDatabase().delete(tenants).where(eq(tenants.id, tenantBId));
        }
      }
    } finally {
      if (app) {
        await app.close();
      }
    }
  });

  it('stores null location when coordinates are absent', async () => {
    const [row] = await getDatabase()
      .select({
        locationIsNull: sql<boolean>`
          ${establishments.location}
          IS NULL
        `,
      })
      .from(establishments)
      .where(eq(establishments.id, noCoordinateEstablishmentId))
      .limit(1);

    expect(row).toBeDefined();

    expect(row?.locationIsNull).toBe(true);
  });

  it('generates a PostGIS point with SRID 4326 from longitude and latitude', async () => {
    const [row] = await getDatabase()
      .select({
        srid: sql<number>`
          ST_SRID(
            ${establishments.location}
          )
        `,

        longitude: sql<number>`
          ST_X(
            ${establishments.location}
          )
        `,

        latitude: sql<number>`
          ST_Y(
            ${establishments.location}
          )
        `,
      })
      .from(establishments)
      .where(eq(establishments.id, originEstablishmentId))
      .limit(1);

    expect(row).toBeDefined();

    expect(row?.srid).toBe(4326);

    expect(row?.longitude).toBeCloseTo(originLongitude, 6);

    expect(row?.latitude).toBeCloseTo(originLatitude, 6);
  });

  it('regenerates location when coordinates change', async () => {
    const updatedLatitude = 49.05;

    const updatedLongitude = 2.25;

    await getDatabase()
      .update(establishments)
      .set({
        latitude: updatedLatitude,

        longitude: updatedLongitude,
      })
      .where(eq(establishments.id, updateLocationEstablishmentId));

    const [row] = await getDatabase()
      .select({
        srid: sql<number>`
          ST_SRID(
            ${establishments.location}
          )
        `,

        longitude: sql<number>`
          ST_X(
            ${establishments.location}
          )
        `,

        latitude: sql<number>`
          ST_Y(
            ${establishments.location}
          )
        `,
      })
      .from(establishments)
      .where(eq(establishments.id, updateLocationEstablishmentId))
      .limit(1);

    expect(row).toBeDefined();

    expect(row?.srid).toBe(4326);

    expect(row?.longitude).toBeCloseTo(updatedLongitude, 6);

    expect(row?.latitude).toBeCloseTo(updatedLatitude, 6);
  });

  it('allows an establishment to reference an active region from the same tenant', async () => {
    const response = await getApp().inject({
      method: 'POST',

      url: '/establishments',

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },

      payload: {
        name: 'Region Assigned Establishment',

        countryCode: 'FR',

        regionId: regionAId,
      },
    });

    expect(response.statusCode).toBe(201);

    const body = JSON.parse(response.payload) as {
      tenantId: string;

      regionId: string | null;
    };

    expect(body.tenantId).toBe(tenantAId);

    expect(body.regionId).toBe(regionAId);
  });

  it('hides another tenant region from establishment assignment', async () => {
    const response = await getApp().inject({
      method: 'POST',

      url: '/establishments',

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },

      payload: {
        name: 'Cross Tenant Region Attempt',

        countryCode: 'FR',

        regionId: regionBId,
      },
    });

    /*
     * RegionRepository scopes by tenant, so a
     * foreign-tenant UUID is deliberately
     * indistinguishable from an unknown region.
     */
    expect(response.statusCode).toBe(404);
  });

  it('rejects a cross-tenant establishment-region relationship at the database boundary', async () => {
    await expect(
      getDatabase().insert(establishments).values({
        tenantId: tenantAId,

        regionId: regionBId,

        name: 'Illegal Cross Tenant Region',

        normalizedName: 'illegal cross tenant region',

        countryCode: 'FR',

        status: 'active',

        source: 'manual',
      }),
    ).rejects.toThrow();
  });

  it('prevents deletion of a region referenced by an establishment', async () => {
    const linkedEstablishmentId = await createEstablishmentFixture({
      tenantId: tenantAId,

      regionId: restrictedRegionId,

      name: 'Region Restriction Fixture',
    });

    await expect(
      getDatabase().delete(regions).where(eq(regions.id, restrictedRegionId)),
    ).rejects.toThrow();

    const [region] = await getDatabase()
      .select({
        id: regions.id,
      })
      .from(regions)
      .where(eq(regions.id, restrictedRegionId))
      .limit(1);

    expect(region?.id).toBe(restrictedRegionId);

    /*
     * Keep the fixture until afterAll so the normal
     * cleanup path also proves establishments are
     * deleted before regions.
     */
    expect(linkedEstablishmentId).not.toBe('');
  });

  it('returns nearby establishments nearest-first using meter distances', async () => {
    const response = await getApp().inject({
      method: 'GET',

      url:
        '/establishments/nearby' +
        `?latitude=${originLatitude}` +
        `&longitude=${originLongitude}` +
        '&radiusMeters=1000' +
        '&limit=50',

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.payload) as NearbyEstablishmentResponse[];

    const ids = body.map((establishment) => establishment.id);

    expect(ids).toContain(originEstablishmentId);

    expect(ids).toContain(nearEstablishmentId);

    expect(ids).toContain(midEstablishmentId);

    expect(ids).not.toContain(farEstablishmentId);

    expect(ids).not.toContain(noCoordinateEstablishmentId);

    expect(ids).not.toContain(crossTenantSpatialEstablishmentId);

    /*
     * Only our three Tenant A spatial fixtures
     * are inside the 1 km radius.
     */
    expect(ids).toEqual([originEstablishmentId, nearEstablishmentId, midEstablishmentId]);

    for (const establishment of body) {
      expect(establishment.tenantId).toBe(tenantAId);

      expect(establishment.distanceMeters).toBeGreaterThanOrEqual(0);

      /*
       * The generated geometry column remains
       * internal and must not leak through the API.
       */
      expect('location' in establishment).toBe(false);
    }

    expect(body[0]?.distanceMeters).toBeLessThan(1);

    /*
     * 0.001 degrees of latitude is about 111 m
     * around Paris. Keep a reasonable tolerance
     * because geography uses spheroid calculations.
     */
    expect(body[1]?.distanceMeters).toBeGreaterThan(100);

    expect(body[1]?.distanceMeters).toBeLessThan(120);

    expect(body[2]?.distanceMeters).toBeGreaterThan(450);

    expect(body[2]?.distanceMeters).toBeLessThan(550);

    expect(body[0]?.distanceMeters ?? 0).toBeLessThan(
      body[1]?.distanceMeters ?? Number.POSITIVE_INFINITY,
    );

    expect(body[1]?.distanceMeters ?? 0).toBeLessThan(
      body[2]?.distanceMeters ?? Number.POSITIVE_INFINITY,
    );
  });

  it('honors the nearby result limit', async () => {
    const response = await getApp().inject({
      method: 'GET',

      url:
        '/establishments/nearby' +
        `?latitude=${originLatitude}` +
        `&longitude=${originLongitude}` +
        '&radiusMeters=1000' +
        '&limit=2',

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.payload) as NearbyEstablishmentResponse[];

    expect(body).toHaveLength(2);

    expect(body.map((establishment) => establishment.id)).toEqual([
      originEstablishmentId,

      nearEstablishmentId,
    ]);
  });

  it('rejects invalid nearby query parameters through the HTTP validation contract', async () => {
    const response = await getApp().inject({
      method: 'GET',

      url:
        '/establishments/nearby' +
        '?latitude=95' +
        '&longitude=2.3522' +
        '&radiusMeters=0' +
        '&limit=101',

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },
    });

    expect(response.statusCode).toBe(400);
  });
});
