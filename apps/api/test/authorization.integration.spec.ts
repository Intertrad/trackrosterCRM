import { randomUUID } from 'node:crypto';

import { NestFactory } from '@nestjs/core';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { AuthorizationService } from '../src/authorization/authorization.service.js';
import { UserAccessGrantRepository } from '../src/authorization/user-access-grant.repository.js';
import { DATABASE } from '../src/database/database.constants.js';
import type { Database } from '../src/database/database.types.js';
import { withTenantContext } from '../src/database/tenant-context.js';
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
  let app: Awaited<ReturnType<typeof NestFactory.createApplicationContext>> | undefined;

  let database: Database | undefined;

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

    /*
     * Every integration run gets unique natural keys.
     *
     * This prevents collisions when test databases are
     * reused or integration suites run close together.
     */
    const suffix = randomUUID().replaceAll('-', '').slice(0, 10);

    const tenantA = await tenantService.create({
      name: `RBAC Tenant A ${suffix}`,
      slug: `rbac-a-${suffix}`,
    });

    tenantAId = tenantA.id;

    const tenantB = await tenantService.create({
      name: `RBAC Tenant B ${suffix}`,
      slug: `rbac-b-${suffix}`,
    });

    tenantBId = tenantB.id;

    const organizationA = await withTenantContext(database!, tenantA.id, () =>
      organizationService.create({
        tenantId: tenantA.id,
        name: `Organization A ${suffix}`,
        slug: `organization-a-${suffix}`,
      }),
    );

    organizationAId = organizationA.id;

    const organizationB = await withTenantContext(database!, tenantB.id, () =>
      organizationService.create({
        tenantId: tenantB.id,
        name: `Organization B ${suffix}`,
        slug: `organization-b-${suffix}`,
      }),
    );

    organizationBId = organizationB.id;

    const teamA = await withTenantContext(database!, tenantA.id, () =>
      teamService.create({
        tenantId: tenantA.id,
        organizationId: organizationA.id,
        name: `Team A ${suffix}`,
        slug: `team-a-${suffix}`,
      }),
    );

    teamAId = teamA.id;

    const teamB = await withTenantContext(database!, tenantB.id, () =>
      teamService.create({
        tenantId: tenantB.id,
        organizationId: organizationB.id,
        name: `Team B ${suffix}`,
        slug: `team-b-${suffix}`,
      }),
    );

    teamBId = teamB.id;

    const userA = await withTenantContext(database!, tenantA.id, () =>
      userRepository.create({
        tenantId: tenantA.id,
        email: `rbac-a-${suffix}@trackroster.test`,
        passwordHash: 'integration-placeholder',
        status: 'active',
      }),
    );

    userAId = userA.id;

    const userB = await withTenantContext(database!, tenantB.id, () =>
      userRepository.create({
        tenantId: tenantB.id,
        email: `rbac-b-${suffix}@trackroster.test`,
        passwordHash: 'integration-placeholder',
        status: 'active',
      }),
    );

    userBId = userB.id;
  });

  afterAll(async () => {
    try {
      /*
       * beforeAll may fail partway through.
       *
       * Clean up only resources that were successfully
       * initialized so teardown cannot hide the original
       * integration-test failure.
       */
      if (database) {
        if (tenantAId) {
          await withTenantContext(database, tenantAId, async () => {
            await database!
              .delete(userAccessGrants)
              .where(eq(userAccessGrants.tenantId, tenantAId));

            await database!.delete(teams).where(eq(teams.tenantId, tenantAId));

            await database!.delete(organizations).where(eq(organizations.tenantId, tenantAId));

            await database!.delete(users).where(eq(users.tenantId, tenantAId));
          });

          await database!.delete(tenants).where(eq(tenants.id, tenantAId));
        }

        if (tenantBId) {
          await withTenantContext(database, tenantBId, async () => {
            await database!
              .delete(userAccessGrants)
              .where(eq(userAccessGrants.tenantId, tenantBId));

            await database!.delete(teams).where(eq(teams.tenantId, tenantBId));

            await database!.delete(organizations).where(eq(organizations.tenantId, tenantBId));

            await database!.delete(users).where(eq(users.tenantId, tenantBId));
          });

          await database!.delete(tenants).where(eq(tenants.id, tenantBId));
        }
      }
    } finally {
      if (app) {
        await app.close();
      }
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
