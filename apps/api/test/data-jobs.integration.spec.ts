import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureHttpApplication } from '../src/config/http-application.js';
import { DATABASE } from '../src/database/database.constants.js';
import type { Database } from '../src/database/database.types.js';
import {
  auditEvents,
  importJobs,
  exportJobs,
  establishmentContacts,
  assignmentRules,
  authSessions,
  campaignProspectAssignments,
  campaignProspects,
  campaignTerritories,
  campaigns,
  establishments,
  identities,
  idempotencyRecords,
  membershipSettings,
  organizations,
  teams,
  teamSettings,
  tenantMemberships,
  tenantRolePermissions,
  tenants,
  territories,
  territoryAssignments,
  userAccessGrants,
} from '../src/database/schema/index.js';
import { PasswordService } from '../src/auth/password.service.js';
import ExcelJS from 'exceljs';
import { ControlledExportService } from '../src/exports/controlled-export.service.js';
import { ControlledExportRepository } from '../src/exports/controlled-export.repository.js';
import { ManagerDashboardScopeService } from '../src/reporting/manager-dashboard-scope.service.js';
import { EstablishmentService } from '../src/establishments/establishment.service.js';
import { ExportJobService } from '../src/data-jobs/export-job.service.js';
import { ControlledExportSerializerService } from '../src/exports/controlled-export-serializer.service.js';
describe('Durable import and asynchronous export jobs', () => {
  let app: NestFastifyApplication, db: Database;
  const tenantId = randomUUID(),
    foreignTenantId = randomUUID(),
    admin = randomUUID(),
    director = randomUUID(),
    member = randomUUID(),
    foreign = randomUUID();
  const org = randomUUID(),
    otherOrg = randomUUID(),
    foreignOrg = randomUUID(),
    team = randomUUID(),
    otherTeam = randomUUID(),
    outsideTeam = randomUUID(),
    campaign = randomUUID(),
    foreignCampaign = randomUUID(),
    territory = randomUUID();
  const actors = [admin, director, member, foreign],
    tokens = new Map<string, string>();
  const call = (
    method: 'POST' | 'GET' | 'PATCH' | 'DELETE' | 'PUT',
    url: string,
    body?: object,
    actor = admin,
    key: string = randomUUID(),
    version?: string,
  ) =>
    app.inject({
      method,
      url: `/api/v1${url}`,
      payload: body,
      headers: {
        authorization: `Bearer ${tokens.get(actor)}`,
        'idempotency-key': key,
        ...(version ? { 'if-match': version } : {}),
      },
    });
  const prospect = async (longitude: number | null = 2.5, latitude: number | null = 48.5) => {
    const e = randomUUID(),
      p = randomUUID();
    await db.insert(establishments).values({
      id: e,
      tenantId,
      name: e,
      normalizedName: e,
      countryCode: 'FR',
      longitude,
      latitude,
    });
    await db
      .insert(campaignProspects)
      .values({ id: p, tenantId, campaignId: campaign, establishmentId: e });
    return p;
  };
  const upload = (
    id: string,
    content: string | Buffer,
    filename = 'prospects.csv',
    actor = admin,
  ) => {
    const boundary = 'trackroster-test-boundary';
    const buffer = typeof content === 'string' ? Buffer.from(content) : content;
    return app.inject({
      method: 'POST',
      url: `/api/v1/imports/${id}/file`,
      headers: {
        authorization: `Bearer ${tokens.get(actor)}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: Buffer.concat([
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
        ),
        buffer,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]),
    });
  };
  const newImport = async (content = 'name,country_code,external_reference\nAcme,FR,acme-1') => {
    const created = await call('POST', '/imports', {});
    expect(created.statusCode, created.body).toBe(201);
    const id = created.json().id;
    const file = await upload(id, content);
    expect(file.statusCode, file.body).toBe(200);
    return id;
  };
  const requestExport = (body: object = {}, actor = admin, key: string = randomUUID()) =>
    call('POST', '/exports', { type: 'assignments', format: 'csv', ...body }, actor, key);
  const assign = async () => {
    const p = await prospect();
    await db.insert(campaignProspectAssignments).values({
      tenantId,
      campaignId: campaign,
      campaignProspectId: p,
      organizationId: org,
      teamId: team,
      assignedUserId: member,
    });
    return p;
  };
  beforeAll(async () => {
    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
      logger: false,
      abortOnError: false,
    });
    await configureHttpApplication(app);
    await app.init();
    db = app.get(DATABASE);
    await db
      .insert(tenants)
      .values([tenantId, foreignTenantId].map((id) => ({ id, name: id, slug: id })));
    await db.insert(organizations).values(
      [org, otherOrg, foreignOrg].map((id) => ({
        id,
        tenantId: id === foreignOrg ? foreignTenantId : tenantId,
        name: id,
        slug: id,
      })),
    );
    await db.insert(teams).values(
      [team, otherTeam, outsideTeam].map((id) => ({
        id,
        tenantId,
        organizationId: id === outsideTeam ? otherOrg : org,
        name: id,
        slug: id,
      })),
    );
    const password = 'GeographicAllocation123!';
    const passwordHash = await app.get(PasswordService).hash(password);
    await db
      .insert(identities)
      .values(actors.map((id) => ({ id, email: `${id}@example.test`, passwordHash })));
    await db.insert(tenantMemberships).values(
      actors.map((id) => ({
        id,
        identityId: id,
        tenantId: id === foreign ? foreignTenantId : tenantId,
        status: 'active' as const,
        activatedAt: sql`now()`,
      })),
    );
    await db.insert(userAccessGrants).values([
      { tenantId, userId: admin, role: 'client_admin', scopeType: 'tenant' },
      { tenantId: foreignTenantId, userId: foreign, role: 'client_admin', scopeType: 'tenant' },
      {
        tenantId,
        userId: director,
        role: 'director',
        scopeType: 'organization',
        organizationId: org,
      },
      {
        tenantId,
        userId: member,
        role: 'prospector',
        scopeType: 'team',
        organizationId: org,
        teamId: team,
      },
    ]);
    await db.insert(campaigns).values([
      { id: campaign, tenantId, organizationId: org, name: campaign, status: 'active' },
      {
        id: foreignCampaign,
        tenantId: foreignTenantId,
        organizationId: foreignOrg,
        name: foreignCampaign,
        status: 'active',
      },
    ]);
    await db.insert(territories).values({
      id: territory,
      tenantId,
      name: territory,
      boundary: sql`ST_Multi(ST_MakeEnvelope(2,48,3,49,4326))`,
    });
    await db
      .insert(campaignTerritories)
      .values({ tenantId, campaignId: campaign, territoryId: territory });
    for (const id of actors) {
      const result = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: `${id}@example.test`, password },
      });
      expect(result.statusCode, result.body).toBe(200);
      tokens.set(id, result.json().accessToken);
    }
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await db
      .delete(userAccessGrants)
      .where(and(eq(userAccessGrants.tenantId, tenantId), eq(userAccessGrants.role, 'manager')));
    for (const t of [
      importJobs,
      exportJobs,
      establishmentContacts,
      assignmentRules,
      campaignProspectAssignments,
      campaignProspects,
      establishments,
      territoryAssignments,
      membershipSettings,
      teamSettings,
      tenantRolePermissions,
    ])
      await db.delete(t).where(eq(t.tenantId, tenantId));
    await db.update(campaigns).set({ status: 'active' }).where(eq(campaigns.id, campaign));
    await db.update(territories).set({ status: 'active' }).where(eq(territories.id, territory));
    await db.update(teams).set({ status: 'active' }).where(eq(teams.tenantId, tenantId));
    await db
      .update(tenantMemberships)
      .set({ status: 'active', suspendedAt: null })
      .where(eq(tenantMemberships.id, member));
  });
  afterAll(async () => {
    if (db) {
      const ids = [tenantId, foreignTenantId];
      for (const t of [
        idempotencyRecords,
        auditEvents,
        assignmentRules,
        territoryAssignments,
        campaignTerritories,
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
  });
  it('stages, validates and atomically commits a CSV with a contact and a final report', async () => {
    const id = await newImport(
      'name,country_code,external_reference,contact_email\nAcme,FR,one,person@example.test',
    );
    expect(
      (await call('GET', '/imports')).json().items.some((j: { id: string }) => j.id === id),
    ).toBe(true);
    const validated = await call('POST', `/imports/${id}/validate`, {});
    expect(validated.statusCode, validated.body).toBe(200);
    expect(validated.json().summary.totalRows).toBe(1);
    expect((await call('GET', `/imports/${id}/rows`)).json().items[0].data.establishment.name).toBe(
      'Acme',
    );
    const committed = await call('POST', `/imports/${id}/commit`, {});
    expect(committed.statusCode, committed.body).toBe(200);
    expect(committed.json().summary).toMatchObject({
      createdEstablishments: 1,
      createdContacts: 1,
    });
    expect(
      await db.select().from(establishments).where(eq(establishments.tenantId, tenantId)),
    ).toHaveLength(1);
    expect(
      (await call('POST', `/imports/${id}/commit`, {})).json().summary.createdEstablishments,
    ).toBe(1);
    const report = await call('GET', `/imports/${id}/report`);
    expect(report.statusCode, report.body).toBe(200);
    expect(report.body).toContain('created');
    expect(report.headers['content-type']).toContain('text/csv');
    expect((await call('POST', `/imports/${id}/cancel`, {})).statusCode).toBe(409);
  });
  it('persists mapping, corrections and explicit skip decisions before allowing commit', async () => {
    const id = await newImport('Company,Country\n,FR\nGood,FR');
    expect((await call('POST', `/imports/${id}/validate`, {})).statusCode).toBe(409);
    const mapped = await call('PUT', `/imports/${id}/mapping`, {
      mapping: { name: 'Company', country_code: 'Country' },
    });
    expect(mapped.statusCode, mapped.body).toBe(200);
    await call('POST', `/imports/${id}/validate`, {});
    expect((await call('POST', `/imports/${id}/commit`, {})).statusCode).toBe(409);
    const issue = (await call('GET', `/imports/${id}/issues`)).json().items[0];
    const corrected = await call('PATCH', `/import-issues/${issue.id}`, {
      resolution: 'correct',
      values: { Company: 'Corrected' },
    });
    expect(corrected.statusCode, corrected.body).toBe(200);
    expect(corrected.json().status).toBe('uploaded');
    await call('POST', `/imports/${id}/validate`, {});
    expect(
      (await call('POST', `/imports/${id}/commit`, {})).json().summary.createdEstablishments,
    ).toBe(2);
  });
  it('requires duplicate review and reuses existing establishments without overwriting them', async () => {
    const first = await newImport();
    await call('POST', `/imports/${first}/validate`, {});
    await call('POST', `/imports/${first}/commit`, {});
    const second = await newImport();
    await call('POST', `/imports/${second}/validate`, {});
    expect((await call('POST', `/imports/${second}/commit`, {})).statusCode).toBe(409);
    const issue = (await call('GET', `/imports/${second}/issues`))
      .json()
      .items.find((i: { code: string }) => i.code === 'existing_duplicate');
    expect(
      (await call('PATCH', `/import-issues/${issue.id}`, { resolution: 'reuse' })).statusCode,
    ).toBe(200);
    const result = await call('POST', `/imports/${second}/commit`, {});
    expect(result.statusCode, result.body).toBe(200);
    expect(result.json().summary.reusedEstablishments).toBe(1);
    expect(
      await db.select().from(establishments).where(eq(establishments.tenantId, tenantId)),
    ).toHaveLength(1);
  });
  it('detects within-file identity duplicates even with different external references', async () => {
    const id = await newImport('name,country_code,external_reference\nSame,FR,one\nSame,FR,two');
    await call('POST', `/imports/${id}/validate`, {});
    const issue = (await call('GET', `/imports/${id}/issues`))
      .json()
      .items.find((i: { code: string }) => i.code === 'duplicate_in_file');
    expect(issue).toBeTruthy();
    expect((await call('POST', `/imports/${id}/commit`, {})).statusCode).toBe(409);
    expect(
      (await call('PATCH', `/import-issues/${issue.id}`, { resolution: 'skip' })).statusCode,
    ).toBe(200);
    expect((await call('POST', `/imports/${id}/commit`, {})).json().summary).toMatchObject({
      createdEstablishments: 1,
      skippedRows: 1,
    });
  });
  it('rolls back a whole commit if a duplicate appeared after validation', async () => {
    const id = await newImport(
      'name,country_code,external_reference\nFirst,FR,first\nSecond,FR,second',
    );
    await call('POST', `/imports/${id}/validate`, {});
    const other = await newImport('name,country_code,external_reference\nSecond,FR,second');
    await call('POST', `/imports/${other}/validate`, {});
    await call('POST', `/imports/${other}/commit`, {});
    expect((await call('POST', `/imports/${id}/commit`, {})).statusCode).toBe(409);
    expect(
      await db.select().from(establishments).where(eq(establishments.tenantId, tenantId)),
    ).toHaveLength(1);
    expect((await call('GET', `/imports/${id}`)).json().status).toBe('validated');
    await call('POST', `/imports/${id}/validate`, {});
    const issue = (await call('GET', `/imports/${id}/issues`)).json().items[0];
    await call('PATCH', `/import-issues/${issue.id}`, { resolution: 'reuse' });
    expect((await call('POST', `/imports/${id}/commit`, {})).statusCode).toBe(200);
  });
  it('accepts bounded XLSX values and rejects formulas, duplicate headers and unsupported files', async () => {
    const created = (await call('POST', '/imports', {})).json();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Prospects');
    sheet.addRow(['name', 'country_code']);
    sheet.addRow(['Workbook prospect', 'FR']);
    const file = await upload(
      created.id,
      Buffer.from(await workbook.xlsx.writeBuffer()),
      'prospects.xlsx',
    );
    expect(file.statusCode, file.body).toBe(200);
    expect(
      (await call('POST', `/imports/${created.id}/validate`, {})).json().summary.totalRows,
    ).toBe(1);
    sheet.getCell('A2').value = { formula: '1+1', result: 2 };
    expect(
      (await upload(created.id, Buffer.from(await workbook.xlsx.writeBuffer()), 'formula.xlsx'))
        .statusCode,
    ).toBe(400);
    expect((await upload(created.id, 'name,name\nA,FR')).statusCode).toBe(400);
    expect((await upload(created.id, 'data', 'file.exe')).statusCode).toBe(400);
  });
  it('enforces tenant-admin authority, tenant isolation, conditional writes and cancellation', async () => {
    const id = await newImport();
    const initial = (await call('GET', `/imports/${id}`)).json();
    expect((await call('POST', '/imports', {}, member)).statusCode).toBe(403);
    expect((await call('GET', `/imports/${id}`, undefined, foreign)).statusCode).toBe(404);
    await call('POST', `/imports/${id}/validate`, {});
    expect(
      (await call('POST', `/imports/${id}/cancel`, {}, admin, randomUUID(), initial.etag))
        .statusCode,
    ).toBe(412);
    const cancelled = await call('POST', `/imports/${id}/cancel`, {});
    expect(cancelled.statusCode, cancelled.body).toBe(200);
    expect(cancelled.json().status).toBe('cancelled');
    expect((await call('POST', `/imports/${id}/commit`, {})).statusCode).toBe(409);
    expect((await upload(id, 'name,country_code\nNo,FR')).statusCode).toBe(409);
  });
  it('previews selected fields and processes a durable export before an authenticated short-lived download', async () => {
    await assign();
    const preview = await call('POST', '/exports/preview', {
      type: 'assignments',
      fields: ['id', 'campaignId'],
    });
    expect(preview.statusCode, preview.body).toBe(200);
    expect(preview.json().estimatedRows).toBe(1);
    const key = randomUUID(),
      created = await requestExport({ fields: ['id', 'campaignId'] }, admin, key);
    expect(created.statusCode, created.body).toBe(202);
    const id = created.json().id;
    expect(created.json().status).toBe('queued');
    expect((await requestExport({ fields: ['id', 'campaignId'] }, admin, key)).json()).toEqual(
      created.json(),
    );
    expect((await call('GET', `/exports/${id}/download`)).statusCode).toBe(409);
    await app.get(ExportJobService).drain();
    const detail = await call('GET', `/exports/${id}`);
    expect(detail.statusCode, detail.body).toBe(200);
    expect(detail.json()).toMatchObject({ status: 'completed', rowCount: 1 });
    expect(detail.body).not.toContain('contentBase64');
    const link = await call('GET', `/exports/${id}/download`);
    expect(link.statusCode, link.body).toBe(200);
    const file = await app.inject({
      method: 'GET',
      url: link.json().url,
      headers: { authorization: `Bearer ${tokens.get(admin)}` },
    });
    expect(file.statusCode, file.body).toBe(200);
    expect(file.body).toContain('Campaign ID');
    expect(file.body).not.toContain('Team ID');
    const unauth = await app.inject({ method: 'GET', url: link.json().url });
    expect(unauth.statusCode).toBe(401);
    const evidence = (await call('GET', `/exports/${id}/audit`)).json();
    expect(evidence.items.map((e: { action: string }) => e.action)).toEqual(
      expect.arrayContaining([
        'export_job.requested',
        'export_job.completed',
        'export_job.downloaded',
      ]),
    );
  });
  it('supports asynchronous XLSX and preserves the legacy static export routes', async () => {
    await assign();
    const created = await requestExport({ format: 'xlsx' });
    expect(created.statusCode, created.body).toBe(202);
    await app.get(ExportJobService).drain();
    const link = (await call('GET', `/exports/${created.json().id}/download`)).json();
    const file = await app.inject({
      method: 'GET',
      url: link.url,
      headers: { authorization: `Bearer ${tokens.get(admin)}` },
    });
    expect(file.statusCode).toBe(200);
    expect(file.headers['content-type']).toContain('spreadsheetml');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.rawPayload as never);
    expect(workbook.worksheets[0]!.rowCount).toBe(2);
    expect((await call('GET', '/exports/assignments')).statusCode).toBe(200);
  });
  it('cancels only queued exports and invalidates expired download links', async () => {
    const first = (await requestExport()).json();
    expect((await call('POST', `/exports/${first.id}/cancel`, {})).statusCode).toBe(200);
    await app.get(ExportJobService).drain();
    expect((await call('GET', `/exports/${first.id}`)).json().status).toBe('cancelled');
    const next = (await requestExport()).json();
    await app.get(ExportJobService).drain();
    expect((await call('POST', `/exports/${next.id}/cancel`, {})).statusCode).toBe(409);
    const link = (await call('GET', `/exports/${next.id}/download`)).json();
    await db
      .update(exportJobs)
      .set({ downloadExpiresAt: new Date(Date.now() - 1000) })
      .where(eq(exportJobs.id, next.id));
    expect(
      (
        await app.inject({
          method: 'GET',
          url: link.url,
          headers: { authorization: `Bearer ${tokens.get(admin)}` },
        })
      ).statusCode,
    ).toBe(404);
    await db
      .update(exportJobs)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(exportJobs.id, next.id));
    await app.get(ExportJobService).drain();
    expect((await call('GET', `/exports/${next.id}`)).json().status).toBe('expired');
    const [row] = await db.select().from(exportJobs).where(eq(exportJobs.id, next.id));
    expect(row!.contentBase64).toBeNull();
  });
  it('denies foreign/prospector access and invalidates files after export permission changes', async () => {
    const created = await requestExport({}, director);
    expect(created.statusCode, created.body).toBe(202);
    const id = created.json().id;
    await app.get(ExportJobService).drain();
    expect((await call('GET', `/exports/${id}`, undefined, foreign)).statusCode).toBe(404);
    expect((await requestExport({}, member)).statusCode).toBe(403);
    await db.insert(tenantRolePermissions).values({ tenantId, role: 'director', permissions: [] });
    expect((await call('GET', `/exports/${id}/download`, undefined, director)).statusCode).toBe(
      403,
    );
    expect((await requestExport({ fields: ['passwordHash'] })).statusCode).toBe(400);
  });
  it('recovers interrupted processing and fails closed when serialization fails', async () => {
    const first = (await requestExport()).json();
    await db
      .update(exportJobs)
      .set({
        status: 'processing',
        leaseId: randomUUID(),
        leaseUntil: new Date(Date.now() - 1000),
        attempts: 1,
      })
      .where(eq(exportJobs.id, first.id));
    await app.get(ExportJobService).drain();
    expect((await call('GET', `/exports/${first.id}`)).json()).toMatchObject({
      status: 'completed',
      attempts: 2,
    });
    const second = (await requestExport()).json();
    vi.spyOn(app.get(ControlledExportSerializerService), 'serialize').mockRejectedValueOnce(
      new Error('Synthetic serializer failure'),
    );
    await app.get(ExportJobService).drain();
    expect((await call('GET', `/exports/${second.id}`)).json()).toMatchObject({
      status: 'failed',
      failureCode: 'GENERATION_FAILED',
    });
    expect((await call('GET', `/exports/${second.id}/download`)).statusCode).toBe(409);
  });
  it('serializes competing staged import commits without creating duplicate establishments', async () => {
    const ids = [await newImport(), await newImport()];
    for (const id of ids) await call('POST', `/imports/${id}/validate`, {});
    const results = await Promise.all(ids.map((id) => call('POST', `/imports/${id}/commit`, {})));
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect(
      await db.select().from(establishments).where(eq(establishments.tenantId, tenantId)),
    ).toHaveLength(1);
  });
  it('rolls back all imported records if a later row cannot be persisted', async () => {
    const id = await newImport('name,country_code,external_reference\nFirst,FR,one\nSecond,FR,two');
    await call('POST', `/imports/${id}/validate`, {});
    const service = app.get(EstablishmentService),
      original = service.create.bind(service);
    let count = 0;
    vi.spyOn(service, 'create').mockImplementation(async (...args) => {
      if (++count === 2) throw new Error('Synthetic storage failure');
      return original(...args);
    });
    expect((await call('POST', `/imports/${id}/commit`, {})).statusCode).toBe(500);
    expect(
      await db.select().from(establishments).where(eq(establishments.tenantId, tenantId)),
    ).toHaveLength(0);
    expect((await call('GET', `/imports/${id}`)).json().status).toBe('validated');
    vi.restoreAllMocks();
    expect((await call('POST', `/imports/${id}/commit`, {})).statusCode).toBe(200);
  });
  it('does not use an allowed grant elsewhere to bypass a denied export role in the requested organization', async () => {
    await db.insert(userAccessGrants).values({
      tenantId,
      userId: director,
      role: 'manager',
      scopeType: 'team',
      organizationId: otherOrg,
      teamId: outsideTeam,
    });
    await db.insert(tenantRolePermissions).values({ tenantId, role: 'director', permissions: [] });
    const result = await requestExport({ organizationId: org }, director);
    expect(result.statusCode, result.body).toBe(403);
  });
  it('rechecks authority before processing a queued file', async () => {
    const job = (await requestExport({}, director)).json();
    await db.insert(tenantRolePermissions).values({ tenantId, role: 'director', permissions: [] });
    await app.get(ExportJobService).drain();
    const [stored] = await db.select().from(exportJobs).where(eq(exportJobs.id, job.id));
    expect(stored).toMatchObject({
      status: 'failed',
      failureCode: 'AUTHORIZATION_CHANGED',
      contentBase64: null,
    });
  });
  it('prevents a stale worker lease from publishing over its replacement', async () => {
    const job = (await requestExport()).json(),
      serializer = app.get(ControlledExportSerializerService),
      original = serializer.serialize.bind(serializer);
    let entered!: () => void, finish!: () => void;
    const started = new Promise<void>((r) => (entered = r)),
      held = new Promise<void>((r) => (finish = r));
    let calls = 0;
    vi.spyOn(serializer, 'serialize').mockImplementation(async (input) => {
      if (++calls === 1) {
        entered();
        await held;
      }
      return original(input);
    });
    const pending = app.get(ExportJobService).drain();
    await started;
    await db
      .update(exportJobs)
      .set({ leaseUntil: new Date(Date.now() - 1000) })
      .where(eq(exportJobs.id, job.id));
    const replacement = new ExportJobService(
      db,
      app.get(ControlledExportService),
      app.get(ManagerDashboardScopeService),
      app.get(ControlledExportRepository),
      serializer,
    );
    try {
      await replacement.drain();
    } finally {
      finish();
      await pending;
    }
    const [stored] = await db.select().from(exportJobs).where(eq(exportJobs.id, job.id));
    expect(stored).toMatchObject({ status: 'completed', attempts: 2 });
    const evidence = await db
      .select()
      .from(auditEvents)
      .where(
        and(eq(auditEvents.resourceId, job.id), eq(auditEvents.action, 'export_job.completed')),
      );
    expect(evidence).toHaveLength(1);
  });
});
