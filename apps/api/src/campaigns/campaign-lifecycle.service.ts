import { AuditService } from '../audit/audit.service.js';
import { enforceDomainRestriction } from '../permissions/domain-permissions.js';
import { enforceScopeDenials } from '../permissions/scope-denial-policy.js';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import type { Database, DatabaseExecutor } from '../database/database.types.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { campaigns, organizations, tenants } from '../database/schema/index.js';
import type { CampaignStatus } from '../database/schema/campaigns.js';
import {
  ResourceScopeService,
  resourceScopePredicate,
} from '../resource-scopes/resource-scope.service.js';
import { assertResourceMatches } from '../http/resource-etag.js';
import type { CreateCampaignDto } from './dto/create-campaign.dto.js';
import type { UpdateCampaignDto } from './dto/update-campaign.dto.js';
export const CAMPAIGN_TRANSITIONS: Record<CampaignStatus, readonly CampaignStatus[]> = {
  draft: ['active', 'archived'],
  active: ['paused', 'completed', 'archived'],
  paused: ['active', 'completed', 'archived'],
  completed: ['archived'],
  archived: [],
};
@Injectable()
export class CampaignLifecycleService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scopes: ResourceScopeService,
    private readonly audit: AuditService,
  ) {}
  private async lock(a: AuthenticatedPrincipal, tx: DatabaseExecutor) {
    await tx
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, a.tenantId))
      .for('update');
    const active = await tx.execute(
      sql`SELECT 1 FROM tenant_memberships m JOIN identities i ON i.id=m.identity_id JOIN tenants t ON t.id=m.tenant_id WHERE m.tenant_id=${a.tenantId} AND m.id=${a.membershipId} AND m.status='active' AND i.status='active' AND t.status='active'`,
    );
    if (!active.rows.length) throw new ForbiddenException('Active workspace membership required');
    await enforceScopeDenials(tx, a, '/campaigns', 'POST');
    await enforceDomainRestriction(tx, a, 'campaigns.manage');
  }
  private dates(start: Date | null, end: Date | null) {
    if (start && end && end < start)
      throw new BadRequestException('Campaign end date cannot be before start date');
  }
  private name(name: string) {
    const value = name.trim();
    if (!value) throw new BadRequestException('Campaign name is required');
    return value;
  }
  async create(a: AuthenticatedPrincipal, input: CreateCampaignDto) {
    const name = this.name(input.name);
    this.dates(input.startsAt ?? null, input.endsAt ?? null);
    return this.db.transaction(async (tx) => {
      await this.lock(a, tx);
      const authority = await tx.execute(
        sql`SELECT 1 FROM user_access_grants g JOIN tenant_memberships m ON m.tenant_id=g.tenant_id AND m.id=g.user_id JOIN identities i ON i.id=m.identity_id WHERE g.tenant_id=${a.tenantId} AND g.user_id=${a.membershipId} AND g.role='client_admin' AND g.scope_type='tenant' AND m.status='active' AND i.status='active'`,
      );
      if (!authority.rows.length)
        throw new ForbiddenException('Tenant administrator access required');
      const [org] = await tx
        .select()
        .from(organizations)
        .where(
          and(eq(organizations.tenantId, a.tenantId), eq(organizations.id, input.organizationId)),
        )
        .for('share');
      if (!org) throw new NotFoundException('Organization not found');
      if (org.status !== 'active') throw new ConflictException('Campaign organization is inactive');
      const [row] = await tx
        .insert(campaigns)
        .values({
          tenantId: a.tenantId,
          organizationId: input.organizationId,
          name,
          description: input.description?.trim() || null,
          startsAt: input.startsAt ?? null,
          endsAt: input.endsAt ?? null,
          status: 'draft',
        })
        .returning();
      await this.audit.record(
        {
          tenantId: a.tenantId,
          actorType: 'user',
          actorUserId: a.membershipId,
          action: 'campaign.created',
          resourceType: 'campaign',
          resourceId: row!.id,
          metadata: { organizationId: row!.organizationId, status: 'draft' },
        },
        tx,
      );
      return this.scopes.getCampaign(a, row!.id, tx);
    });
  }
  async update(
    a: AuthenticatedPrincipal,
    id: string,
    input: UpdateCampaignDto,
    ifMatch?: string,
    reason?: string,
  ) {
    if (!Object.values(input).some((v) => v !== undefined))
      throw new BadRequestException('At least one campaign field is required');
    if (input.name !== undefined) this.name(input.name);
    return this.db.transaction(async (tx) => {
      await this.lock(a, tx);
      const [before] = await tx
        .select()
        .from(campaigns)
        .where(
          and(
            eq(campaigns.id, id),
            resourceScopePredicate(
              a,
              'campaign',
              input.status === undefined ? 'read_write' : 'manage',
            ),
          ),
        )
        .for('update');
      if (!before) throw new NotFoundException('Campaign not found');
      assertResourceMatches(ifMatch, await this.scopes.getCampaign(a, id, tx));
      const next = input.status ?? before.status;
      if (next !== before.status && !CAMPAIGN_TRANSITIONS[before.status].includes(next))
        throw new BadRequestException(
          `Campaign cannot transition from ${before.status} to ${next}`,
        );
      const metadataChange = Object.entries(input).some(
        ([k, v]) => k !== 'status' && v !== undefined,
      );
      if (before.status === 'archived' && metadataChange)
        throw new ConflictException('Archived campaigns are read-only');
      const startsAt = input.startsAt === undefined ? before.startsAt : input.startsAt;
      const endsAt = input.endsAt === undefined ? before.endsAt : input.endsAt;
      this.dates(startsAt, endsAt);
      if (next === 'active') {
        const [org] = await tx
          .select()
          .from(organizations)
          .where(
            and(
              eq(organizations.tenantId, a.tenantId),
              eq(organizations.id, before.organizationId),
            ),
          )
          .for('share');
        if (!org || org.status !== 'active')
          throw new ConflictException('Campaign organization is inactive');
      }
      if (next !== before.status && ['completed', 'archived'].includes(next)) {
        const open = await tx.execute(sql`SELECT
        (SELECT count(*)::int FROM campaign_prospect_assignments WHERE tenant_id=${a.tenantId} AND campaign_id=${id} AND ended_at IS NULL) assignments,
        (SELECT count(*)::int FROM actions WHERE tenant_id=${a.tenantId} AND campaign_id=${id} AND status IN ('planned','started')) actions,
        (SELECT count(*)::int FROM prospect_follow_ups WHERE tenant_id=${a.tenantId} AND campaign_id=${id} AND status='pending') follow_ups,
        (SELECT count(*)::int FROM reservation_records WHERE tenant_id=${a.tenantId} AND campaign_id=${id} AND status IN ('pending','active') AND expires_at>now()) reservations,
        (SELECT count(*)::int FROM override_requests r JOIN campaign_prospects cp ON cp.tenant_id=r.tenant_id AND cp.id=r.campaign_prospect_id WHERE r.tenant_id=${a.tenantId} AND cp.campaign_id=${id} AND r.status='pending') override_requests`);
        const counts = open.rows[0]!;
        if (Object.values(counts).some((n) => Number(n) > 0))
          throw new ConflictException({
            code: 'CAMPAIGN_HAS_OPEN_WORK',
            message: 'Resolve open campaign work before completion or archival',
          });
      }
      if (!metadataChange && next === before.status) return this.scopes.getCampaign(a, id, tx);
      await tx
        .update(campaigns)
        .set({
          ...(input.name !== undefined ? { name: this.name(input.name) } : {}),
          ...(input.description !== undefined
            ? { description: input.description?.trim() || null }
            : {}),
          startsAt,
          endsAt,
          status: next,
          updatedAt: sql`clock_timestamp()`,
        })
        .where(and(eq(campaigns.tenantId, a.tenantId), eq(campaigns.id, id)));
      await this.audit.record(
        {
          tenantId: a.tenantId,
          actorType: 'user',
          actorUserId: a.membershipId,
          action: next !== before.status ? 'campaign.status_changed' : 'campaign.updated',
          resourceType: 'campaign',
          resourceId: id,
          metadata: {
            organizationId: before.organizationId,
            previousStatus: before.status,
            status: next,
            reason: reason ?? null,
            changedFields: Object.keys(input).filter(
              (k) => input[k as keyof UpdateCampaignDto] !== undefined,
            ),
          },
        },
        tx,
      );
      return this.scopes.getCampaign(a, id, tx);
    });
  }
}
