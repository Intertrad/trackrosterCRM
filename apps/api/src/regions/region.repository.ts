import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';

import { DATABASE } from '../database/database.constants.js';
import type { Database, DatabaseExecutor } from '../database/database.types.js';
import { regions, type NewRegion, type Region } from '../database/schema/regions.js';

export type UpdateRegion = Partial<
  Pick<Region, 'name' | 'code' | 'type' | 'parentRegionId' | 'status'>
>;

@Injectable()
export class RegionRepository {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,
  ) {}

  async create(input: NewRegion, executor: DatabaseExecutor = this.database): Promise<Region> {
    const [region] = await executor.insert(regions).values(input).returning();

    if (!region) {
      throw new Error('Failed to create region');
    }

    return region;
  }

  async findById(
    tenantId: string,
    regionId: string,
    executor: DatabaseExecutor = this.database,
  ): Promise<Region | null> {
    const [region] = await executor
      .select()
      .from(regions)
      .where(and(eq(regions.tenantId, tenantId), eq(regions.id, regionId)))
      .limit(1);

    return region ?? null;
  }

  async findByCode(
    tenantId: string,
    code: string,
    executor: DatabaseExecutor = this.database,
  ): Promise<Region | null> {
    const [region] = await executor
      .select()
      .from(regions)
      .where(and(eq(regions.tenantId, tenantId), eq(regions.code, code)))
      .limit(1);

    return region ?? null;
  }

  async findByTenant(
    tenantId: string,
    executor: DatabaseExecutor = this.database,
  ): Promise<Region[]> {
    return executor
      .select()
      .from(regions)
      .where(eq(regions.tenantId, tenantId))
      .orderBy(asc(regions.createdAt), asc(regions.id));
  }

  async findChildren(
    tenantId: string,
    parentRegionId: string,
    executor: DatabaseExecutor = this.database,
  ): Promise<Region[]> {
    return executor
      .select()
      .from(regions)
      .where(and(eq(regions.tenantId, tenantId), eq(regions.parentRegionId, parentRegionId)))
      .orderBy(asc(regions.name), asc(regions.id));
  }

  async update(
    tenantId: string,
    regionId: string,
    input: UpdateRegion,
    executor: DatabaseExecutor = this.database,
  ): Promise<Region | null> {
    const [region] = await executor
      .update(regions)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(and(eq(regions.tenantId, tenantId), eq(regions.id, regionId)))
      .returning();

    return region ?? null;
  }
}
