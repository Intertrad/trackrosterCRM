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
import { and, count, desc, ilike, or, eq } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { campaigns, establishments, organizations } from '../database/schema/index.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { DatabaseModule } from '../database/database.module.js';

export class SearchQuery {
  @IsString() @MaxLength(120) q!: string;
  @IsOptional() @IsIn(['all', 'prospect', 'organization', 'campaign']) type?: string;
  @IsOptional() @IsString() cursor?: string;
  @IsOptional() limit?: number;
}

type Auth = { tenantId: string };

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
    const [prospects, organizationsCount, campaignsCount] = await Promise.all([
      this.db
        .select({ value: count() })
        .from(establishments)
        .where(
          and(
            eq(establishments.tenantId, auth.tenantId),
            or(ilike(establishments.name, pattern), ilike(establishments.city, pattern)),
          ),
        ),
      this.db
        .select({ value: count() })
        .from(organizations)
        .where(
          and(
            eq(organizations.tenantId, auth.tenantId),
            or(ilike(organizations.name, pattern), ilike(organizations.slug, pattern)),
          ),
        ),
      this.db
        .select({ value: count() })
        .from(campaigns)
        .where(
          and(
            eq(campaigns.tenantId, auth.tenantId),
            or(ilike(campaigns.name, pattern), ilike(campaigns.description, pattern)),
          ),
        ),
    ]);
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

@Module({ imports: [DatabaseModule], controllers: [SearchController], providers: [SearchService] })
export class SearchModule {}
