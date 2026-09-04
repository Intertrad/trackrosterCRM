import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { DATABASE } from '../database/database.constants.js';
import { NewTenant, Tenant, tenants } from '../database/schema/tenants.js';
import { Database } from '../database/database.types.js';

@Injectable()
export class TenantRepository {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,
  ) {}

  async create(input: NewTenant): Promise<Tenant> {
    const [tenant] = await this.database.insert(tenants).values(input).returning();

    if (!tenant) {
      throw new Error('Failed to create tenant');
    }

    return tenant;
  }

  async findById(id: string): Promise<Tenant | null> {
    const [tenant] = await this.database.select().from(tenants).where(eq(tenants.id, id)).limit(1);

    return tenant ?? null;
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    const [tenant] = await this.database
      .select()
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1);

    return tenant ?? null;
  }
}
