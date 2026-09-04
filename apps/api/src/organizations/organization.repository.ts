import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { DATABASE } from '../database/database.constants.js';
import { NewOrganization, Organization, organizations } from '../database/schema/organizations.js';
import { Database } from '../database/database.types.js';

@Injectable()
export class OrganizationRepository {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,
  ) {}

  async create(input: NewOrganization): Promise<Organization> {
    const [organization] = await this.database.insert(organizations).values(input).returning();

    if (!organization) {
      throw new Error('Failed to create organization');
    }

    return organization;
  }

  async findById(tenantId: string, organizationId: string): Promise<Organization | null> {
    const [organization] = await this.database
      .select()
      .from(organizations)
      .where(and(eq(organizations.tenantId, tenantId), eq(organizations.id, organizationId)))
      .limit(1);

    return organization ?? null;
  }

  async findBySlug(tenantId: string, slug: string): Promise<Organization | null> {
    const [organization] = await this.database
      .select()
      .from(organizations)
      .where(and(eq(organizations.tenantId, tenantId), eq(organizations.slug, slug)))
      .limit(1);

    return organization ?? null;
  }

  async findByTenant(tenantId: string): Promise<Organization[]> {
    return this.database.select().from(organizations).where(eq(organizations.tenantId, tenantId));
  }
}
