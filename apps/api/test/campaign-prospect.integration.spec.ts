import { randomUUID } from 'node:crypto';
import { auditEvents } from '../src/database/schema/audit-events.js';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import type { AuthenticationTokens } from '../src/auth/auth.types.js';
import { PasswordService } from '../src/auth/password.service.js';
import { UserAccessGrantRepository } from '../src/authorization/user-access-grant.repository.js';
import type { Database } from '../src/database/database.types.js';
import { campaignProspects } from '../src/database/schema/campaign-prospects.js';
import { campaigns } from '../src/database/schema/campaigns.js';
import { establishments } from '../src/database/schema/establishments.js';
import { organizations } from '../src/database/schema/organizations.js';
import { tenants } from '../src/database/schema/tenants.js';
import { users } from '../src/database/schema/users.js';
import { TenantService } from '../src/tenants/tenant.service.js';
import { UserRepository } from '../src/users/user.repository.js';
import { getSeedDatabase } from './support/seed.js';

describe('Campaign prospect HTTP integration', () => {
  let app: NestFastifyApplication | undefined;

  let database: Database | undefined;

  let tenantAId = '';
  let tenantBId = '';

  let campaignAId = '';

  let establishmentAId = '';
  let establishmentBId = '';

  let prospectId = '';

  let adminAccessToken = '';
  let regularAccessToken = '';

  const adminPassword = 'CampaignProspectAdmin123!';

  const regularPassword = 'CampaignProspectUser123!';

  function getApp(): NestFastifyApplication {
    if (!app) {
      throw new Error('Application has not been initialized');
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
      name: `Prospect Tenant A ${suffix}`,

      slug: `prospect-a-${suffix}`,
    });

    const tenantB = await tenantService.create({
      name: `Prospect Tenant B ${suffix}`,

      slug: `prospect-b-${suffix}`,
    });

    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    const [organizationA] = await getDatabase()
      .insert(organizations)
      .values({
        tenantId: tenantAId,

        name: 'France Sales',

        slug: `france-${suffix}`,

        status: 'active',
      })
      .returning();

    const [organizationB] = await getDatabase()
      .insert(organizations)
      .values({
        tenantId: tenantBId,

        name: 'Belgium Sales',

        slug: `belgium-${suffix}`,

        status: 'active',
      })
      .returning();

    if (!organizationA || !organizationB) {
      throw new Error('Failed to create organizations');
    }

    const [campaignA] = await getDatabase()
      .insert(campaigns)
      .values({
        tenantId: tenantAId,

        organizationId: organizationA.id,

        name: 'Paris Expansion',

        status: 'draft',
      })
      .returning();

    const [campaignB] = await getDatabase()
      .insert(campaigns)
      .values({
        tenantId: tenantBId,

        organizationId: organizationB.id,

        name: 'Belgium Expansion',

        status: 'draft',
      })
      .returning();

    if (!campaignA || !campaignB) {
      throw new Error('Failed to create campaigns');
    }

    campaignAId = campaignA.id;

    const [establishmentA] = await getDatabase()
      .insert(establishments)
      .values({
        tenantId: tenantAId,

        name: 'Restaurant Paris',

        normalizedName: 'restaurant paris',

        city: 'Paris',

        countryCode: 'FR',

        source: 'manual',

        status: 'active',
      })
      .returning();

    const [establishmentB] = await getDatabase()
      .insert(establishments)
      .values({
        tenantId: tenantBId,

        name: 'Restaurant Brussels',

        normalizedName: 'restaurant brussels',

        city: 'Brussels',

        countryCode: 'BE',

        source: 'manual',

        status: 'active',
      })
      .returning();

    if (!establishmentA || !establishmentB) {
      throw new Error('Failed to create establishments');
    }

    establishmentAId = establishmentA.id;

    establishmentBId = establishmentB.id;

    const adminEmail = `prospect-admin-${suffix}@trackroster.test`;

    const regularEmail = `prospect-user-${suffix}@trackroster.test`;

    const admin = await userRepository.create({
      tenantId: tenantAId,

      email: adminEmail,

      passwordHash: await passwordService.hash(adminPassword),

      status: 'active',
    });

    await userRepository.create({
      tenantId: tenantAId,

      email: regularEmail,

      passwordHash: await passwordService.hash(regularPassword),

      status: 'active',
    });

    await grantRepository.create({
      tenantId: tenantAId,

      userId: admin.id,

      role: 'client_admin',

      scopeType: 'tenant',
    });

    adminAccessToken = (await login(adminEmail, adminPassword)).accessToken;

    regularAccessToken = (await login(regularEmail, regularPassword)).accessToken;
  });

  afterAll(async () => {
    try {
      if (database) {
        for (const tenantId of [tenantAId, tenantBId]) {
          if (!tenantId) {
            continue;
          }

          await database.delete(campaignProspects).where(eq(campaignProspects.tenantId, tenantId));
          await database.delete(auditEvents).where(eq(auditEvents.tenantId, tenantId));

          await database.delete(users).where(eq(users.tenantId, tenantId));

          await database.delete(campaigns).where(eq(campaigns.tenantId, tenantId));

          await database.delete(establishments).where(eq(establishments.tenantId, tenantId));

          await database.delete(auditEvents).where(eq(auditEvents.tenantId, tenantId));

          await database.delete(users).where(eq(users.tenantId, tenantId));

          await database.delete(organizations).where(eq(organizations.tenantId, tenantId));

          await database.delete(tenants).where(eq(tenants.id, tenantId));
        }
      }
    } finally {
      if (app) {
        await app.close();
      }
    }
  });

  it('rejects adding a prospect without authentication', async () => {
    const response = await getApp().inject({
      method: 'POST',

      url: `/campaigns/${campaignAId}/prospects`,

      payload: {
        establishmentId: establishmentAId,
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('rejects adding a prospect for a non-admin user', async () => {
    const response = await getApp().inject({
      method: 'POST',

      url: `/campaigns/${campaignAId}/prospects`,

      headers: {
        authorization: `Bearer ${regularAccessToken}`,
      },

      payload: {
        establishmentId: establishmentAId,
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it('adds an establishment to a campaign', async () => {
    const response = await getApp().inject({
      method: 'POST',

      url: `/campaigns/${campaignAId}/prospects`,

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },

      payload: {
        establishmentId: establishmentAId,
      },
    });

    expect(response.statusCode).toBe(201);

    const body = JSON.parse(response.payload) as {
      id: string;
      tenantId: string;
      campaignId: string;
      establishmentId: string;
      status: string;
    };

    prospectId = body.id;

    expect(body).toMatchObject({
      tenantId: tenantAId,

      campaignId: campaignAId,

      establishmentId: establishmentAId,

      status: 'active',
    });
  });

  it('rejects duplicate active membership', async () => {
    const response = await getApp().inject({
      method: 'POST',

      url: `/campaigns/${campaignAId}/prospects`,

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },

      payload: {
        establishmentId: establishmentAId,
      },
    });

    expect(response.statusCode).toBe(409);
  });

  it('rejects an establishment belonging to another tenant', async () => {
    const response = await getApp().inject({
      method: 'POST',

      url: `/campaigns/${campaignAId}/prospects`,

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },

      payload: {
        establishmentId: establishmentBId,
      },
    });

    expect(response.statusCode).toBe(404);
  });

  it('rejects tenantId supplied by the client', async () => {
    const response = await getApp().inject({
      method: 'POST',

      url: `/campaigns/${campaignAId}/prospects`,

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },

      payload: {
        tenantId: tenantBId,

        establishmentId: establishmentAId,
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('lists campaign prospects', async () => {
    const response = await getApp().inject({
      method: 'GET',

      url: `/campaigns/${campaignAId}/prospects`,

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.payload) as Array<{
      id: string;
      tenantId: string;
      campaignId: string;
    }>;

    expect(body).toHaveLength(1);

    expect(body[0]).toMatchObject({
      id: prospectId,

      tenantId: tenantAId,

      campaignId: campaignAId,
    });
  });

  it('resolves a bounded establishment selection without widening tenant or campaign scope', async () => {
    const read = (ids: string) =>
      getApp().inject({
        method: 'GET',
        url: `/campaigns/${campaignAId}/prospects?establishmentIds=${ids}`,
        headers: { authorization: `Bearer ${adminAccessToken}` },
      });
    const selected = await read(establishmentAId);
    expect(selected.statusCode).toBe(200);
    expect(selected.json()).toHaveLength(1);
    expect(selected.json()[0]).toMatchObject({ id: prospectId, establishmentId: establishmentAId });
    expect((await read(establishmentBId)).json()).toEqual([]);
    expect((await read(randomUUID())).json()).toEqual([]);
    expect((await read('not-a-uuid')).statusCode).toBe(400);
    expect((await read(Array.from({ length: 101 }, () => randomUUID()).join(','))).statusCode).toBe(
      400,
    );
    const denied = await getApp().inject({
      method: 'GET',
      url: `/campaigns/${campaignAId}/prospects?establishmentIds=${establishmentAId}`,
      headers: { authorization: `Bearer ${regularAccessToken}` },
    });
    expect(denied.statusCode).toBe(403);
  });

  it('gets a campaign prospect by id', async () => {
    const response = await getApp().inject({
      method: 'GET',

      url: `/campaigns/${campaignAId}/prospects/${prospectId}`,

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.payload) as {
      id: string;
    };

    expect(body.id).toBe(prospectId);
  });

  it('returns 404 when the prospect is addressed through another campaign', async () => {
    const [secondCampaign] = await getDatabase()
      .insert(campaigns)
      .values({
        tenantId: tenantAId,

        organizationId: (
          await getDatabase()
            .select()
            .from(organizations)
            .where(eq(organizations.tenantId, tenantAId))
            .limit(1)
        )[0]!.id,

        name: 'Second Campaign',

        status: 'draft',
      })
      .returning();

    if (!secondCampaign) {
      throw new Error('Failed to create second campaign');
    }

    const response = await getApp().inject({
      method: 'GET',

      url: `/campaigns/${secondCampaign.id}/prospects/${prospectId}`,

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },
    });

    expect(response.statusCode).toBe(404);
  });

  it('excludes a campaign prospect', async () => {
    const response = await getApp().inject({
      method: 'PATCH',

      url: `/campaigns/${campaignAId}/prospects/${prospectId}`,

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },

      payload: {
        status: 'excluded',
      },
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.payload) as {
      id: string;
      status: string;
    };

    expect(body.id).toBe(prospectId);

    expect(body.status).toBe('excluded');
  });

  it('reactivates an excluded prospect without creating another membership', async () => {
    const response = await getApp().inject({
      method: 'POST',

      url: `/campaigns/${campaignAId}/prospects`,

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },

      payload: {
        establishmentId: establishmentAId,
      },
    });

    expect(response.statusCode).toBe(201);

    const body = JSON.parse(response.payload) as {
      id: string;
      status: string;
    };

    /*
     * Same membership ID.
     */
    expect(body.id).toBe(prospectId);

    expect(body.status).toBe('active');

    const storedMemberships = await getDatabase()
      .select()
      .from(campaignProspects)
      .where(
        and(
          eq(campaignProspects.tenantId, tenantAId),
          eq(campaignProspects.campaignId, campaignAId),
          eq(campaignProspects.establishmentId, establishmentAId),
        ),
      );

    expect(storedMemberships).toHaveLength(1);
  });

  it('blocks membership changes after campaign completion', async () => {
    await getDatabase()
      .update(campaigns)
      .set({
        status: 'completed',

        updatedAt: new Date(),
      })
      .where(and(eq(campaigns.tenantId, tenantAId), eq(campaigns.id, campaignAId)));

    const response = await getApp().inject({
      method: 'PATCH',

      url: `/campaigns/${campaignAId}/prospects/${prospectId}`,

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },

      payload: {
        status: 'excluded',
      },
    });

    expect(response.statusCode).toBe(409);
  });

  /*
   * TR-924 — bulk enrolment.
   *
   * The référentiel is tenant-level and organization-neutral: there is no
   * organization column on `establishments` and its RLS policy is `tenant_id`
   * alone, so the five entities read one shared base and a campaign is how one of
   * them takes a slice of it. These tests hold that model in place, because a
   * later organization_id on the table would break it silently.
   */
  describe('bulk enrolment', () => {
    const post = (url: string, payload: object, token = adminAccessToken, key?: string) =>
      getApp().inject({
        method: 'POST',
        url,
        headers: {
          authorization: `Bearer ${token}`,
          ...(key ? { 'idempotency-key': key } : {}),
        },
        payload,
      });

    /* A campaign of its own, so these tests do not depend on what came before. */
    async function freshCampaign(tenantId = tenantAId): Promise<string> {
      const [organization] = await getDatabase()
        .select()
        .from(organizations)
        .where(eq(organizations.tenantId, tenantId));

      const [campaign] = await getDatabase()
        .insert(campaigns)
        .values({
          tenantId,
          organizationId: organization!.id,
          name: `Enrolment ${randomUUID().slice(0, 8)}`,
          status: 'draft',
        })
        .returning();

      return campaign!.id;
    }

    /*
     * Seeded per test and removed after it. This spec has no shared cleanup, so a
     * fixture created in each test would accumulate and every count assertion
     * would depend on how many tests ran before it.
     */
    let seeded: string[] = [];

    async function seedReferential(): Promise<void> {
      const rows = await getDatabase()
        .insert(establishments)
        .values([
          {
            tenantId: tenantAId,
            name: 'Brigade de Bastia',
            normalizedName: 'brigade de bastia',
            countryCode: 'FR',
            city: 'Bastia',
            postalCode: '20200',
            category: 'prospection',
          },
          {
            tenantId: tenantAId,
            name: 'Commissariat de Lyon',
            normalizedName: 'commissariat de lyon',
            countryCode: 'FR',
            city: 'Lyon',
            postalCode: '69003',
            category: 'prospection',
          },
          {
            tenantId: tenantAId,
            name: 'Douane de Saint-Denis',
            normalizedName: 'douane de saint-denis',
            countryCode: 'FR',
            city: 'Saint-Denis',
            postalCode: '97400',
            category: 'douanes_onaf',
          },
          {
            tenantId: tenantAId,
            name: 'CRA du Mesnil',
            normalizedName: 'cra du mesnil',
            countryCode: 'FR',
            city: 'Le Mesnil-Amelot',
            postalCode: '77990',
            category: 'cra',
            status: 'archived',
          },
        ])
        .returning({ id: establishments.id });

      seeded = rows.map((row) => row.id);
    }

    beforeEach(async () => {
      await seedReferential();
    });

    afterEach(async () => {
      if (seeded.length === 0) return;

      /* Memberships first: the establishment FK restricts the delete. */
      await getDatabase()
        .delete(campaignProspects)
        .where(inArray(campaignProspects.establishmentId, seeded));

      await getDatabase().delete(establishments).where(inArray(establishments.id, seeded));

      seeded = [];
    });

    it('previews without writing, then enrols exactly what it previewed', async () => {
      const campaignId = await freshCampaign();

      const preview = await post(`/campaigns/${campaignId}/prospects/bulk/preview`, {
        category: 'prospection',
      });

      expect(preview.statusCode, preview.payload).toBe(200);
      expect(JSON.parse(preview.payload)).toMatchObject({
        mode: 'preview',
        matched: 2,
        selected: 2,
        enrollable: 2,
        /* A preview that wrote something would not be a preview. */
        enrolled: 0,
        truncated: false,
      });

      expect(
        await getDatabase()
          .select()
          .from(campaignProspects)
          .where(eq(campaignProspects.campaignId, campaignId)),
      ).toHaveLength(0);

      const applied = await post(
        `/campaigns/${campaignId}/prospects/bulk`,
        { category: 'prospection' },
        adminAccessToken,
        randomUUID(),
      );

      expect(applied.statusCode, applied.payload).toBe(200);
      expect(JSON.parse(applied.payload)).toMatchObject({
        mode: 'apply',
        matched: 2,
        enrolled: 2,
        alreadyActive: 0,
      });

      /*
       * Enrolling again with a new key must not duplicate. This is the property
       * that makes it safe to re-run after a partial or uncertain response, and it
       * is the unique index doing the work, not the caller being careful.
       */
      const again = await post(
        `/campaigns/${campaignId}/prospects/bulk`,
        { category: 'prospection' },
        adminAccessToken,
        randomUUID(),
      );

      expect(JSON.parse(again.payload)).toMatchObject({
        matched: 2,
        enrolled: 0,
        alreadyActive: 2,
        enrollable: 0,
      });

      expect(
        await getDatabase()
          .select()
          .from(campaignProspects)
          .where(eq(campaignProspects.campaignId, campaignId)),
      ).toHaveLength(2);
    });

    it('selects by department, ignores archived establishments and reports truncation', async () => {
      const campaignId = await freshCampaign();

      /* Overseas departments are three digits: 974, not 97. */
      const overseas = await post(`/campaigns/${campaignId}/prospects/bulk/preview`, {
        department: '974',
      });

      expect(JSON.parse(overseas.payload)).toMatchObject({ matched: 1, enrollable: 1 });

      /*
       * The CRA row is archived. Enrolling an archived establishment would put
       * work in a prospector's queue that nobody should be doing.
       */
      const archived = await post(`/campaigns/${campaignId}/prospects/bulk/preview`, {
        category: 'cra',
      });

      expect(JSON.parse(archived.payload)).toMatchObject({ matched: 0 });

      /* A set larger than the limit is reported, never silently halved. */
      const capped = await post(
        `/campaigns/${campaignId}/prospects/bulk`,
        { category: 'prospection', limit: 1 },
        adminAccessToken,
        randomUUID(),
      );

      expect(JSON.parse(capped.payload)).toMatchObject({
        matched: 2,
        selected: 1,
        enrolled: 1,
        truncated: true,
        limit: 1,
      });
    });

    it('refuses an unfiltered enrolment and a caller without admin authority', async () => {
      const campaignId = await freshCampaign();

      /*
       * An empty body would mean the entire référentiel — 14,649 memberships from
       * a request that looks like a mistake and reads like a success.
       */
      const unfiltered = await post(
        `/campaigns/${campaignId}/prospects/bulk`,
        {},
        adminAccessToken,
        randomUUID(),
      );

      expect(unfiltered.statusCode, unfiltered.payload).toBe(400);

      const forbidden = await post(
        `/campaigns/${campaignId}/prospects/bulk/preview`,
        { category: 'prospection' },
        regularAccessToken,
      );

      expect(forbidden.statusCode).toBe(403);

      /* An unknown section is the caller's mistake, not a failed query. */
      const badCategory = await post(
        `/campaigns/${campaignId}/prospects/bulk/preview`,
        { category: 'gendarmerie' },
        adminAccessToken,
      );

      expect(badCategory.statusCode).toBe(400);

      const badDepartment = await post(
        `/campaigns/${campaignId}/prospects/bulk/preview`,
        { department: '97' },
        adminAccessToken,
      );

      expect(badDepartment.statusCode).toBe(400);
    });

    it('leaves a deliberately excluded membership excluded, and reports it', async () => {
      const campaignId = await freshCampaign();

      await post(
        `/campaigns/${campaignId}/prospects/bulk`,
        { category: 'prospection' },
        adminAccessToken,
        randomUUID(),
      );

      const [membership] = await getDatabase()
        .select()
        .from(campaignProspects)
        .where(eq(campaignProspects.campaignId, campaignId));

      await getDatabase()
        .update(campaignProspects)
        .set({ status: 'excluded' })
        .where(eq(campaignProspects.id, membership!.id));

      const rerun = await post(
        `/campaigns/${campaignId}/prospects/bulk`,
        { category: 'prospection' },
        adminAccessToken,
        randomUUID(),
      );

      expect(JSON.parse(rerun.payload)).toMatchObject({
        enrolled: 0,
        alreadyActive: 1,
        alreadyExcluded: 1,
      });

      /*
       * Somebody excluded this prospect on purpose. A bulk enrolment that
       * reactivated it would undo that decision without anyone asking.
       */
      const [after] = await getDatabase()
        .select()
        .from(campaignProspects)
        .where(eq(campaignProspects.id, membership!.id));

      expect(after!.status).toBe('excluded');
    });

    it('shares one référentiel across campaigns and never across tenants', async () => {
      const first = await freshCampaign();
      const second = await freshCampaign();

      for (const campaignId of [first, second]) {
        const result = await post(
          `/campaigns/${campaignId}/prospects/bulk`,
          { category: 'prospection' },
          adminAccessToken,
          randomUUID(),
        );

        /*
         * The same establishments enrol into both campaigns. This is the shared
         * base working as intended — the establishment is not owned by either
         * campaign's organization, and collisions between two entities reaching
         * the same one are settled by the reservation coordination scope, not by
         * denying enrolment.
         */
        expect(JSON.parse(result.payload), campaignId).toMatchObject({ enrolled: 2 });
      }

      /*
       * Tenant B's establishment is invisible from tenant A even when named
       * explicitly: the campaign is not found for a foreign tenant, and the
       * référentiel is shared within a tenant, not between them.
       */
      const crossTenant = await post(
        `/campaigns/${first}/prospects/bulk/preview`,
        { establishmentIds: [establishmentBId] },
        adminAccessToken,
      );

      expect(JSON.parse(crossTenant.payload)).toMatchObject({ matched: 0, enrollable: 0 });
    });

    it('records one audit event for the operation, carrying the selection', async () => {
      const campaignId = await freshCampaign();

      await post(
        `/campaigns/${campaignId}/prospects/bulk`,
        { category: 'prospection', department: '69' },
        adminAccessToken,
        randomUUID(),
      );

      const events = await getDatabase()
        .select()
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.tenantId, tenantAId),
            eq(auditEvents.action, 'campaign_prospect.bulk_enrolled'),
            eq(auditEvents.resourceId, campaignId),
          ),
        );

      /*
       * One event, not one per membership. The memberships are the record of what
       * exists; this is the record of the decision that created them, and it
       * carries enough of the selection to reproduce it.
       */
      expect(events).toHaveLength(1);
      expect(events[0]!.metadata).toMatchObject({
        enrolled: 1,
        selectionCategory: 'prospection',
        selectionDepartment: '69',
      });
    });
  });
});
