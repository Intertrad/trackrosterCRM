import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Injectable,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import {
  accessReviewDecisions,
  accessReviews,
  complianceReports,
  tenantMemberships,
} from '../database/schema/index.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { Idempotent } from '../idempotency/idempotent.decorator.js';
type Auth = AuthenticatedPrincipal;
@Injectable()
export class ComplianceService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}
  private async admin(a: Auth) {
    const r = await this.db.execute(
      sql`SELECT 1 FROM user_access_grants WHERE tenant_id=${a.tenantId} AND user_id=${a.membershipId} AND scope_type='tenant' AND role='client_admin' LIMIT 1`,
    );
    if (!r.rows.length) throw new BadRequestException('Tenant administrator access required');
  }
  async reviews(a: Auth) {
    await this.admin(a);
    return this.db
      .select()
      .from(accessReviews)
      .where(eq(accessReviews.tenantId, a.tenantId))
      .orderBy(desc(accessReviews.createdAt));
  }
  async start(a: Auth) {
    await this.admin(a);
    const [r] = await this.db
      .insert(accessReviews)
      .values({ tenantId: a.tenantId, startedBy: a.membershipId, periodStart: new Date() })
      .returning();
    return r;
  }
  async review(a: Auth, id: string) {
    await this.admin(a);
    const [r] = await this.db
      .select()
      .from(accessReviews)
      .where(and(eq(accessReviews.tenantId, a.tenantId), eq(accessReviews.id, id)));
    if (!r) throw new BadRequestException('Access review not found');
    return r;
  }
  async members(a: Auth, id: string) {
    await this.review(a, id);
    return this.db
      .select({
        id: tenantMemberships.id,
        displayName: tenantMemberships.displayName,
        status: tenantMemberships.status,
        decision: accessReviewDecisions.decision,
        reason: accessReviewDecisions.reason,
      })
      .from(tenantMemberships)
      .leftJoin(
        accessReviewDecisions,
        and(
          eq(accessReviewDecisions.tenantId, a.tenantId),
          eq(accessReviewDecisions.reviewId, id),
          eq(accessReviewDecisions.membershipId, tenantMemberships.id),
        ),
      )
      .where(eq(tenantMemberships.tenantId, a.tenantId));
  }
  async decision(
    a: Auth,
    id: string,
    d: { membershipId: string; decision: 'approve' | 'revoke' | 'remediate'; reason?: string },
  ) {
    await this.review(a, id);
    if (!['approve', 'revoke', 'remediate'].includes(d.decision))
      throw new BadRequestException('Invalid decision');
    const [r] = await this.db
      .insert(accessReviewDecisions)
      .values({
        tenantId: a.tenantId,
        reviewId: id,
        membershipId: d.membershipId,
        reviewerId: a.membershipId,
        decision: d.decision,
        reason: d.reason,
      })
      .returning();
    return r;
  }
  async complete(a: Auth, id: string) {
    await this.review(a, id);
    const [r] = await this.db
      .update(accessReviews)
      .set({
        status: 'completed',
        completedAt: sql`clock_timestamp()`,
        periodEnd: sql`clock_timestamp()`,
      })
      .where(
        and(
          eq(accessReviews.tenantId, a.tenantId),
          eq(accessReviews.id, id),
          eq(accessReviews.status, 'open'),
        ),
      )
      .returning();
    if (!r) throw new BadRequestException('Review already completed');
    return r;
  }
  async reports(a: Auth) {
    await this.admin(a);
    return this.db
      .select()
      .from(complianceReports)
      .where(eq(complianceReports.tenantId, a.tenantId))
      .orderBy(desc(complianceReports.createdAt));
  }
  async createReport(a: Auth, d: { reportType: string; parameters?: Record<string, unknown> }) {
    await this.admin(a);
    if (!d.reportType?.trim()) throw new BadRequestException('reportType is required');
    const [r] = await this.db
      .insert(complianceReports)
      .values({
        tenantId: a.tenantId,
        requestedBy: a.membershipId,
        reportType: d.reportType,
        parameters: d.parameters ?? {},
        status: 'ready',
        completedAt: sql`clock_timestamp()`,
      })
      .returning();
    return r;
  }
  async report(a: Auth, id: string) {
    await this.admin(a);
    const [r] = await this.db
      .select()
      .from(complianceReports)
      .where(and(eq(complianceReports.tenantId, a.tenantId), eq(complianceReports.id, id)));
    if (!r) throw new BadRequestException('Compliance report not found');
    return r;
  }
  async download(a: Auth, id: string) {
    const r = await this.report(a, id);
    const expires = Math.floor(Date.now() / 1000) + 300;
    const secret = process.env.COMPLIANCE_DOWNLOAD_SECRET ?? process.env.JWT_ACCESS_SECRET;
    if (!secret) throw new BadRequestException('Download signing is not configured');
    const signature = createHmac('sha256', secret)
      .update(`${a.tenantId}:${r.id}:${expires}`)
      .digest('hex');
    return {
      reportId: r.id,
      downloadUrl: `/api/v1/compliance-reports/${r.id}/download?expires=${expires}&signature=${signature}`,
      expiresInSeconds: 300,
    };
  }
}
@Controller()
@UseGuards(AuthGuard)
export class ComplianceController {
  constructor(private readonly s: ComplianceService) {}
  @Get('access-reviews') reviews(@CurrentAuth() a: Auth) {
    return this.s.reviews(a);
  }
  @Post('access-reviews') @Idempotent('access-review.create') start(@CurrentAuth() a: Auth) {
    return this.s.start(a);
  }
  @Get('access-reviews/:reviewId') review(
    @CurrentAuth() a: Auth,
    @Param('reviewId', ParseUUIDPipe) id: string,
  ) {
    return this.s.review(a, id);
  }
  @Get('access-reviews/:reviewId/memberships') members(
    @CurrentAuth() a: Auth,
    @Param('reviewId', ParseUUIDPipe) id: string,
  ) {
    return this.s.members(a, id);
  }
  @Post('access-reviews/:reviewId/decisions') decision(
    @CurrentAuth() a: Auth,
    @Param('reviewId', ParseUUIDPipe) id: string,
    @Body() d: any,
  ) {
    return this.s.decision(a, id, d);
  }
  @Post('access-reviews/:reviewId/complete') @HttpCode(200) complete(
    @CurrentAuth() a: Auth,
    @Param('reviewId', ParseUUIDPipe) id: string,
  ) {
    return this.s.complete(a, id);
  }
  @Get('compliance-reports') reports(@CurrentAuth() a: Auth) {
    return this.s.reports(a);
  }
  @Post('compliance-reports') @Idempotent('compliance-report.create') create(
    @CurrentAuth() a: Auth,
    @Body() d: any,
  ) {
    return this.s.createReport(a, d);
  }
  @Get('compliance-reports/:reportId') report(
    @CurrentAuth() a: Auth,
    @Param('reportId', ParseUUIDPipe) id: string,
  ) {
    return this.s.report(a, id);
  }
  @Get('compliance-reports/:reportId/download') download(
    @CurrentAuth() a: Auth,
    @Param('reportId', ParseUUIDPipe) id: string,
  ) {
    return this.s.download(a, id);
  }
}
@Module({ controllers: [ComplianceController], providers: [ComplianceService] })
export class ComplianceModule {}
