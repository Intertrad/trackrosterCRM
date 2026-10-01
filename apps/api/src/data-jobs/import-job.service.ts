import { normalizeEstablishmentName } from '../establishments/establishment.utils.js';
import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { and, eq, gt, sql } from 'drizzle-orm';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { DATABASE } from '../database/database.constants.js';
import type { Database, DatabaseExecutor } from '../database/database.types.js';
import {
  auditEvents,
  importJobs,
  importRows,
  importIssues,
  tenants,
} from '../database/schema/index.js';
import { ImportPreviewService } from '../imports/import-preview.service.js';
import { ImportDeduplicationService } from '../imports/import-deduplication.service.js';
import { IMPORT_HEADERS, REQUIRED_IMPORT_HEADERS } from '../imports/import-preview.constants.js';
import { EstablishmentService } from '../establishments/establishment.service.js';
import { EstablishmentContactService } from '../establishment-contacts/establishment-contact.service.js';
import { EstablishmentContactRepository } from '../establishment-contacts/establishment-contact.repository.js';
import { assertResourceMatches, resourceETag } from '../http/resource-etag.js';
import { sanitizeSpreadsheetValue } from '../exports/spreadsheet-value.utils.js';
import { NotificationEventService } from '../notifications/notification-event.service.js';
import type {
  ImportIssueResolutionDto,
  ImportMappingDto,
  ImportRowsDto,
  JobListDto,
} from './data-jobs.dto.js';
import { csvCell, parseImportFile } from './import-file.js';
@Injectable()
export class ImportJobService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly preview: ImportPreviewService,
    private readonly dedup: ImportDeduplicationService,
    private readonly establishments: EstablishmentService,
    private readonly contacts: EstablishmentContactService,
    private readonly contactRepository: EstablishmentContactRepository,
    @Optional() private readonly notificationEvents?: NotificationEventService,
  ) {}
  async authorize(a: AuthenticatedPrincipal, tx: DatabaseExecutor = this.db) {
    const r = await tx.execute(
      sql`SELECT m.id FROM tenant_memberships m JOIN identities i ON i.id=m.identity_id JOIN user_access_grants g ON g.tenant_id=m.tenant_id AND g.user_id=m.id WHERE m.tenant_id=${a.tenantId} AND m.id=${a.membershipId} AND m.status='active' AND i.status='active' AND g.role='client_admin' AND g.scope_type='tenant'`,
    );
    if (!r.rows.length) throw new ForbiddenException('Tenant administrator required for imports');
  }
  private public(j: typeof importJobs.$inferSelect) {
    const { records, ...rest } = j;
    return { ...rest, rowCount: records.length, etag: resourceETag(j) };
  }
  async row(a: AuthenticatedPrincipal, id: string, tx: DatabaseExecutor = this.db) {
    await this.authorize(a, tx);
    const [j] = await tx
      .select()
      .from(importJobs)
      .where(and(eq(importJobs.tenantId, a.tenantId), eq(importJobs.id, id)));
    if (!j) throw new NotFoundException('Import not found');
    return j;
  }
  async detail(a: AuthenticatedPrincipal, id: string) {
    return this.public(await this.row(a, id));
  }
  async list(a: AuthenticatedPrincipal, q: JobListDto) {
    await this.authorize(a);
    const rows = await this.db
      .select()
      .from(importJobs)
      .where(
        and(
          eq(importJobs.tenantId, a.tenantId),
          q.cursor ? gt(importJobs.id, q.cursor) : undefined,
        ),
      )
      .orderBy(importJobs.id)
      .limit(q.limit + 1);
    return {
      items: rows.slice(0, q.limit).map((j) => this.public(j)),
      nextCursor: rows.length > q.limit ? rows[q.limit - 1]!.id : null,
    };
  }
  private async lock(a: AuthenticatedPrincipal, tx: DatabaseExecutor) {
    await tx
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, a.tenantId))
      .for('no key update');
    await this.authorize(a, tx);
  }
  private mutable(j: typeof importJobs.$inferSelect, version?: string) {
    assertResourceMatches(version, j);
    if (['committed', 'cancelled'].includes(j.status))
      throw new ConflictException('Import is terminal');
  }
  private async audit(
    a: AuthenticatedPrincipal,
    id: string,
    action: string,
    metadata: Record<string, unknown>,
    tx: DatabaseExecutor,
  ) {
    await tx.insert(auditEvents).values({
      tenantId: a.tenantId,
      actorType: 'user',
      actorUserId: a.membershipId,
      resourceType: 'import',
      resourceId: id,
      action: `import.${action}`,
      metadata,
    });
  }
  async create(a: AuthenticatedPrincipal) {
    return this.db.transaction(async (tx) => {
      await this.lock(a, tx);
      const [j] = await tx
        .insert(importJobs)
        .values({ tenantId: a.tenantId, requesterId: a.membershipId })
        .returning();
      await this.audit(a, j!.id, 'created', {}, tx);
      return this.public(j!);
    });
  }
  async upload(
    a: AuthenticatedPrincipal,
    id: string,
    filename: string,
    buffer: Buffer,
    version?: string,
  ) {
    await this.row(a, id);
    if (filename.length > 255) throw new BadRequestException('Filename too long');
    const parsed = await parseImportFile(filename, buffer),
      hash = createHash('sha256').update(buffer).digest('hex');
    return this.db.transaction(async (tx) => {
      await this.lock(a, tx);
      const j = await this.row(a, id, tx);
      this.mutable(j, version);
      if (j.fileHash === hash) return this.public(j);
      await tx
        .delete(importRows)
        .where(and(eq(importRows.tenantId, a.tenantId), eq(importRows.importId, id)));
      const mapping = Object.fromEntries(
        IMPORT_HEADERS.filter((h) => parsed.headers.includes(h)).map((h) => [h, h]),
      );
      const [next] = await tx
        .update(importJobs)
        .set({
          ...parsed,
          filename,
          fileHash: hash,
          mapping,
          status: 'uploaded',
          summary: {},
          updatedAt: sql`clock_timestamp()`,
        })
        .where(eq(importJobs.id, id))
        .returning();
      await this.audit(
        a,
        id,
        'uploaded',
        { filename, sha256: hash, rowCount: parsed.records.length },
        tx,
      );
      return this.public(next!);
    });
  }
  async mapping(a: AuthenticatedPrincipal, id: string, b: ImportMappingDto, version?: string) {
    return this.db.transaction(async (tx) => {
      await this.lock(a, tx);
      const j = await this.row(a, id, tx);
      this.mutable(j, version);
      if (!j.fileHash) throw new ConflictException('Upload a file first');
      if (
        !b.mapping ||
        Object.entries(b.mapping).some(
          ([key, value]) =>
            !(IMPORT_HEADERS as readonly string[]).includes(key) ||
            typeof value !== 'string' ||
            !j.headers.includes(value),
        ) ||
        REQUIRED_IMPORT_HEADERS.some((h) => !b.mapping[h])
      )
        throw new BadRequestException(
          'Map supported fields to existing headers, including name and country_code',
        );
      if (new Set(Object.values(b.mapping)).size !== Object.values(b.mapping).length)
        throw new BadRequestException('A source column can only map to one field');
      await tx
        .delete(importRows)
        .where(and(eq(importRows.tenantId, a.tenantId), eq(importRows.importId, id)));
      const [next] = await tx
        .update(importJobs)
        .set({
          mapping: b.mapping,
          status: 'uploaded',
          summary: {},
          updatedAt: sql`clock_timestamp()`,
        })
        .where(eq(importJobs.id, id))
        .returning();
      await this.audit(a, id, 'mapped', { mapping: b.mapping }, tx);
      return this.public(next!);
    });
  }
  async validate(a: AuthenticatedPrincipal, id: string, version?: string) {
    return this.db.transaction(async (tx) => {
      await this.lock(a, tx);
      const j = await this.row(a, id, tx);
      this.mutable(j, version);
      if (!j.fileHash || REQUIRED_IMPORT_HEADERS.some((h) => !j.mapping[h]))
        throw new ConflictException('Upload and map required columns first');
      const fields = IMPORT_HEADERS.filter((h) => j.mapping[h]);
      const csv = [
        fields.join(','),
        ...j.records.map((r) =>
          fields.map((h) => csvCell(r[j.headers.indexOf(j.mapping[h]!)])).join(','),
        ),
      ].join('\n');
      const preview = this.preview.previewCsv(csv);
      await tx
        .delete(importRows)
        .where(and(eq(importRows.tenantId, a.tenantId), eq(importRows.importId, id)));
      let issueCount = 0,
        duplicates = 0;
      const seenKeys = new Set<string>();
      for (const data of preview.rows) {
        const limits: Record<string, number> = {
          name: 255,
          externalReference: 255,
          addressLine1: 255,
          postalCode: 32,
          city: 150,
          phone: 50,
          website: 500,
        };
        for (const [key, value] of Object.entries(data.establishment ?? {}))
          if (typeof value === 'string' && limits[key] && value.length > limits[key]!)
            data.issues.push({
              code: 'field_too_long',
              severity: 'error',
              field: key,
              message: `${key} exceeds ${limits[key]} characters`,
            });
        for (const [key, value] of Object.entries(data.contact ?? {}))
          if (typeof value === 'string' && value.length > (key === 'phone' ? 50 : 255))
            data.issues.push({
              code: 'field_too_long',
              severity: 'error',
              field: key,
              message: `Contact ${key} is too long`,
            });
        if (data.issues.some((i) => i.severity === 'error')) data.status = 'invalid';
        if (data.establishment) {
          const e = data.establishment;
          const keys = e.externalReference
            ? ['external:' + e.externalReference.trim().toLowerCase()]
            : [
                JSON.stringify([
                  normalizeEstablishmentName(e.name),
                  e.postalCode?.trim().toLowerCase() ?? '',
                  e.city?.trim().toLowerCase() ?? '',
                  e.countryCode,
                ]),
              ];
          if (
            keys.some((k) => seenKeys.has(k)) &&
            !data.issues.some((i) => i.code === 'duplicate_in_file')
          )
            data.issues.push({
              code: 'duplicate_in_file',
              severity: 'warning',
              message: 'Another row matches this establishment identity; skip or correct this row',
            });
          keys.forEach((k) => seenKeys.add(k));
        }
        const existing = data.establishment
          ? await this.dedup.findExisting(a.tenantId, data.establishment, tx)
          : null;
        if (existing) {
          data.issues.push({
            code: 'existing_duplicate',
            severity: 'warning',
            message: 'An existing establishment matches; choose reuse or skip',
          });
          duplicates++;
        }
        if (data.status !== 'invalid' && data.issues.length) data.status = 'warning';
        const [row] = await tx
          .insert(importRows)
          .values({
            tenantId: a.tenantId,
            importId: id,
            rowNumber: data.rowNumber,
            data,
            existingId: existing?.id ?? null,
          })
          .returning();
        if (data.issues.length)
          await tx.insert(importIssues).values(
            data.issues.map((i) => ({
              tenantId: a.tenantId,
              importId: id,
              rowId: row!.id,
              code: i.code,
              severity: i.severity,
              message: i.message,
            })),
          );
        issueCount += data.issues.length;
      }
      const summary = {
        ...preview.summary,
        validRows: preview.rows.filter((r) => r.status === 'valid').length,
        warningRows: preview.rows.filter((r) => r.status === 'warning').length,
        invalidRows: preview.rows.filter((r) => r.status === 'invalid').length,
        issueCount,
        existingDuplicates: duplicates,
      };
      const [next] = await tx
        .update(importJobs)
        .set({ status: 'validated', summary, updatedAt: sql`clock_timestamp()` })
        .where(eq(importJobs.id, id))
        .returning();
      await this.audit(a, id, 'validated', summary, tx);
      return this.public(next!);
    });
  }
  async rows(a: AuthenticatedPrincipal, id: string, q: ImportRowsDto) {
    await this.row(a, id);
    const rows = await this.db
      .select()
      .from(importRows)
      .where(
        and(
          eq(importRows.tenantId, a.tenantId),
          eq(importRows.importId, id),
          gt(importRows.rowNumber, q.afterRow),
        ),
      )
      .orderBy(importRows.rowNumber)
      .limit(q.limit + 1);
    return {
      items: rows.slice(0, q.limit),
      nextAfterRow: rows.length > q.limit ? rows[q.limit - 1]!.rowNumber : null,
    };
  }
  async issues(a: AuthenticatedPrincipal, id: string, q: JobListDto) {
    await this.row(a, id);
    const rows = await this.db
      .select()
      .from(importIssues)
      .where(
        and(
          eq(importIssues.tenantId, a.tenantId),
          eq(importIssues.importId, id),
          q.cursor ? gt(importIssues.id, q.cursor) : undefined,
        ),
      )
      .orderBy(importIssues.id)
      .limit(q.limit + 1);
    return {
      items: rows.slice(0, q.limit),
      nextCursor: rows.length > q.limit ? rows[q.limit - 1]!.id : null,
    };
  }
  async resolve(
    a: AuthenticatedPrincipal,
    issueId: string,
    b: ImportIssueResolutionDto,
    version?: string,
  ) {
    return this.db.transaction(async (tx) => {
      await this.lock(a, tx);
      const [issue] = await tx
        .select()
        .from(importIssues)
        .where(and(eq(importIssues.tenantId, a.tenantId), eq(importIssues.id, issueId)));
      if (!issue) throw new NotFoundException('Import issue not found');
      const j = await this.row(a, issue.importId, tx);
      this.mutable(j, version);
      if (j.status !== 'validated') throw new ConflictException('Validate the current file first');
      const [row] = await tx.select().from(importRows).where(eq(importRows.id, issue.rowId));
      if (b.resolution === 'correct') {
        if (
          !b.values ||
          !Object.keys(b.values).length ||
          Object.entries(b.values).some(
            ([key, value]) =>
              !j.headers.includes(key) || typeof value !== 'string' || value.length > 10000,
          )
        )
          throw new BadRequestException(
            'Corrections must use source header names and bounded string values',
          );
        const records = j.records.map((r, i) =>
          i === row!.rowNumber - 2 ? r.map((v, c) => b.values![j.headers[c]!] ?? v) : r,
        );
        await tx
          .delete(importRows)
          .where(and(eq(importRows.tenantId, a.tenantId), eq(importRows.importId, j.id)));
        await tx
          .update(importJobs)
          .set({ records, status: 'uploaded', summary: {}, updatedAt: sql`clock_timestamp()` })
          .where(eq(importJobs.id, j.id));
      } else {
        if (b.values) throw new BadRequestException('Values are only accepted for a correction');
        if (
          b.resolution === 'reuse' &&
          (!row!.existingId ||
            row!.data.status === 'invalid' ||
            row!.data.issues.some((i) => i.code === 'duplicate_in_file'))
        )
          throw new BadRequestException(
            'Only valid existing matches can be reused; skip or correct this row',
          );
        await tx
          .update(importRows)
          .set({ resolution: b.resolution })
          .where(eq(importRows.id, row!.id));
        await tx
          .update(importIssues)
          .set({ resolvedAt: sql`clock_timestamp()` })
          .where(eq(importIssues.rowId, row!.id));
        await tx
          .update(importJobs)
          .set({ updatedAt: sql`clock_timestamp()` })
          .where(eq(importJobs.id, j.id));
      }
      await this.audit(
        a,
        j.id,
        'issue_resolved',
        { issueId, rowNumber: row!.rowNumber, resolution: b.resolution },
        tx,
      );
      return this.public(await this.row(a, j.id, tx));
    });
  }
  async commit(a: AuthenticatedPrincipal, id: string, version?: string) {
    const result = await this.db.transaction(async (tx) => {
      await this.lock(a, tx);
      const j = await this.row(a, id, tx);
      assertResourceMatches(version, j);
      if (j.status === 'committed') return this.public(j);
      this.mutable(j);
      if (j.status !== 'validated') throw new ConflictException('Validate the import first');
      const rows = await tx
        .select()
        .from(importRows)
        .where(and(eq(importRows.tenantId, a.tenantId), eq(importRows.importId, id)))
        .orderBy(importRows.rowNumber);
      if (
        rows.some(
          (r) =>
            r.resolution !== 'skip' &&
            (r.data.status === 'invalid' ||
              r.data.issues.some((i) => i.code === 'duplicate_in_file') ||
              (r.existingId && r.resolution !== 'reuse')),
        )
      )
        throw new ConflictException('Resolve invalid and duplicate rows before committing');
      const summary = {
        totalRows: rows.length,
        createdEstablishments: 0,
        reusedEstablishments: 0,
        createdContacts: 0,
        skippedRows: 0,
      };
      for (const row of rows) {
        if (row.resolution === 'skip') {
          summary.skippedRows++;
          await tx.update(importRows).set({ result: 'skipped' }).where(eq(importRows.id, row.id));
          continue;
        }
        const e = row.data.establishment!;
        await this.dedup.acquireExecutionLock(a.tenantId, e, tx);
        let establishment = await this.dedup.findExisting(a.tenantId, e, tx);
        if (establishment?.id !== (row.existingId ?? undefined))
          throw new ConflictException(
            'Duplicate matches changed; revalidate and review before committing',
          );
        const reused = Boolean(establishment);
        if (!establishment)
          establishment = await this.establishments.create(
            { tenantId: a.tenantId, ...e, source: 'import' },
            tx,
          );
        if (reused) summary.reusedEstablishments++;
        else summary.createdEstablishments++;
        let contactId: string | null = null;
        const c = row.data.contact;
        if (c) {
          let contact = await this.contactRepository.findImportDuplicate(
            a.tenantId,
            establishment.id,
            { email: c.email, phone: c.phone, name: c.name },
            tx,
          );
          if (!contact) {
            contact = await this.contacts.create(
              { tenantId: a.tenantId, establishmentId: establishment.id, ...c, source: 'import' },
              tx,
            );
            summary.createdContacts++;
          }
          contactId = contact.id;
        }
        await tx
          .update(importRows)
          .set({
            establishmentId: establishment.id,
            contactId,
            result: reused ? 'reused' : 'created',
          })
          .where(eq(importRows.id, row.id));
      }
      const [next] = await tx
        .update(importJobs)
        .set({ status: 'committed', summary, updatedAt: sql`clock_timestamp()` })
        .where(eq(importJobs.id, id))
        .returning();
      await this.audit(a, id, 'committed', summary, tx);
      return this.public(next!);
    });
    const summary = result.summary as Record<string, unknown> | null;
    const anomalyCount = Number(summary?.skippedRows ?? 0) + Number(summary?.failedRows ?? 0);
    if (anomalyCount > 0 && this.notificationEvents) {
      await this.notificationEvents.importAnomalies({
        tenantId: a.tenantId,
        importId: id,
        anomalyCount,
      });
    }
    return result;
  }
  async cancel(a: AuthenticatedPrincipal, id: string, version?: string) {
    return this.db.transaction(async (tx) => {
      await this.lock(a, tx);
      const j = await this.row(a, id, tx);
      assertResourceMatches(version, j);
      if (j.status === 'cancelled') return this.public(j);
      this.mutable(j);
      await tx
        .delete(importRows)
        .where(and(eq(importRows.tenantId, a.tenantId), eq(importRows.importId, id)));
      const [next] = await tx
        .update(importJobs)
        .set({
          status: 'cancelled',
          records: [],
          headers: [],
          mapping: {},
          updatedAt: sql`clock_timestamp()`,
        })
        .where(eq(importJobs.id, id))
        .returning();
      await this.audit(a, id, 'cancelled', {}, tx);
      return this.public(next!);
    });
  }
  async report(a: AuthenticatedPrincipal, id: string) {
    const j = await this.row(a, id);
    if (!['committed', 'cancelled'].includes(j.status))
      throw new ConflictException('Import has not finished');
    const rows = await this.db
      .select()
      .from(importRows)
      .where(and(eq(importRows.tenantId, a.tenantId), eq(importRows.importId, id)))
      .orderBy(importRows.rowNumber);
    const lines = [
      ['row', 'result', 'establishmentId', 'contactId', 'issues'],
      ...rows.map((r) => [
        r.rowNumber,
        r.result,
        r.establishmentId,
        r.contactId,
        r.data.issues.map((i) => i.message).join('; '),
      ]),
    ];
    return Buffer.from(
      lines.map((r) => r.map((v) => csvCell(sanitizeSpreadsheetValue(v))).join(',')).join('\r\n'),
      'utf8',
    );
  }
}
