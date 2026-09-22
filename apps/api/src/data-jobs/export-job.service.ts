import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  PayloadTooLargeException,
} from '@nestjs/common';
import { and, eq, gt, sql } from 'drizzle-orm';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { DATABASE } from '../database/database.constants.js';
import type { Database, DatabaseExecutor } from '../database/database.types.js';
import { auditEvents, exportJobs, tenants } from '../database/schema/index.js';
import { ControlledExportService } from '../exports/controlled-export.service.js';
import { ControlledExportRepository } from '../exports/controlled-export.repository.js';
import { ControlledExportSerializerService } from '../exports/controlled-export-serializer.service.js';
import { CONTROLLED_EXPORT_COLUMNS } from '../exports/export-columns.js';
import { MAX_CONTROLLED_EXPORT_ROWS } from '../exports/export.types.js';
import { ManagerDashboardScopeService } from '../reporting/manager-dashboard-scope.service.js';
import { resourceETag } from '../http/resource-etag.js';
import { ExportRequestDto, JobListDto } from './data-jobs.dto.js';
type Actor = Pick<AuthenticatedPrincipal, 'tenantId' | 'membershipId'>;
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
@Injectable()
export class ExportJobService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly legacy: ControlledExportService,
    private readonly scopes: ManagerDashboardScopeService,
    private readonly repository: ControlledExportRepository,
    private readonly serializer: ControlledExportSerializerService,
  ) {}
  onModuleInit() {
    if (process.env.DATA_JOBS_POLLING !== 'off') {
      this.timer = setInterval(() => {
        void this.drain().catch(() => undefined);
      }, 5000);
      this.timer.unref();
    }
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async authority(a: Actor, tx: DatabaseExecutor = this.db) {
    const result = await tx.execute<{
      id: string;
      role: string;
      organization_id: string | null;
      team_id: string | null;
    }>(
      sql`SELECT g.id,g.role,g.organization_id,g.team_id FROM user_access_grants g JOIN tenant_memberships m ON m.tenant_id=g.tenant_id AND m.id=g.user_id JOIN identities i ON i.id=m.identity_id WHERE g.tenant_id=${a.tenantId} AND g.user_id=${a.membershipId} AND m.status='active' AND i.status='active' AND ((g.role='client_admin' AND g.scope_type='tenant') OR (g.role='director' AND g.scope_type='organization') OR (g.role='manager' AND g.scope_type='team')) AND (g.role='client_admin' OR NOT EXISTS(SELECT 1 FROM tenant_role_permissions p WHERE p.tenant_id=g.tenant_id AND p.role=g.role::text) OR EXISTS(SELECT 1 FROM tenant_role_permissions p WHERE p.tenant_id=g.tenant_id AND p.role=g.role::text AND p.permissions ? 'exports.create')) ORDER BY g.id`,
    );
    if (!result.rows.length) throw new ForbiddenException('Export permission required');
    return { grants: result.rows, hash: hash(JSON.stringify(result.rows)) };
  }
  private async lock(a: Actor, tx: DatabaseExecutor) {
    await tx
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, a.tenantId))
      .for('no key update');
  }
  private body(raw: Record<string, unknown>): ExportRequestDto {
    return {
      ...raw,
      format: raw.format ?? 'csv',
      from: raw.from ? new Date(raw.from as string) : undefined,
      to: raw.to ? new Date(raw.to as string) : undefined,
    } as ExportRequestDto;
  }
  private async prepare(a: Actor, b: ExportRequestDto, id: string = randomUUID()) {
    const authority = await this.authority(a);
    const range = this.legacy.resolveRange(b, new Date()),
      filters = this.legacy.buildFilters(b);
    const scope = await this.scopes.resolve({
      tenantId: a.tenantId,
      userId: a.membershipId,
      filters,
    });
    if (
      !authority.grants.some(
        (g) =>
          g.role === 'client_admin' ||
          (g.role === scope.authority &&
            g.organization_id === scope.organizationId &&
            (g.role !== 'manager' || g.team_id === scope.teamId)),
      )
    )
      throw new ForbiddenException('Export permission is unavailable in the selected scope');
    const allowed = CONTROLLED_EXPORT_COLUMNS[b.type];
    if (!allowed) throw new BadRequestException('Unsupported export type');
    const fields = b.fields ?? allowed.map((c) => c.key);
    if (!fields.length || fields.some((f) => !allowed.some((c) => c.key === f)))
      throw new BadRequestException('Choose supported export fields');
    const request = {
      tenantId: a.tenantId,
      actorUserId: a.membershipId,
      exportId: id,
      type: b.type,
      format: b.format,
      generatedAt: new Date(),
      range,
      scope,
      filters,
    };
    const rows = await this.repository.findRows(request);
    if (rows.length > MAX_CONTROLLED_EXPORT_ROWS)
      throw new PayloadTooLargeException('Export exceeds 10000 rows; narrow the filters');
    return { authority, request, rows, fields };
  }
  private public(j: typeof exportJobs.$inferSelect) {
    const { contentBase64, downloadHash, leaseId, authorityHash, ...rest } = j;
    void contentBase64;
    void downloadHash;
    void leaseId;
    void authorityHash;
    return {
      ...rest,
      status: j.expiresAt && j.expiresAt.getTime() <= Date.now() ? 'expired' : j.status,
      etag: resourceETag(rest),
    };
  }
  async row(a: Actor, id: string, tx: DatabaseExecutor = this.db) {
    const [j] = await tx
      .select()
      .from(exportJobs)
      .where(
        and(
          eq(exportJobs.tenantId, a.tenantId),
          eq(exportJobs.requesterId, a.membershipId),
          eq(exportJobs.id, id),
        ),
      );
    if (!j) throw new NotFoundException('Export not found');
    const authority = await this.authority(a, tx);
    if (authority.hash !== j.authorityHash)
      throw new ForbiddenException('Export authority changed; request a new export');
    return j;
  }
  async preview(a: Actor, b: ExportRequestDto) {
    const p = await this.prepare(a, b);
    return {
      type: b.type,
      format: b.format,
      fields: p.fields,
      estimatedRows: p.rows.length,
      scope: p.request.scope,
      from: p.request.range.from,
      to: p.request.range.to,
      warnings: ['Row count is advisory; data and permission are rechecked when processed.'],
      maximumRows: MAX_CONTROLLED_EXPORT_ROWS,
    };
  }
  async create(a: Actor, b: ExportRequestDto) {
    const p = await this.prepare(a, b);
    return this.db.transaction(async (tx) => {
      await this.lock(a, tx);
      const authority = await this.authority(a, tx);
      if (authority.hash !== p.authority.hash)
        throw new ForbiddenException('Export authority changed');
      const [j] = await tx
        .insert(exportJobs)
        .values({
          tenantId: a.tenantId,
          requesterId: a.membershipId,
          authorityHash: authority.hash,
          request: {
            ...b,
            from: p.request.range.from.toISOString(),
            to: p.request.range.to.toISOString(),
            fields: p.fields,
          },
        })
        .returning();
      await this.audit(
        a,
        j!.id,
        'requested',
        { type: b.type, format: b.format, scope: p.request.scope, fields: p.fields },
        tx,
      );
      return this.public(j!);
    });
  }
  async list(a: Actor, q: JobListDto) {
    const authority = await this.authority(a);
    const rows = await this.db
      .select()
      .from(exportJobs)
      .where(
        and(
          eq(exportJobs.tenantId, a.tenantId),
          eq(exportJobs.requesterId, a.membershipId),
          eq(exportJobs.authorityHash, authority.hash),
          q.cursor ? gt(exportJobs.id, q.cursor) : undefined,
        ),
      )
      .orderBy(exportJobs.id)
      .limit(q.limit + 1);
    return {
      items: rows.slice(0, q.limit).map((j) => this.public(j)),
      nextCursor: rows.length > q.limit ? rows[q.limit - 1]!.id : null,
    };
  }
  async detail(a: Actor, id: string) {
    return this.public(await this.row(a, id));
  }
  private async audit(
    a: Actor,
    id: string,
    action: string,
    metadata: Record<string, unknown>,
    tx: DatabaseExecutor,
  ) {
    await tx.insert(auditEvents).values({
      tenantId: a.tenantId,
      actorType: 'user',
      actorUserId: a.membershipId,
      resourceType: 'export_job',
      resourceId: id,
      action: `export_job.${action}`,
      metadata,
    });
  }
  async cancel(a: Actor, id: string) {
    return this.db.transaction(async (tx) => {
      await this.lock(a, tx);
      const j = await this.row(a, id, tx);
      const [cancelled] = await tx
        .update(exportJobs)
        .set({ status: 'cancelled', updatedAt: sql`clock_timestamp()` })
        .where(and(eq(exportJobs.id, id), eq(exportJobs.status, 'queued')))
        .returning();
      if (!cancelled) {
        if (j.status === 'cancelled') return this.public(j);
        throw new ConflictException('Only queued exports can be cancelled');
      }
      await this.audit(a, id, 'cancelled', {}, tx);
      return this.public(cancelled);
    });
  }
  async download(a: Actor, id: string) {
    return this.db.transaction(async (tx) => {
      await this.lock(a, tx);
      const j = await this.row(a, id, tx);
      if (j.status !== 'completed' || !j.expiresAt || j.expiresAt.getTime() <= Date.now())
        throw new ConflictException('Export file is not available');
      const token = randomBytes(32).toString('base64url'),
        expiresAt = new Date(Math.min(Date.now() + 5 * 60 * 1000, j.expiresAt.getTime()));
      await tx
        .update(exportJobs)
        .set({ downloadHash: hash(token), downloadExpiresAt: expiresAt })
        .where(eq(exportJobs.id, id));
      await this.audit(a, id, 'download_issued', { expiresAt: expiresAt.toISOString() }, tx);
      return { url: `/api/v1/exports/${id}/file?token=${token}`, expiresAt, filename: j.filename };
    });
  }
  async file(a: Actor, id: string, token: string) {
    return this.db.transaction(async (tx) => {
      await this.lock(a, tx);
      const j = await this.row(a, id, tx);
      if (
        j.status !== 'completed' ||
        !j.contentBase64 ||
        !j.expiresAt ||
        j.expiresAt.getTime() <= Date.now() ||
        !j.downloadExpiresAt ||
        j.downloadExpiresAt.getTime() <= Date.now() ||
        j.downloadHash !== hash(token)
      )
        throw new NotFoundException('Download link is invalid or expired');
      await this.audit(a, id, 'downloaded', { rowCount: j.rowCount }, tx);
      return {
        content: Buffer.from(j.contentBase64, 'base64'),
        filename: j.filename!,
        contentType: j.contentType!,
      };
    });
  }
  async auditHistory(a: Actor, id: string, q: JobListDto) {
    const j = await this.row(a, id);
    const rows = await this.db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.tenantId, a.tenantId),
          eq(auditEvents.resourceType, 'export_job'),
          eq(auditEvents.resourceId, id),
          q.cursor ? gt(auditEvents.id, q.cursor) : undefined,
        ),
      )
      .orderBy(auditEvents.id)
      .limit(q.limit + 1);
    return {
      requesterId: j.requesterId,
      request: j.request,
      items: rows.slice(0, q.limit),
      nextCursor: rows.length > q.limit ? rows[q.limit - 1]!.id : null,
    };
  }
  async drain() {
    if (this.running) return;
    this.running = true;
    try {
      await this.db
        .update(exportJobs)
        .set({ status: 'expired', contentBase64: null, downloadHash: null })
        .where(
          sql`${exportJobs.status}='completed' AND ${exportJobs.expiresAt}<=clock_timestamp()`,
        );
      const job = await this.db.transaction(async (tx) => {
        const [j] = await tx
          .select()
          .from(exportJobs)
          .where(
            sql`${exportJobs.status}='queued' OR (${exportJobs.status}='processing' AND ${exportJobs.leaseUntil}<clock_timestamp())`,
          )
          .orderBy(exportJobs.createdAt)
          .limit(1)
          .for('update', { skipLocked: true });
        if (!j) return null;
        if (j.attempts >= 3) {
          await tx
            .update(exportJobs)
            .set({ status: 'failed', failureCode: 'RETRY_LIMIT', leaseId: null, leaseUntil: null })
            .where(eq(exportJobs.id, j.id));
          return null;
        }
        const [claimed] = await tx
          .update(exportJobs)
          .set({
            status: 'processing',
            attempts: j.attempts + 1,
            leaseId: randomUUID(),
            leaseUntil: new Date(Date.now() + 5 * 60 * 1000),
            updatedAt: sql`clock_timestamp()`,
          })
          .where(eq(exportJobs.id, j.id))
          .returning();
        return claimed!;
      });
      if (!job) return;
      const actor = { tenantId: job.tenantId, membershipId: job.requesterId };
      try {
        const plan = await this.prepare(actor, this.body(job.request), job.id);
        if (plan.authority.hash !== job.authorityHash)
          throw new ForbiddenException('Export authority changed');
        const file = await this.serializer.serialize({
          exportId: job.id,
          type: plan.request.type,
          format: plan.request.format,
          generatedAt: plan.request.generatedAt,
          rows: plan.rows,
          fields: plan.fields,
        });
        if (file.content.length > 20 * 1024 * 1024)
          throw new PayloadTooLargeException('Export file exceeds 20 MiB');
        await this.db.transaction(async (tx) => {
          await this.lock(actor, tx);
          const authority = await this.authority(actor, tx);
          if (authority.hash !== job.authorityHash)
            throw new ForbiddenException('Export authority changed');
          const [saved] = await tx
            .update(exportJobs)
            .set({
              status: 'completed',
              filename: file.filename,
              contentType: file.contentType,
              contentBase64: file.content.toString('base64'),
              rowCount: file.rowCount,
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
              leaseId: null,
              leaseUntil: null,
              updatedAt: sql`clock_timestamp()`,
            })
            .where(
              and(
                eq(exportJobs.id, job.id),
                eq(exportJobs.status, 'processing'),
                eq(exportJobs.leaseId, job.leaseId!),
              ),
            )
            .returning();
          if (saved)
            await this.audit(
              actor,
              job.id,
              'completed',
              { rowCount: file.rowCount, scope: plan.request.scope, fields: plan.fields },
              tx,
            );
        });
      } catch (e) {
        await this.db
          .update(exportJobs)
          .set({
            status: 'failed',
            failureCode:
              e instanceof ForbiddenException
                ? 'AUTHORIZATION_CHANGED'
                : e instanceof PayloadTooLargeException
                  ? 'EXPORT_LIMIT'
                  : 'GENERATION_FAILED',
            leaseId: null,
            leaseUntil: null,
            contentBase64: null,
            updatedAt: sql`clock_timestamp()`,
          })
          .where(
            and(
              eq(exportJobs.id, job.id),
              eq(exportJobs.status, 'processing'),
              eq(exportJobs.leaseId, job.leaseId!),
            ),
          );
      }
    } finally {
      this.running = false;
    }
  }
}
