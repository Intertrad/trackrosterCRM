import { randomUUID } from 'node:crypto';

import { Test, TestingModule } from '@nestjs/testing';
import { eq, like } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DATABASE } from '../database/database.constants.js';
import * as schema from '../database/schema/index.js';
import { organizations } from '../database/schema/organizations.js';
import { teams } from '../database/schema/teams.js';
import { tenants } from '../database/schema/tenants.js';
import { withTenantContext } from '../database/tenant-context.js';
import { TeamRepository } from '../teams/team.repository.js';
import { TenantRepository } from '../tenants/tenant.repository.js';
import { OrganizationRepository } from './organization.repository.js';
import { createIntegrationPool } from '../../test/support/integration-pool.js';

describe('Organization and Team tenant isolation', () => {
  let pool: Pool | undefined;
  let database: ReturnType<typeof drizzle<typeof schema>>;

  let tenantRepository: TenantRepository;
  let organizationRepository: OrganizationRepository;
  let teamRepository: TeamRepository;

  const testRunId = `integration-${randomUUID()}`;

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL is required for integration tests');
    }

    pool = createIntegrationPool(connectionString);

    database = drizzle(pool, {
      schema,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantRepository,
        OrganizationRepository,
        TeamRepository,
        {
          provide: DATABASE,
          useValue: database,
        },
      ],
    }).compile();

    tenantRepository = module.get(TenantRepository);
    organizationRepository = module.get(OrganizationRepository);
    teamRepository = module.get(TeamRepository);
  });

  afterAll(async () => {
    if (!pool) {
      return;
    }

    const testTenants = await database
      .select({ id: tenants.id })
      .from(tenants)
      .where(like(tenants.slug, `${testRunId}%`));
    for (const tenant of testTenants) {
      await withTenantContext(database, tenant.id, async (tx) => {
        await tx.delete(teams).where(eq(teams.tenantId, tenant.id));
        await tx.delete(organizations).where(eq(organizations.tenantId, tenant.id));
      });
      await database.delete(tenants).where(eq(tenants.id, tenant.id));
    }

    await pool.end();
  });

  it('allows the same organization slug in different tenants', async () => {
    const tenantA = await tenantRepository.create({
      name: 'Tenant A',
      slug: `${testRunId}-tenant-a`,
      status: 'active',
    });

    const tenantB = await tenantRepository.create({
      name: 'Tenant B',
      slug: `${testRunId}-tenant-b`,
      status: 'active',
    });

    const slug = `${testRunId}-sales`;

    const organizationA = await organizationRepository.create({
      tenantId: tenantA.id,
      name: 'Sales',
      slug,
      status: 'active',
    });

    const organizationB = await organizationRepository.create({
      tenantId: tenantB.id,
      name: 'Sales',
      slug,
      status: 'active',
    });

    expect(organizationA.slug).toBe(slug);
    expect(organizationB.slug).toBe(slug);
  });

  it('rejects duplicate organization slug inside the same tenant', async () => {
    const tenant = await tenantRepository.create({
      name: 'Organization Unique Tenant',
      slug: `${testRunId}-org-unique-tenant`,
      status: 'active',
    });

    const slug = `${testRunId}-duplicate-org`;

    await organizationRepository.create({
      tenantId: tenant.id,
      name: 'First Organization',
      slug,
      status: 'active',
    });

    await expect(
      organizationRepository.create({
        tenantId: tenant.id,
        name: 'Second Organization',
        slug,
        status: 'active',
      }),
    ).rejects.toMatchObject({
      cause: {
        code: '23505',
        constraint: 'organizations_tenant_id_slug_unique',
      },
    });
  });

  it('scopes organization lookup by tenant', async () => {
    const tenantA = await tenantRepository.create({
      name: 'Scope Tenant A',
      slug: `${testRunId}-scope-a`,
      status: 'active',
    });

    const tenantB = await tenantRepository.create({
      name: 'Scope Tenant B',
      slug: `${testRunId}-scope-b`,
      status: 'active',
    });

    const organization = await organizationRepository.create({
      tenantId: tenantA.id,
      name: 'Tenant A Organization',
      slug: `${testRunId}-scope-org`,
      status: 'active',
    });

    const correctTenant = await organizationRepository.findById(tenantA.id, organization.id);

    const wrongTenant = await organizationRepository.findById(tenantB.id, organization.id);

    expect(correctTenant?.id).toBe(organization.id);
    expect(wrongTenant).toBeNull();
  });

  it('rejects a team referencing an organization from another tenant', async () => {
    const tenantA = await tenantRepository.create({
      name: 'Cross Tenant A',
      slug: `${testRunId}-cross-a`,
      status: 'active',
    });

    const tenantB = await tenantRepository.create({
      name: 'Cross Tenant B',
      slug: `${testRunId}-cross-b`,
      status: 'active',
    });

    const organizationA = await organizationRepository.create({
      tenantId: tenantA.id,
      name: 'Organization A',
      slug: `${testRunId}-cross-org`,
      status: 'active',
    });

    await expect(
      teamRepository.create({
        tenantId: tenantB.id,
        organizationId: organizationA.id,
        name: 'Invalid Team',
        slug: `${testRunId}-invalid-team`,
        status: 'active',
      }),
    ).rejects.toMatchObject({
      cause: {
        code: '23503',
        constraint: 'teams_tenant_organization_fk',
      },
    });
  });

  it('enforces team slug uniqueness inside an organization', async () => {
    const tenant = await tenantRepository.create({
      name: 'Team Unique Tenant',
      slug: `${testRunId}-team-unique-tenant`,
      status: 'active',
    });

    const organization = await organizationRepository.create({
      tenantId: tenant.id,
      name: 'Team Unique Organization',
      slug: `${testRunId}-team-unique-org`,
      status: 'active',
    });

    const slug = `${testRunId}-prospecting`;

    await teamRepository.create({
      tenantId: tenant.id,
      organizationId: organization.id,
      name: 'First Team',
      slug,
      status: 'active',
    });

    await expect(
      teamRepository.create({
        tenantId: tenant.id,
        organizationId: organization.id,
        name: 'Second Team',
        slug,
        status: 'active',
      }),
    ).rejects.toMatchObject({
      cause: {
        code: '23505',
        constraint: 'teams_tenant_organization_slug_unique',
      },
    });
  });
});
