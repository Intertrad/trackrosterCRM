import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Injectable,
  Module,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { and, count, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { campaigns, establishments, organizations } from '../database/schema/index.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { DatabaseModule } from '../database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';

export class SearchQuery {
  @IsString() @MaxLength(120) q!: string;
  @IsOptional() @IsIn(['all', 'prospect', 'organization', 'campaign']) type?: string;
  @IsOptional() @IsString() cursor?: string;
  @IsOptional() limit?: number;
}

type Auth = { tenantId: string; membershipId?: string };

@Injectable()
export class SearchService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}
  async search(auth: Auth, query: SearchQuery) {
    const q = query.q.trim();
    if (q.length < 2)
      throw new BadRequestException('Search query must contain at least 2 characters');
    const limit = Math.min(Math.max(Number(query.limit) || 25, 1), 100);
    const pattern = `%${q}%`;
    const rows: Array<{
      id: string;
      type: string;
      title: string;
      subtitle: string | null;
      updatedAt: Date;
    }> = [];
    if (!query.type || query.type === 'all' || query.type === 'prospect') {
      const found = await this.db
        .select({
          id: establishments.id,
          title: establishments.name,
          subtitle: establishments.city,
          updatedAt: establishments.updatedAt,
        })
        .from(establishments)
        .where(
          and(
            eq(establishments.tenantId, auth.tenantId),
            or(ilike(establishments.name, pattern), ilike(establishments.city, pattern)),
            visibleEstablishment(auth),
          ),
        )
        .orderBy(desc(establishments.updatedAt))
        .limit(limit);
      rows.push(...found.map((r) => ({ ...r, type: 'prospect' })));
    }
    if (!query.type || query.type === 'all' || query.type === 'organization') {
      const found = await this.db
        .select({
          id: organizations.id,
          title: organizations.name,
          subtitle: organizations.slug,
          updatedAt: organizations.updatedAt,
        })
        .from(organizations)
        .where(
          and(
            eq(organizations.tenantId, auth.tenantId),
            or(ilike(organizations.name, pattern), ilike(organizations.slug, pattern)),
            visibleOrganization(auth),
          ),
        )
        .orderBy(desc(organizations.updatedAt))
        .limit(limit);
      rows.push(...found.map((r) => ({ ...r, type: 'organization' })));
    }
    if (!query.type || query.type === 'all' || query.type === 'campaign') {
      const found = await this.db
        .select({
          id: campaigns.id,
          title: campaigns.name,
          subtitle: campaigns.status,
          updatedAt: campaigns.updatedAt,
        })
        .from(campaigns)
        .where(
          and(
            eq(campaigns.tenantId, auth.tenantId),
            or(ilike(campaigns.name, pattern), ilike(campaigns.description, pattern)),
            visibleCampaign(auth),
          ),
        )
        .orderBy(desc(campaigns.updatedAt))
        .limit(limit);
      rows.push(...found.map((r) => ({ ...r, type: 'campaign' })));
    }
    rows.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || a.id.localeCompare(b.id));
    return {
      items: rows.slice(0, limit),
      nextCursor: rows.length > limit ? rows[limit - 1]!.updatedAt.toISOString() : null,
    };
  }

  async facets(auth: Auth, query: Pick<SearchQuery, 'q'>) {
    const q = query.q.trim();
    if (q.length < 2)
      throw new BadRequestException('Search query must contain at least 2 characters');
    const pattern = `%${q}%`;
    const prospects = await this.db
      .select({ value: count() })
      .from(establishments)
      .where(
        and(
          eq(establishments.tenantId, auth.tenantId),
          or(ilike(establishments.name, pattern), ilike(establishments.city, pattern)),
          visibleEstablishment(auth),
        ),
      );
    const organizationsCount = await this.db
      .select({ value: count() })
      .from(organizations)
      .where(
        and(
          eq(organizations.tenantId, auth.tenantId),
          or(ilike(organizations.name, pattern), ilike(organizations.slug, pattern)),
          visibleOrganization(auth),
        ),
      );
    const campaignsCount = await this.db
      .select({ value: count() })
      .from(campaigns)
      .where(
        and(
          eq(campaigns.tenantId, auth.tenantId),
          or(ilike(campaigns.name, pattern), ilike(campaigns.description, pattern)),
          visibleCampaign(auth),
        ),
      );
    return {
      query: q,
      facets: [
        { type: 'prospect', count: Number(prospects[0]?.value ?? 0) },
        { type: 'organization', count: Number(organizationsCount[0]?.value ?? 0) },
        { type: 'campaign', count: Number(campaignsCount[0]?.value ?? 0) },
      ],
    };
  }
}

/*
 * Search results must follow the same assignment boundary as the work queue.
 * Keeping this predicate in the API prevents a hidden or hand-crafted search
 * request from bypassing the Prospector scope enforced by the UI.
 */
function visibleAssignment(auth: Auth, relation: SQL): SQL {
  return sql`EXISTS (
    SELECT 1
    FROM campaign_prospects cp
    JOIN campaign_prospect_assignments a
      ON a.tenant_id = cp.tenant_id
      AND a.campaign_prospect_id = cp.id
      AND a.ended_at IS NULL
      AND a.status IN ('active', 'paused')
    WHERE cp.tenant_id = ${auth.tenantId}
      AND ${relation}
      AND cp.status = 'active'
      AND EXISTS (
        SELECT 1
        FROM user_access_grants g
        WHERE g.tenant_id = cp.tenant_id
          AND g.user_id = ${auth.membershipId ?? null}
          AND (
            (g.role = 'client_admin' AND g.scope_type = 'tenant')
            OR (g.role = 'observer' AND g.scope_type = 'tenant')
            OR (g.role = 'observer' AND g.scope_type = 'organization' AND g.organization_id = a.organization_id)
            OR (g.role = 'observer' AND g.scope_type = 'team' AND g.team_id = a.team_id)
            OR (g.role = 'director' AND g.scope_type = 'organization' AND g.organization_id = a.organization_id)
            OR (g.role = 'manager' AND g.scope_type = 'team' AND g.team_id = a.team_id)
            OR (g.role = 'prospector' AND g.scope_type = 'team' AND g.team_id = a.team_id AND a.assigned_user_id = ${auth.membershipId ?? null})
          )
      )
  )`;
}

function visibleEstablishment(auth: Auth): SQL {
  return visibleAssignment(auth, sql`cp.establishment_id = ${establishments.id}`);
}

function visibleOrganization(auth: Auth): SQL {
  return visibleAssignment(auth, sql`a.organization_id = ${organizations.id}`);
}

function visibleCampaign(auth: Auth): SQL {
  return visibleAssignment(auth, sql`a.campaign_id = ${campaigns.id}`);
}

@Controller('search')
@UseGuards(AuthGuard)
export class SearchController {
  constructor(private readonly service: SearchService) {}
  @Get('facets') facets(@CurrentAuth() auth: Auth, @Query() query: SearchQuery) {
    return this.service.facets(auth, query);
  }

  @Get() search(@CurrentAuth() auth: Auth, @Query() query: SearchQuery) {
    return this.service.search(auth, query);
  }
}

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
