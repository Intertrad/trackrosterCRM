import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { eq, inArray, sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureHttpApplication } from '../src/config/http-application.js';
import { getSeedDatabase } from './support/seed.js';
import type { Database } from '../src/database/database.types.js';
import {
  prospectAddresses,
  establishmentContacts,
  actions,
  auditEvents,
  authSessions,
  campaignProspectAssignments,
  campaignProspects,
  campaigns,
  establishments,
  identities,
  idempotencyRecords,
  membershipResourceScopes,
  membershipScopeDenials,
  organizations,
  prospectActivities,
  prospectFollowUps,
  teams,
  tenantMemberships,
  tenantRolePermissions,
  tenants,
  territories,
  userAccessGrants,
} from '../src/database/schema/index.js';
import { PasswordService } from '../src/auth/password.service.js';
import type { ProspectCampaignMembership } from '../src/prospect-master/prospect-campaign-context.js';
describe('Prospect master APIs', () => {
  let app: NestFastifyApplication, db: Database;
  const tenant = randomUUID(),
    foreignTenant = randomUUID(),
    admin = randomUUID(),
    member = randomUUID(),
    outsider = randomUUID(),
    foreign = randomUUID();
  const org = randomUUID(),
    foreignOrg = randomUUID(),
    team = randomUUID(),
    campaign = randomUUID(),
    duplicateCampaign = randomUUID(),
    foreignCampaign = randomUUID(),
    territory = randomUUID();
  const places = Array.from({ length: 5 }, () => randomUUID()),
    prospects = Array.from({ length: 6 }, () => randomUUID()),
    assignments = Array.from({ length: 4 }, () => randomUUID());
  const actors = [admin, member, outsider, foreign],
    tokens = new Map<string, string>();
  const call = (
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    payload?: object,
    actor = admin,
    extra: Record<string, string> = {},
  ) =>
    app.inject({
      method,
      url: `/api/v1${url}`,
      payload,
      headers: {
        authorization: `Bearer ${tokens.get(actor)}`,
        'idempotency-key': randomUUID(),
        ...extra,
      },
    });
  beforeAll(async () => {
    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
      logger: false,
    });
    await configureHttpApplication(app);
    await app.init();
    db = getSeedDatabase();
    await db
      .insert(tenants)
      .values([tenant, foreignTenant].map((id) => ({ id, name: id, slug: id })));
    await db.insert(organizations).values([
      { id: org, tenantId: tenant, name: org, slug: org },
      { id: foreignOrg, tenantId: foreignTenant, name: foreignOrg, slug: foreignOrg },
    ]);
    await db
      .insert(teams)
      .values({ id: team, tenantId: tenant, organizationId: org, name: team, slug: team });
    const password = 'MapTestingPassword123!',
      passwordHash = await app.get(PasswordService).hash(password);
    await db
      .insert(identities)
      .values(actors.map((id) => ({ id, email: `${id}@example.test`, passwordHash })));
    await db.insert(tenantMemberships).values(
      actors.map((id) => ({
        id,
        identityId: id,
        tenantId: id === foreign ? foreignTenant : tenant,
        status: 'active' as const,
        activatedAt: sql`now()`,
      })),
    );
    await db.insert(userAccessGrants).values([
      { tenantId: tenant, userId: admin, role: 'client_admin', scopeType: 'tenant' },
      { tenantId: foreignTenant, userId: foreign, role: 'client_admin', scopeType: 'tenant' },
      {
        tenantId: tenant,
        userId: member,
        role: 'prospector',
        scopeType: 'team',
        organizationId: org,
        teamId: team,
      },
    ]);
    await db.insert(campaigns).values(
      [campaign, duplicateCampaign, foreignCampaign].map((id) => ({
        id,
        tenantId: id === foreignCampaign ? foreignTenant : tenant,
        organizationId: id === foreignCampaign ? foreignOrg : org,
        name: id,
        status: 'active' as const,
      })),
    );
    await db.insert(establishments).values(
      places.map((id, i) => ({
        id,
        tenantId: i === 4 ? foreignTenant : tenant,
        name: `Map ${i}`,
        normalizedName: `map ${i}`,
        countryCode: 'FR',
        longitude: i === 2 ? null : i === 3 ? 179.9 : 2.35 + i * 0.001,
        latitude: i === 2 ? null : i === 3 ? 0 : 48.85 + i * 0.001,
      })),
    );
    await db.insert(campaignProspects).values(
      prospects.map((id, i) => ({
        id,
        tenantId: i === 4 ? foreignTenant : tenant,
        campaignId: i === 4 ? foreignCampaign : i === 5 ? duplicateCampaign : campaign,
        establishmentId: places[i === 5 ? 0 : i]!,
        lifecycleStage: i === 1 ? ('converted' as const) : ('to_contact' as const),
      })),
    );
    await db.insert(campaignProspectAssignments).values(
      assignments.map((id, i) => ({
        id,
        tenantId: tenant,
        campaignId: campaign,
        campaignProspectId: prospects[i]!,
        organizationId: org,
        teamId: team,
        assignedUserId: i === 1 ? outsider : member,
      })),
    );
    await db.execute(
      sql`INSERT INTO territories(id,tenant_id,name,boundary) VALUES(${territory},${tenant},'Paris test',ST_Multi(ST_MakeEnvelope(2.35,48.85,2.36,48.86,4326)))`,
    );
    await db.insert(actions).values({
      tenantId: tenant,
      campaignId: campaign,
      campaignProspectId: prospects[0]!,
      establishmentId: places[0]!,
      assignmentId: assignments[0]!,
      assigneeMembershipId: member,
      createdBy: member,
      type: 'call',
      status: 'completed',
      subject: 'Map completed contact',
      completedAt: new Date(),
    });
    for (const id of actors) {
      const r = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: `${id}@example.test`, password },
      });
      expect(r.statusCode).toBe(200);
      tokens.set(id, r.json().accessToken);
    }
  });
  afterAll(async () => {
    if (db) {
      const ids = [tenant, foreignTenant];
      for (const t of [
        prospectAddresses,
        establishmentContacts,
        actions,
        idempotencyRecords,
        auditEvents,
        membershipResourceScopes,
        membershipScopeDenials,
        tenantRolePermissions,
        campaignProspectAssignments,
        campaignProspects,
        establishments,
        campaigns,
        territories,
        authSessions,
        userAccessGrants,
        tenantMemberships,
        teams,
        organizations,
      ])
        await db.delete(t).where(inArray(t.tenantId, ids));
      await db.delete(identities).where(inArray(identities.id, actors));
      await db.delete(tenants).where(inArray(tenants.id, ids));
    }
    await app?.close();
  }, 60_000);

  /*
   * TR-928. The administration référentiel screen narrows 14,649 establishments,
   * so every filter has to be a query parameter: a page is at most 100 rows, and
   * one applied after fetching would search the page and report nothing for the
   * other 14,549.
   *
   * These filters resolve through the same helper as the dispatch queue and bulk
   * enrolment, which is what makes "secteur = prospection, département = 974" one
   * population across all three rather than three dialects.
   */
  /*
   * TR-930. An establishment id could not reach its operational state: activities,
   * follow-ups, assignments and reservations all key to a campaign prospect, and
   * nothing mapped an establishment to its memberships. This is that bridge, and
   * the identifier it returns is what makes the existing scoped endpoints usable
   * from the référentiel.
   */
  describe('campaign memberships', () => {
    const secondOrg = randomUUID(),
      secondCampaign = randomUUID(),
      secondMembership = randomUUID(),
      lonely = randomUUID(),
      followUp = randomUUID();

    beforeEach(async () => {
      /*
       * A second organization holding the same establishment. This is the case the
       * five-entity design turns on: OFTI and GFTIJ may both work one establishment,
       * and that is enrolment rather than collision — collision is decided when one
       * of them tries to reserve it.
       */
      await db
        .insert(organizations)
        .values({ id: secondOrg, tenantId: tenant, name: 'Zed Second entity', slug: secondOrg });

      await db.insert(campaigns).values({
        id: secondCampaign,
        tenantId: tenant,
        organizationId: secondOrg,
        name: 'Zed Second campaign',
        status: 'active',
      });

      await db.insert(campaignProspects).values({
        id: secondMembership,
        tenantId: tenant,
        campaignId: secondCampaign,
        establishmentId: places[0]!,
      });

      /* An establishment nobody has enrolled — the normal state of the base. */
      await db.insert(establishments).values({
        id: lonely,
        tenantId: tenant,
        name: 'Zed Never enrolled',
        normalizedName: 'zed never enrolled',
        countryCode: 'FR',
      });

      await db.insert(prospectActivities).values({
        tenantId: tenant,
        campaignId: campaign,
        campaignProspectId: prospects[0]!,
        establishmentId: places[0]!,
        assignmentId: assignments[0]!,
        userId: member,
        reservationId: randomUUID(),
        type: 'call',
        occurredAt: new Date('2026-09-26T10:42:00.000Z'),
      });

      await db.insert(prospectFollowUps).values({
        id: followUp,
        tenantId: tenant,
        campaignId: campaign,
        campaignProspectId: prospects[0]!,
        establishmentId: places[0]!,
        assignmentId: assignments[0]!,
        createdBy: member,
        dueAt: new Date('2026-09-30T09:00:00.000Z'),
        category: 'follow_up',
        status: 'pending',
      });

      /* Excluded on purpose: TR-924 leaves it alone, so the read must show it. */
      await db
        .update(campaignProspects)
        .set({ status: 'excluded' })
        .where(eq(campaignProspects.id, prospects[5]!));
    });

    afterEach(async () => {
      await db.delete(prospectFollowUps).where(eq(prospectFollowUps.tenantId, tenant));
      await db.delete(prospectActivities).where(eq(prospectActivities.tenantId, tenant));
      await db.delete(campaignProspects).where(eq(campaignProspects.id, secondMembership));
      await db.delete(establishments).where(eq(establishments.id, lonely));
      await db.delete(campaigns).where(eq(campaigns.id, secondCampaign));
      await db.delete(organizations).where(eq(organizations.id, secondOrg));
      await db
        .update(campaignProspects)
        .set({ status: 'active' })
        .where(eq(campaignProspects.id, prospects[5]!));
    });

    const memberships = async (id: string, actor = admin) => {
      const response = await call('GET', `/prospects/${id}/campaign-memberships`, undefined, actor);

      expect(response.statusCode, response.body).toBe(200);

      return response.json().items as ProspectCampaignMembership[];
    };

    it('lists every campaign holding the establishment, one row per organization', async () => {
      const items = await memberships(places[0]!);

      /* Two campaigns in the first entity plus one in the second. */
      expect(items).toHaveLength(3);

      const organizations = items.map((item) => item.organization.name);

      /*
       * Two distinct entities, neither filtered out because the other got there
       * first. Collapsing them into one status would erase the multi-entity model.
       */
      expect(new Set(organizations).size).toBe(2);
      expect(organizations).toContain('Zed Second entity');

      /* The bridge: every row carries the id the scoped endpoints need. */
      for (const item of items) {
        expect(item.campaignProspectId).toMatch(/^[0-9a-f-]{36}$/);
      }
    });

    it('shows an excluded membership rather than hiding it', async () => {
      const items = await memberships(places[0]!);

      const statuses = items.map((item) => item.membership.status);

      expect(statuses).toContain('excluded');
      expect(statuses).toContain('active');
    });

    it('summarises the current assignment, latest activity and next follow-up', async () => {
      const items = await memberships(places[0]!);

      const worked = items.find((item) => item.campaignProspectId === prospects[0]);

      expect(worked).toBeDefined();

      /* The current assignment is the one that has not ended. */
      expect(worked!.assignment).toMatchObject({
        id: assignments[0],
        status: 'active',
        teamId: team,
        assignedUserId: member,
      });

      expect(worked!.latestActivity).toMatchObject({
        type: 'call',
        occurredAt: '2026-09-26T10:42:00.000Z',
      });

      expect(worked!.nextFollowUp).toMatchObject({
        id: followUp,
        dueAt: '2026-09-30T09:00:00.000Z',
        status: 'pending',
      });

      /* A membership nobody owns says so instead of borrowing another's. */
      const untouched = items.find((item) => item.campaignProspectId === secondMembership);

      expect(untouched!.assignment).toBeNull();
      expect(untouched!.latestActivity).toBeNull();
      expect(untouched!.nextFollowUp).toBeNull();
    });

    it('answers an empty list for an establishment no campaign holds', async () => {
      /* It exists and nobody enrolled it. That is not a missing record. */
      expect(await memberships(lonely)).toEqual([]);
    });

    it('discloses nothing about another tenant establishment', async () => {
      expect(
        (await call('GET', `/prospects/${places[4]}/campaign-memberships`, undefined, admin))
          .statusCode,
      ).toBe(404);

      /* And the reverse direction, from the other tenant's own administrator. */
      expect(
        (await call('GET', `/prospects/${places[0]}/campaign-memberships`, undefined, foreign))
          .statusCode,
      ).toBe(404);
    });

    it('does not let seeing the establishment reveal every campaign in the tenant', async () => {
      /*
       * The scoped member reaches this establishment through their own team's
       * assignment, so they see that membership — and must not see the second
       * entity's campaign, which is none of their business. Filtering per
       * membership rather than per establishment is what makes that true.
       */
      const items = await memberships(places[0]!, member);

      const organizations = items.map((item) => item.organization.name);

      expect(organizations).not.toContain('Zed Second entity');
      expect(items.length).toBeLessThan(3);
    });
  });

  describe('référentiel filters', () => {
    const referential = Array.from({ length: 4 }, () => randomUUID());

    beforeEach(async () => {
      await db.insert(establishments).values([
        {
          id: referential[0]!,
          tenantId: tenant,
          name: 'Zed Brigade de Bastia',
          normalizedName: 'zed brigade de bastia',
          countryCode: 'FR',
          category: 'prospection',
          city: 'Bastia',
          postalCode: '20200',
        },
        {
          id: referential[1]!,
          tenantId: tenant,
          name: 'Zed Commissariat de Lyon',
          normalizedName: 'zed commissariat de lyon',
          countryCode: 'FR',
          category: 'prospection',
          city: 'Lyon',
          postalCode: '69003',
        },
        {
          id: referential[2]!,
          tenantId: tenant,
          name: 'Zed Douane de Saint-Denis',
          normalizedName: 'zed douane de saint-denis',
          countryCode: 'FR',
          category: 'douanes_onaf',
          city: 'Saint-Denis',
          postalCode: '97400',
        },
        {
          id: referential[3]!,
          tenantId: tenant,
          name: 'Zed Hopital archive',
          normalizedName: 'zed hopital archive',
          countryCode: 'FR',
          category: 'sante',
          city: 'Bourg-en-Bresse',
          postalCode: '01000',
          status: 'archived',
        },
      ]);
    });

    afterEach(async () => {
      await db.delete(establishments).where(inArray(establishments.id, referential));
    });

    /* Only the rows this block seeded; the spec's own fixtures are named "Map n". */
    const mine = async (query: string) => {
      const response = await call('GET', `/prospects?limit=100&${query}`);

      expect(response.statusCode, response.body).toBe(200);

      return response
        .json()
        .items.filter((x: { name: string }) => x.name.startsWith('Zed '))
        .map((x: { name: string }) => x.name);
    };

    it('narrows by section, department and commune, and keeps them on the next page', async () => {
      expect(await mine('category=prospection')).toEqual([
        'Zed Brigade de Bastia',
        'Zed Commissariat de Lyon',
      ]);

      /* Overseas departments are three digits: 974, and 97 is not a department. */
      expect(await mine('department=974')).toEqual(['Zed Douane de Saint-Denis']);
      expect((await call('GET', '/prospects?department=97')).statusCode).toBe(400);

      /* Corsica reads 20 rather than 2A/2B — see postal-department.ts. */
      expect(await mine('department=20')).toEqual(['Zed Brigade de Bastia']);

      expect(await mine('city=lyon')).toEqual(['Zed Commissariat de Lyon']);

      /* Archived is excluded by the default status, and reachable explicitly. */
      expect(await mine('category=sante')).toEqual([]);
      expect(await mine('category=sante&status=archived')).toEqual(['Zed Hopital archive']);

      expect((await call('GET', '/prospects?category=gendarmerie')).statusCode).toBe(400);

      /*
       * The cursor must carry the filter. A keyset that forgot it would answer the
       * first page correctly and then leak the rest of the base into page two,
       * which is the kind of bug a single-page test never sees.
       */
      const first = await call('GET', '/prospects?category=prospection&limit=1');
      const cursor = first.json().nextCursor as string | null;

      expect(first.json().items).toHaveLength(1);
      expect(cursor).toBeTruthy();

      const second = await call('GET', `/prospects?category=prospection&limit=1&cursor=${cursor}`);

      expect(second.statusCode, second.body).toBe(200);
      expect(
        second.json().items.every((x: { category: string | null }) => x.category === 'prospection'),
      ).toBe(true);
    });

    it('searches the commune, the postcode and the address, not only the name', async () => {
      /*
       * This widened: the listing used to match the name alone. Reading the same
       * fields as the dispatch queue means a manager who searches a postcode on one
       * screen does not get a different answer on the other.
       */
      expect(await mine('search=97400')).toEqual(['Zed Douane de Saint-Denis']);
      expect(await mine('search=bourg-en&status=all')).toEqual(['Zed Hopital archive']);
      expect(await mine('search=brigade')).toEqual(['Zed Brigade de Bastia']);
      expect(await mine('search=aucun-resultat')).toEqual([]);
    });

    it('combines filters rather than widening on each one', async () => {
      expect(await mine('category=prospection&department=69')).toEqual([
        'Zed Commissariat de Lyon',
      ]);

      /* A combination nothing satisfies is empty, not the union of its parts. */
      expect(await mine('category=prospection&department=974')).toEqual([]);
    });

    it('keeps the référentiel out of reach of a workspace without tenant access', async () => {
      /*
       * An establishment outside every campaign is only visible to a tenant-scoped
       * grant. TR-928 must not widen that, so the filters are checked against a
       * scoped member too: they narrow what that member may already see.
       */
      const scoped = await call(
        'GET',
        '/prospects?category=prospection&limit=100',
        undefined,
        member,
      );

      expect(scoped.statusCode, scoped.body).toBe(200);
      expect(scoped.json().items.some((x: { name: string }) => x.name.startsWith('Zed '))).toBe(
        false,
      );

      /*
       * And the detail endpoint, which TR-929 exposes to the browser for the first
       * time. Filtering a listing is not the same guarantee as refusing a record
       * fetched by id, and the second is the one a URL can be typed into.
       *
       * 404 rather than 403: the API declines to disclose that the establishment
       * exists, which is why the screen cannot tell the two apart either.
       */
      expect(
        (await call('GET', `/prospects/${referential[0]}`, undefined, member)).statusCode,
      ).toBe(404);

      /* An administrator of this tenant reads the same record without trouble. */
      expect((await call('GET', `/prospects/${referential[0]}`)).statusCode).toBe(200);
    });
  });

  it('scopes reads, paginates and rejects foreign cursors and edits', async () => {
    const r = await call('GET', '/prospects?limit=1');
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().nextCursor).toBeTruthy();
    const own = await call('GET', '/prospects', undefined, member);
    expect(own.json().items.every((x: { id: string }) => x.id !== places[1])).toBe(true);
    expect((await call('GET', `/prospects/${places[0]}`, undefined, foreign)).statusCode).toBe(404);
    expect(
      (await call('PATCH', `/prospects/${places[0]}`, { name: 'bad' }, outsider)).statusCode,
    ).toBe(404);
    expect((await call('GET', `/prospects?cursor=${randomUUID()}`)).statusCode).toBe(400);
  });
  it('creates idempotently and enforces validation and optimistic concurrency', async () => {
    const key = randomUUID(),
      input = { name: ' New prospect ', countryCode: 'fr' };
    const r = await call('POST', '/prospects', input, admin, { 'idempotency-key': key });
    expect(r.statusCode, r.body).toBe(201);
    const id = r.json().id;
    expect(
      (await call('POST', '/prospects', input, admin, { 'idempotency-key': key })).json().id,
    ).toBe(id);
    const updated = await call('PATCH', `/prospects/${id}`, { name: 'Updated' }, admin, {
      'if-match': String(r.headers.etag),
    });
    expect(updated.statusCode, updated.body).toBe(200);
    expect(
      (
        await call('PATCH', `/prospects/${id}`, { name: 'Stale' }, admin, {
          'if-match': String(r.headers.etag),
        })
      ).statusCode,
    ).toBe(412);
    for (const data of [
      { name: null },
      { countryCode: null },
      { latitude: 1 },
      { status: 'archived' },
      {},
    ])
      expect((await call('PATCH', `/prospects/${id}`, data)).statusCode).toBe(400);
    expect((await call('POST', '/prospects', input, member)).statusCode).toBe(403);
  });
  it('maintains primary addresses, map coordinates, tenant-safe edits and soft deletion', async () => {
    const id = (
      await call('POST', '/prospects', { name: 'Address test', countryCode: 'FR' })
    ).json().id;
    const r = await call('POST', `/prospects/${id}/addresses`, {
      line1: '1 Street',
      countryCode: 'FR',
      latitude: 48,
      longitude: 2,
      isPrimary: true,
    });
    expect(r.statusCode, r.body).toBe(201);
    const address = r.json().id;
    expect((await call('GET', `/prospects/${id}`)).json().latitude).toBe(48);
    expect(
      (await call('PATCH', `/prospect-addresses/${address}`, { city: 'Paris' }, foreign))
        .statusCode,
    ).toBe(404);
    expect(
      (await call('PATCH', `/prospect-addresses/${address}`, { city: 'Paris' })).statusCode,
    ).toBe(200);
    const second = await call('POST', `/prospects/${id}/addresses`, {
      line1: '2 Street',
      countryCode: 'FR',
      isPrimary: true,
    });
    expect(second.statusCode, second.body).toBe(201);
    const list = (await call('GET', `/prospects/${id}/addresses`)).json().items;
    expect(list.filter((x: { isPrimary: boolean }) => x.isPrimary)).toHaveLength(1);
    expect((await call('DELETE', `/prospect-addresses/${second.json().id}`)).statusCode).toBe(204);
    expect((await call('GET', `/prospects/${id}`)).json().latitude).toBeNull();
  });
  it('normalizes contacts, preserves primary uniqueness and archives without erasing history', async () => {
    const id = (
      await call('POST', '/prospects', { name: 'Contact test', countryCode: 'FR' })
    ).json().id;
    const r = await call('POST', `/prospects/${id}/contacts`, {
      name: 'First',
      email: 'First@Example.com',
      isPrimary: true,
    });
    expect(r.statusCode, r.body).toBe(201);
    const contact = r.json().id;
    expect(r.json().email).toBe('first@example.com');
    expect(
      (await call('POST', `/prospects/${id}/contacts`, { email: 'first@example.com' })).statusCode,
    ).toBe(409);
    expect(
      (await call('PATCH', `/prospect-contacts/${contact}`, { phone: '123' })).statusCode,
    ).toBe(200);
    expect(
      (await call('POST', `/prospects/${id}/contacts`, { name: 'Second', isPrimary: true }))
        .statusCode,
    ).toBe(201);
    expect(
      (await call('GET', `/prospects/${id}/contacts`))
        .json()
        .items.filter((x: { isPrimary: boolean }) => x.isPrimary),
    ).toHaveLength(1);
    expect((await call('DELETE', `/prospect-contacts/${contact}`)).statusCode).toBe(204);
    expect(
      (
        await db.select().from(establishmentContacts).where(eq(establishmentContacts.id, contact))
      )[0]?.status,
    ).toBe('archived');
  });
  it('blocks archival with open work, archives empty prospects and restores', async () => {
    expect((await call('DELETE', `/prospects/${places[0]}`)).statusCode).toBe(409);
    const id = (
      await call('POST', '/prospects', { name: 'Archive test', countryCode: 'FR' })
    ).json().id;
    expect((await call('DELETE', `/prospects/${id}`)).statusCode).toBe(204);
    expect((await call('PATCH', `/prospects/${id}`, { name: 'bad' })).statusCode).toBe(409);
    expect(
      (await call('GET', '/prospects?status=archived'))
        .json()
        .items.some((x: { id: string }) => x.id === id),
    ).toBe(true);
    expect((await call('POST', `/prospects/${id}/restore`)).statusCode).toBe(200);
  });
});
