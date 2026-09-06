import { randomUUID } from 'node:crypto';

import { NestFactory } from '@nestjs/core';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { AuthorizationService } from '../src/authorization/authorization.service.js';
import { UserAccessGrantRepository } from '../src/authorization/user-access-grant.repository.js';
import { DATABASE } from '../src/database/database.constants.js';
import { Database } from '../src/database/database.types.js';
import { organizations } from '../src/database/schema/organizations.js';
import { teams } from '../src/database/schema/teams.js';
import { tenants } from '../src/database/schema/tenants.js';
import { userAccessGrants } from '../src/database/schema/user-access-grants.js';
import { users } from '../src/database/schema/users.js';
import { OrganizationService } from '../src/organizations/organization.service.js';
import { TeamService } from '../src/teams/team.service.js';
import { TenantService } from '../src/tenants/tenant.service.js';
import { UserRepository } from '../src/users/user.repository.js';

describe('Authorization integration', () => {
  let app: Awaited<ReturnType<typeof NestFactory.createApplicationContext>>;

  let database: Database;

  let grantRepository: UserAccessGrantRepository;
  let authorizationService: AuthorizationService;

  let tenantAId: string;
  let tenantBId: string;

  let organizationAId: string;
  let organizationBId: string;

  let teamAId: string;
  let teamBId: string;

  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    app = await NestFactory.createApplicationContext(AppModule, {
      logger: false,
      abortOnError: false,
    });

    database = app.get<Database>(DATABASE);

    const tenantService = app.get(TenantService);

    const organizationService = app.get(OrganizationService);

    const teamService = app.get(TeamService);

    const userRepository = app.get(UserRepository);

    grantRepository = app.get(UserAccessGrantRepository);

    authorizationService = app.get(AuthorizationService);

    const suffix = randomUUID().replaceAll('-', '').slice(0, 10);

    const tenantA = await tenantService.create({
      name: `RBAC Tenant A ${suffix}`,
      slug: `rbac-a-${suffix}`,
    });

    const tenantB = await tenantService.create({
      name: `RBAC Tenant B ${suffix}`,
      slug: `rbac-b-${suffix}`,
    });

    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    const organizationA = await organizationService.create({
      tenantId: tenantA.id,
      name: 'Organization A',
      slug: `organization-a-${suffix}`,
    });

    const organizationB = await organizationService.create({
      tenantId: tenantB.id,
      name: 'Organization B',
      slug: `organization-b-${suffix}`,
    });

    organizationAId = organizationA.id;
    organizationBId = organizationB.id;

    const teamA = await teamService.create({
      tenantId: tenantA.id,
      organizationId: organizationA.id,
      name: 'Team A',
      slug: `team-a-${suffix}`,
    });

    const teamB = await teamService.create({
      tenantId: tenantB.id,
      organizationId: organizationB.id,
      name: 'Team B',
      slug: `team-b-${suffix}`,
    });

    teamAId = teamA.id;
    teamBId = teamB.id;

    const userA = await userRepository.create({
      tenantId: tenantA.id,
      email: `rbac-a-${suffix}@trackroster.test`,
      passwordHash: 'integration-placeholder',
      status: 'active',
    });

    const userB = await userRepository.create({
      tenantId: tenantB.id,
      email: `rbac-b-${suffix}@trackroster.test`,
      passwordHash: 'integration-placeholder',
      status: 'active',
    });

    userAId = userA.id;
    userBId = userB.id;
  });

  afterAll(async () => {
    try {
      await database.delete(userAccessGrants).where(eq(userAccessGrants.tenantId, tenantAId));

      await database.delete(userAccessGrants).where(eq(userAccessGrants.tenantId, tenantBId));

      await database.delete(teams).where(eq(teams.tenantId, tenantAId));

      await database.delete(teams).where(eq(teams.tenantId, tenantBId));

      await database.delete(organizations).where(eq(organizations.tenantId, tenantAId));

      await database.delete(organizations).where(eq(organizations.tenantId, tenantBId));

      await database.delete(users).where(eq(users.tenantId, tenantAId));

      await database.delete(users).where(eq(users.tenantId, tenantBId));

      await database.delete(tenants).where(eq(tenants.id, tenantAId));

      await database.delete(tenants).where(eq(tenants.id, tenantBId));
    } finally {
      await app.close();
    }
  });

  it('creates a valid tenant-scoped client admin grant', async () => {
    const grant = await grantRepository.create({
      tenantId: tenantAId,
      userId: userAId,
      role: 'client_admin',
      scopeType: 'tenant',
    });

    expect(grant.tenantId).toBe(tenantAId);

    expect(grant.userId).toBe(userAId);

    expect(grant.role).toBe('client_admin');

    expect(await authorizationService.isClientAdmin(tenantAId, userAId)).toBe(true);
  });

  it('allows a manager to view their assigned team', async () => {
    await grantRepository.create({
      tenantId: tenantAId,
      userId: userAId,
      role: 'manager',
      scopeType: 'team',
      organizationId: organizationAId,
      teamId: teamAId,
    });

    expect(
      await authorizationService.canViewTeam(tenantAId, userAId, organizationAId, teamAId),
    ).toBe(true);
  });

  it('rejects a cross-tenant user grant', async () => {
    await expect(
      grantRepository.create({
        tenantId: tenantAId,

        // User belongs to Tenant B.
        userId: userBId,

        role: 'client_admin',
        scopeType: 'tenant',
      }),
    ).rejects.toMatchObject({
      cause: {
        code: '23503',
        constraint: 'user_access_grants_tenant_user_fk',
      },
    });
  });

  it('rejects a cross-tenant team grant', async () => {
    await expect(
      grantRepository.create({
        tenantId: tenantAId,
        userId: userAId,
        role: 'manager',
        scopeType: 'team',

        // Organization/team belong to Tenant B.
        organizationId: organizationBId,
        teamId: teamBId,
      }),
    ).rejects.toMatchObject({
      cause: {
        code: '23503',
        constraint: 'user_access_grants_tenant_organization_fk',
      },
    });
  });

  it('rejects an invalid role and scope combination', async () => {
    await expect(
      grantRepository.create({
        tenantId: tenantAId,
        userId: userAId,

        role: 'manager',
        scopeType: 'tenant',
      }),
    ).rejects.toMatchObject({
      cause: {
        code: '23514',
        constraint: 'user_access_grants_role_scope_check',
      },
    });
  });

  it('rejects duplicate grants', async () => {
    await grantRepository.create({
      tenantId: tenantBId,
      userId: userBId,
      role: 'observer',
      scopeType: 'tenant',
    });

    await expect(
      grantRepository.create({
        tenantId: tenantBId,
        userId: userBId,
        role: 'observer',
        scopeType: 'tenant',
      }),
    ).rejects.toMatchObject({
      cause: {
        code: '23505',
        constraint: 'user_access_grants_tenant_scope_unique',
      },
    });
  });
});
