import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { DATABASE } from '../database/database.constants.js';
import { NewOrganization, Organization, organizations } from '../database/schema/organizations.js';
import { Database, DatabaseExecutor } from '../database/database.types.js';
import { currentTenantExecutor } from '../database/request-tenant-executor.js';
import { withTenantContext } from '../database/tenant-context.js';

@Injectable()
export class OrganizationRepository {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,
  ) {}

  async create(input: NewOrganization): Promise<Organization> {
    if (!currentTenantExecutor())
      return withTenantContext(this.database, input.tenantId, (tx) =>
        this.createWithExecutor(input, tx),
      );
    return this.createWithExecutor(input, this.database);
  }

  private async createWithExecutor(
    input: NewOrganization,
    executor: DatabaseExecutor,
  ): Promise<Organization> {
    const [organization] = await executor.insert(organizations).values(input).returning();

    if (!organization) {
      throw new Error('Failed to create organization');
    }

    return organization;
  }

  async findById(tenantId: string, organizationId: string): Promise<Organization | null> {
    if (!currentTenantExecutor())
      return withTenantContext(this.database, tenantId, (tx) =>
        this.findByIdWithExecutor(tenantId, organizationId, tx),
      );
    return this.findByIdWithExecutor(tenantId, organizationId, this.database);
  }

  private async findByIdWithExecutor(
    tenantId: string,
    organizationId: string,
    executor: DatabaseExecutor,
  ): Promise<Organization | null> {
    const [organization] = await executor
      .select()
      .from(organizations)
      .where(and(eq(organizations.tenantId, tenantId), eq(organizations.id, organizationId)))
      .limit(1);

    return organization ?? null;
  }

  async findBySlug(tenantId: string, slug: string): Promise<Organization | null> {
    if (!currentTenantExecutor())
      return withTenantContext(this.database, tenantId, (tx) =>
        this.findBySlugWithExecutor(tenantId, slug, tx),
      );
    return this.findBySlugWithExecutor(tenantId, slug, this.database);
  }

  private async findBySlugWithExecutor(
    tenantId: string,
    slug: string,
    executor: DatabaseExecutor,
  ): Promise<Organization | null> {
    const [organization] = await executor
      .select()
      .from(organizations)
      .where(and(eq(organizations.tenantId, tenantId), eq(organizations.slug, slug)))
      .limit(1);

    return organization ?? null;
  }

  async findByTenant(tenantId: string): Promise<Organization[]> {
    if (!currentTenantExecutor())
      return withTenantContext(this.database, tenantId, (tx) =>
        this.findByTenantWithExecutor(tenantId, tx),
      );
    return this.findByTenantWithExecutor(tenantId, this.database);
  }

  private findByTenantWithExecutor(
    tenantId: string,
    executor: DatabaseExecutor,
  ): Promise<Organization[]> {
    return executor.select().from(organizations).where(eq(organizations.tenantId, tenantId));
  }
}
