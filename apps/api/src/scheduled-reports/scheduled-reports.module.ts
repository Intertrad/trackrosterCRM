import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Injectable,
  Module,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { AuthModule } from '../auth/auth.module.js';
import { DATABASE } from '../database/database.constants.js';
import { DatabaseModule } from '../database/database.module.js';
import type { Database } from '../database/database.types.js';
import { scheduledReportDeliveries, scheduledReports } from '../database/schema/index.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { Idempotent } from '../idempotency/idempotent.decorator.js';

type Auth = AuthenticatedPrincipal;
const keys = new Set([
  'overview',
  'workload',
  'actions',
  'funnel',
  'conversions',
  'follow-ups',
  'coverage',
  'collisions',
  'data-quality',
  'territories',
  'forecast',
]);
const cadences = new Set(['daily', 'weekly', 'monthly']);
const formats = new Set(['csv', 'xlsx', 'pdf']);
@Injectable()
export class ScheduledReportsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}
  private async owned(a: Auth, id: string) {
    const [r] = await this.db
      .select()
      .from(scheduledReports)
      .where(
        and(
          eq(scheduledReports.tenantId, a.tenantId),
          eq(scheduledReports.ownerId, a.membershipId),
          eq(scheduledReports.id, id),
        ),
      );
    if (!r) throw new BadRequestException('Scheduled report not found');
    return r;
  }
  async list(a: Auth, limit = 50, cursor?: string) {
    const rows = await this.db
      .select()
      .from(scheduledReports)
      .where(
        and(
          eq(scheduledReports.tenantId, a.tenantId),
          eq(scheduledReports.ownerId, a.membershipId),
          cursor ? gt(scheduledReports.id, cursor) : undefined,
        ),
      )
      .orderBy(desc(scheduledReports.updatedAt), desc(scheduledReports.id))
      .limit(Math.min(Math.max(limit, 1), 100) + 1);
    return {
      items: rows.slice(0, Math.min(Math.max(limit, 1), 100)),
      nextCursor:
        rows.length > Math.min(Math.max(limit, 1), 100) ? rows[rows.length - 2]!.id : null,
    };
  }
  async create(a: Auth, d: any) {
    if (
      !keys.has(d.reportKey) ||
      !cadences.has(d.cadence) ||
      !formats.has(d.format) ||
      !Array.isArray(d.recipients) ||
      !d.recipients.length
    )
      throw new BadRequestException('Invalid report schedule');
    const next = new Date(d.nextRunAt ?? Date.now());
    if (Number.isNaN(next.getTime()) || next.getTime() < Date.now())
      throw new BadRequestException('nextRunAt must be in the future');
    const [r] = await this.db
      .insert(scheduledReports)
      .values({
        tenantId: a.tenantId,
        ownerId: a.membershipId,
        reportKey: d.reportKey,
        cadence: d.cadence,
        format: d.format,
        recipients: d.recipients,
        filters: d.filters ?? {},
        timezone: d.timezone ?? 'UTC',
        nextRunAt: next,
      })
      .returning();
    return r;
  }
  async update(a: Auth, id: string, d: any) {
    await this.owned(a, id);
    const patch: any = { updatedAt: sql`clock_timestamp()` };
    if (d.cadence !== undefined) {
      if (!cadences.has(d.cadence)) throw new BadRequestException('Invalid cadence');
      patch.cadence = d.cadence;
    }
    if (d.format !== undefined) {
      if (!formats.has(d.format)) throw new BadRequestException('Invalid format');
      patch.format = d.format;
    }
    if (d.recipients !== undefined) {
      if (!Array.isArray(d.recipients) || !d.recipients.length)
        throw new BadRequestException('Recipients required');
      patch.recipients = d.recipients;
    }
    if (d.filters !== undefined) patch.filters = d.filters;
    if (d.timezone !== undefined) patch.timezone = d.timezone;
    if (d.nextRunAt !== undefined) patch.nextRunAt = new Date(d.nextRunAt);
    const [r] = await this.db
      .update(scheduledReports)
      .set(patch)
      .where(
        and(
          eq(scheduledReports.tenantId, a.tenantId),
          eq(scheduledReports.ownerId, a.membershipId),
          eq(scheduledReports.id, id),
        ),
      )
      .returning();
    return r;
  }
  async remove(a: Auth, id: string) {
    await this.owned(a, id);
    await this.db
      .update(scheduledReports)
      .set({ active: 0, updatedAt: sql`clock_timestamp()` })
      .where(eq(scheduledReports.id, id));
  }
  async deliveries(a: Auth, id: string, limit = 50) {
    await this.owned(a, id);
    return this.db
      .select()
      .from(scheduledReportDeliveries)
      .where(
        and(
          eq(scheduledReportDeliveries.tenantId, a.tenantId),
          eq(scheduledReportDeliveries.scheduleId, id),
        ),
      )
      .orderBy(desc(scheduledReportDeliveries.startedAt))
      .limit(Math.min(Math.max(limit, 1), 100));
  }
}
@Controller('scheduled-reports')
@UseGuards(AuthGuard)
export class ScheduledReportsController {
  constructor(private readonly s: ScheduledReportsService) {}
  @Get() list(@CurrentAuth() a: Auth, @Query('limit') l?: number, @Query('cursor') c?: string) {
    return this.s.list(a, l, c);
  }
  @Post() @Idempotent('scheduled_report.create') create(@CurrentAuth() a: Auth, @Body() d: any) {
    return this.s.create(a, d);
  }
  @Patch(':scheduleId') update(
    @CurrentAuth() a: Auth,
    @Param('scheduleId', ParseUUIDPipe) id: string,
    @Body() d: any,
  ) {
    return this.s.update(a, id, d);
  }
  @Delete(':scheduleId') @HttpCode(204) remove(
    @CurrentAuth() a: Auth,
    @Param('scheduleId', ParseUUIDPipe) id: string,
  ) {
    return this.s.remove(a, id);
  }
  @Get(':scheduleId/deliveries') deliveries(
    @CurrentAuth() a: Auth,
    @Param('scheduleId', ParseUUIDPipe) id: string,
    @Query('limit') l?: number,
  ) {
    return this.s.deliveries(a, id, l);
  }
}
@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [ScheduledReportsController],
  providers: [ScheduledReportsService],
})
export class ScheduledReportsModule {}
