import { randomUUID } from 'node:crypto';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { PasswordService } from '../src/auth/password.service.js';
import { AuthenticationTokens } from '../src/auth/auth.types.js';
import { UserAccessGrantRepository } from '../src/authorization/user-access-grant.repository.js';
import { DATABASE } from '../src/database/database.constants.js';
import { Database } from '../src/database/database.types.js';
import { organizations } from '../src/database/schema/organizations.js';
import { teams } from '../src/database/schema/teams.js';
import { tenants } from '../src/database/schema/tenants.js';
import { users } from '../src/database/schema/users.js';
import { OrganizationService } from '../src/organizations/organization.service.js';
import { TeamService } from '../src/teams/team.service.js';
import { TenantService } from '../src/tenants/tenant.service.js';
import { ManagedUser } from '../src/user-management/user-management.types.js';
import { UserRepository } from '../src/users/user.repository.js';

describe('User management and RBAC integration', () => {
  let app: NestFastifyApplication | undefined;
  let database: Database | undefined;

  let tenantAId = '';
  let tenantBId = '';

  let adminUserId = '';
  let regularUserId = '';
  let tenantBUserId = '';

  let organizationId = '';
  let teamId = '';

  let adminEmail = '';
  let regularEmail = '';

  const adminPassword = 'AdminIntegrationPassword123!';

  const regularPassword = 'RegularIntegrationPassword123!';

  function getApp(): NestFastifyApplication {
    if (!app) {
      throw new Error('Test application has not been initialized');
    }

    return app;
  }

  async function login(email: string, password: string): Promise<AuthenticationTokens> {
    const response = await getApp().inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email,
        password,
      },
    });

    expect(response.statusCode).toBe(200);

    return JSON.parse(response.payload) as AuthenticationTokens;
  }

  beforeAll(async () => {
    const application = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter(),
      {
        logger: false,
        abortOnError: false,
      },
    );

    application.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await application.init();

    app = application;

    database = application.get<Database>(DATABASE);

    const tenantService = application.get(TenantService);

    const organizationService = application.get(OrganizationService);

    const teamService = application.get(TeamService);

    const userRepository = application.get(UserRepository);

    const passwordService = application.get(PasswordService);

    const grantRepository = application.get(UserAccessGrantRepository);

    const suffix = randomUUID().replaceAll('-', '').slice(0, 10);

    const tenantA = await tenantService.create({
      name: `HTTP RBAC Tenant A ${suffix}`,
      slug: `http-rbac-a-${suffix}`,
    });

    const tenantB = await tenantService.create({
      name: `HTTP RBAC Tenant B ${suffix}`,
      slug: `http-rbac-b-${suffix}`,
    });

    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    const organization = await organizationService.create({
      tenantId: tenantA.id,
      name: 'France Sales',
      slug: `france-sales-${suffix}`,
    });

    organizationId = organization.id;

    const team = await teamService.create({
      tenantId: tenantA.id,
      organizationId: organization.id,
      name: 'Paris Prospecting',
      slug: `paris-prospecting-${suffix}`,
    });

    teamId = team.id;

    adminEmail = `admin-${suffix}@trackroster.test`;

    regularEmail = `regular-${suffix}@trackroster.test`;

    const adminPasswordHash = await passwordService.hash(adminPassword);

    const regularPasswordHash = await passwordService.hash(regularPassword);

    const adminUser = await userRepository.create({
      tenantId: tenantA.id,
      email: adminEmail,
      passwordHash: adminPasswordHash,
      status: 'active',
    });

    adminUserId = adminUser.id;

    const regularUser = await userRepository.create({
      tenantId: tenantA.id,
      email: regularEmail,
      passwordHash: regularPasswordHash,
      status: 'active',
    });

    regularUserId = regularUser.id;

    const tenantBUser = await userRepository.create({
      tenantId: tenantB.id,
      email: `outside-${suffix}@trackroster.test`,
      passwordHash: regularPasswordHash,
      status: 'active',
    });

    tenantBUserId = tenantBUser.id;

    await grantRepository.create({
      tenantId: tenantA.id,
      userId: adminUser.id,
      role: 'client_admin',
      scopeType: 'tenant',
    });
  });

  afterAll(async () => {
    try {
      if (database) {
        if (tenantAId) {
          await database.delete(users).where(eq(users.tenantId, tenantAId));

          await database.delete(teams).where(eq(teams.tenantId, tenantAId));

          await database.delete(organizations).where(eq(organizations.tenantId, tenantAId));

          await database.delete(tenants).where(eq(tenants.id, tenantAId));
        }

        if (tenantBId) {
          await database.delete(users).where(eq(users.tenantId, tenantBId));

          await database.delete(tenants).where(eq(tenants.id, tenantBId));
        }
      }
    } finally {
      if (app) {
        await app.close();
      }
    }
  });

  it('rejects user administration without authentication', async () => {
    const response = await getApp().inject({
      method: 'GET',
      url: '/users',
    });

    expect(response.statusCode).toBe(401);
  });

  it('rejects an authenticated non-admin', async () => {
    const tokens = await login(regularEmail, regularPassword);

    const response = await getApp().inject({
      method: 'GET',
      url: '/users',
      headers: {
        authorization: `Bearer ${tokens.accessToken}`,
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it('allows a client admin to create a tenant user', async () => {
    const tokens = await login(adminEmail, adminPassword);

    const response = await getApp().inject({
      method: 'POST',
      url: '/users',

      headers: {
        authorization: `Bearer ${tokens.accessToken}`,
      },

      payload: {
        email: 'NEW.USER@TRACKROSTER.TEST',

        password: 'NewUserPassword123!',
      },
    });

    expect(response.statusCode).toBe(201);

    const user = JSON.parse(response.payload) as ManagedUser;

    expect(user.email).toBe('new.user@trackroster.test');

    expect(user.tenantId).toBe(tenantAId);

    expect(user).not.toHaveProperty('passwordHash');
  });

  it('lists only users from the authenticated tenant without password hashes', async () => {
    const tokens = await login(adminEmail, adminPassword);

    const response = await getApp().inject({
      method: 'GET',
      url: '/users',

      headers: {
        authorization: `Bearer ${tokens.accessToken}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const result = JSON.parse(response.payload) as ManagedUser[];

    expect(result.some((user) => user.id === adminUserId)).toBe(true);

    expect(result.some((user) => user.id === regularUserId)).toBe(true);

    expect(result.some((user) => user.id === tenantBUserId)).toBe(false);

    for (const user of result) {
      expect(user).not.toHaveProperty('passwordHash');
    }
  });

  it('allows a client admin to assign a team manager grant', async () => {
    const tokens = await login(adminEmail, adminPassword);

    const response = await getApp().inject({
      method: 'POST',

      url: `/users/${regularUserId}/access-grants`,

      headers: {
        authorization: `Bearer ${tokens.accessToken}`,
      },

      payload: {
        role: 'manager',
        scopeType: 'team',
        organizationId,
        teamId,
      },
    });

    expect(response.statusCode).toBe(201);

    const grant = JSON.parse(response.payload) as {
      id: string;
      role: string;
      scopeType: string;
      organizationId: string;
      teamId: string;
    };

    expect(grant.role).toBe('manager');

    expect(grant.scopeType).toBe('team');

    expect(grant.teamId).toBe(teamId);
  });

  it('hides cross-tenant users during grant administration', async () => {
    const tokens = await login(adminEmail, adminPassword);

    const response = await getApp().inject({
      method: 'GET',

      url: `/users/${tenantBUserId}/access-grants`,

      headers: {
        authorization: `Bearer ${tokens.accessToken}`,
      },
    });

    expect(response.statusCode).toBe(404);
  });

  it('allows a client admin to suspend another user', async () => {
    const tokens = await login(adminEmail, adminPassword);

    const response = await getApp().inject({
      method: 'PATCH',

      url: `/users/${regularUserId}/status`,

      headers: {
        authorization: `Bearer ${tokens.accessToken}`,
      },

      payload: {
        status: 'suspended',
      },
    });

    expect(response.statusCode).toBe(200);

    const user = JSON.parse(response.payload) as ManagedUser;

    expect(user.status).toBe('suspended');

    expect(user).not.toHaveProperty('passwordHash');
  });

  it('prevents a client admin from disabling themselves', async () => {
    const tokens = await login(adminEmail, adminPassword);

    const response = await getApp().inject({
      method: 'PATCH',

      url: `/users/${adminUserId}/status`,

      headers: {
        authorization: `Bearer ${tokens.accessToken}`,
      },

      payload: {
        status: 'disabled',
      },
    });

    expect(response.statusCode).toBe(403);
  });
});
