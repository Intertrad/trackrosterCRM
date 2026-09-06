import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from '../../app.module.js';
import { PasswordService } from '../../auth/password.service.js';
import { UserAccessGrantRepository } from '../../authorization/user-access-grant.repository.js';
import { OrganizationService } from '../../organizations/organization.service.js';
import { TeamService } from '../../teams/team.service.js';
import { TenantService } from '../../tenants/tenant.service.js';
import { UserRepository } from '../../users/user.repository.js';

async function seed(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const tenantService = app.get(TenantService);
    const organizationService = app.get(OrganizationService);
    const teamService = app.get(TeamService);
    const passwordService = app.get(PasswordService);
    const userRepository = app.get(UserRepository);
    const grantRepository = app.get(UserAccessGrantRepository);

    // ----------------------------------------------------------------
    // Tenant
    // ----------------------------------------------------------------

    let tenant = await tenantService.findBySlug('intertrad');

    if (!tenant) {
      tenant = await tenantService.create({
        name: 'Intertrad',
        slug: 'intertrad',
      });

      console.log(`Created development tenant: ${tenant.id}`);
    } else {
      console.log(`Development tenant already exists: ${tenant.id}`);
    }

    // ----------------------------------------------------------------
    // Organization
    // ----------------------------------------------------------------

    let organization = await organizationService.findBySlug(tenant.id, 'france-sales');

    if (!organization) {
      organization = await organizationService.create({
        tenantId: tenant.id,
        name: 'France Sales',
        slug: 'france-sales',
      });

      console.log(`Created development organization: ${organization.id}`);
    } else {
      console.log(`Development organization already exists: ${organization.id}`);
    }

    // ----------------------------------------------------------------
    // Team
    // ----------------------------------------------------------------

    let team = await teamService.findBySlug(tenant.id, organization.id, 'paris-prospecting');

    if (!team) {
      team = await teamService.create({
        tenantId: tenant.id,
        organizationId: organization.id,
        name: 'Paris Prospecting',
        slug: 'paris-prospecting',
      });

      console.log(`Created development team: ${team.id}`);
    } else {
      console.log(`Development team already exists: ${team.id}`);
    }

    // ----------------------------------------------------------------
    // Development authentication user
    // ----------------------------------------------------------------

    const developmentEmail = 'admin@intertrad.test';

    let user = await userRepository.findByEmail(developmentEmail);

    if (!user) {
      const developmentPassword = process.env.DEV_ADMIN_PASSWORD;

      if (!developmentPassword) {
        throw new Error('DEV_ADMIN_PASSWORD is required to seed the development user');
      }

      const passwordHash = await passwordService.hash(developmentPassword);

      user = await userRepository.create({
        tenantId: tenant.id,
        email: developmentEmail,
        passwordHash,
        status: 'active',
      });

      console.log(`Created development user: ${user.email}`);
    } else {
      console.log(`Development user already exists: ${user.email}`);
    }

    // ----------------------------------------------------------------
    // Development client-admin access grant
    // ----------------------------------------------------------------

    const existingGrants = await grantRepository.findByUser(tenant.id, user.id);

    const hasClientAdminGrant = existingGrants.some(
      (grant) => grant.role === 'client_admin' && grant.scopeType === 'tenant',
    );

    if (!hasClientAdminGrant) {
      await grantRepository.create({
        tenantId: tenant.id,
        userId: user.id,
        role: 'client_admin',
        scopeType: 'tenant',
      });

      console.log(`Created development client-admin grant: ${user.email}`);
    } else {
      console.log(`Development client-admin grant already exists: ${user.email}`);
    }
  } finally {
    await app.close();
  }
}

seed().catch((error: unknown) => {
  console.error('Database seed failed:', error);
  process.exitCode = 1;
});
