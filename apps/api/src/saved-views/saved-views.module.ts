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
import { and, desc, eq, or, sql } from 'drizzle-orm';
import { AuthModule } from '../auth/auth.module.js';
import { DATABASE } from '../database/database.constants.js';
import { DatabaseModule } from '../database/database.module.js';
import type { Database } from '../database/database.types.js';
import { savedViews } from '../database/schema/index.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { CreateSavedViewDto, ListSavedViewsDto, UpdateSavedViewDto } from './saved-views.dto.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { Idempotent } from '../idempotency/idempotent.decorator.js';
type Auth = AuthenticatedPrincipal;
@Injectable()
export class SavedViewsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}
  private async own(a: Auth, id: string) {
    const [v] = await this.db
      .select()
      .from(savedViews)
      .where(
        and(
          eq(savedViews.tenantId, a.tenantId),
          eq(savedViews.id, id),
          or(eq(savedViews.ownerId, a.membershipId), eq(savedViews.shared, true)),
        ),
      );
    if (!v) throw new BadRequestException('Saved view not found');
    return v;
  }
  async list(a: Auth, resource?: string) {
    return this.db
      .select()
      .from(savedViews)
      .where(
        and(
          eq(savedViews.tenantId, a.tenantId),
          resource ? eq(savedViews.resource, resource) : undefined,
          or(eq(savedViews.ownerId, a.membershipId), eq(savedViews.shared, true)),
        ),
      )
      .orderBy(desc(savedViews.updatedAt));
  }
  async create(a: Auth, d: CreateSavedViewDto) {
    /* Validation has already checked shape and membership of the resource
     * set; this guards the one case it cannot express — an all-whitespace
     * name that passes MinLength but is empty once trimmed. */
    if (!d.name.trim()) throw new BadRequestException('Invalid saved view');
    if (d.name.trim().length > 120) throw new BadRequestException('View name is too long');
    const [v] = await this.db
      .insert(savedViews)
      .values({
        tenantId: a.tenantId,
        ownerId: a.membershipId,
        name: d.name.trim(),
        resource: d.resource,
        filters: d.filters,
        sort: d.sort ?? {},
        columns: d.columns,
        shared: Boolean(d.shared),
        isDefault: Boolean(d.isDefault),
      })
      .returning();
    return v;
  }
  async update(a: Auth, id: string, d: UpdateSavedViewDto) {
    const current = await this.own(a, id);
    if (current.ownerId !== a.membershipId)
      throw new BadRequestException('Only the owner can edit this view');
    /* Columns are named rather than copied from the body, so a field the
     * DTO does not declare can never reach the update. */
    const patch: Record<string, unknown> = { updatedAt: sql`clock_timestamp()` };
    if (d.name !== undefined) patch.name = d.name.trim();
    if (d.filters !== undefined) patch.filters = d.filters;
    if (d.sort !== undefined) patch.sort = d.sort;
    if (d.columns !== undefined) patch.columns = d.columns;
    if (d.shared !== undefined) patch.shared = d.shared;
    if (d.isDefault !== undefined) patch.isDefault = d.isDefault;
    if (patch.name === '') throw new BadRequestException('View name is required');
    const [v] = await this.db
      .update(savedViews)
      .set(patch)
      .where(
        and(
          eq(savedViews.tenantId, a.tenantId),
          eq(savedViews.id, id),
          eq(savedViews.ownerId, a.membershipId),
        ),
      )
      .returning();
    return v;
  }
  async remove(a: Auth, id: string) {
    const current = await this.own(a, id);
    if (current.ownerId !== a.membershipId)
      throw new BadRequestException('Only the owner can delete this view');
    await this.db
      .delete(savedViews)
      .where(
        and(
          eq(savedViews.tenantId, a.tenantId),
          eq(savedViews.id, id),
          eq(savedViews.ownerId, a.membershipId),
        ),
      );
  }
}
@Controller('saved-views')
@UseGuards(AuthGuard)
export class SavedViewsController {
  constructor(private readonly s: SavedViewsService) {}
  @Get() list(@CurrentAuth() a: Auth, @Query() q: ListSavedViewsDto) {
    return this.s.list(a, q.resource);
  }
  @Post() @Idempotent('saved_view.create') create(
    @CurrentAuth() a: Auth,
    @Body() d: CreateSavedViewDto,
  ) {
    return this.s.create(a, d);
  }
  @Patch(':viewId') update(
    @CurrentAuth() a: Auth,
    @Param('viewId', ParseUUIDPipe) id: string,
    @Body() d: UpdateSavedViewDto,
  ) {
    return this.s.update(a, id, d);
  }
  @Delete(':viewId') @HttpCode(204) remove(
    @CurrentAuth() a: Auth,
    @Param('viewId', ParseUUIDPipe) id: string,
  ) {
    return this.s.remove(a, id);
  }
}
@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [SavedViewsController],
  providers: [SavedViewsService],
})
export class SavedViewsModule {}
