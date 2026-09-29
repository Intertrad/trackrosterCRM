import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from '../../app.module.js';
import { PasswordService } from '../../auth/password.service.js';
import { UserAccessGrantRepository } from '../../authorization/user-access-grant.repository.js';
import { OrganizationService } from '../../organizations/organization.service.js';
import { TeamService } from '../../teams/team.service.js';
import { TenantService } from '../../tenants/tenant.service.js';
import { UserRepository } from '../../users/user.repository.js';
import { DATABASE } from '../database.constants.js';
import type { Database } from '../database.types.js';
import { seedDevelopmentWorkQueue } from './development-work-queue.seed.js';

async function seed(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const tenantService = app.get(TenantService);
    const organizationService = app.get(OrganizationService);
    const teamService = app.get(TeamService);
    const passwordService = app.get(PasswordService);
    const userRepository = app.get(UserRepository);
    const grantRepository = app.get(UserAccessGrantRepository);
    const database = app.get<Database>(DATABASE);
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
    // Stable identifiers
    //
    // Capture non-null IDs here so nested helper functions do not
    // close over nullable `let` variables.
    // ----------------------------------------------------------------

    const tenantId = tenant.id;
    const organizationId = organization.id;
    const teamId = team.id;

    // ----------------------------------------------------------------
    // Password helpers
    //
    // Passwords are only required when a user needs to be created.
    // Existing users keep their existing password hash.
    // ----------------------------------------------------------------

    let adminPasswordHash: string | null = null;
    let rolePasswordHash: string | null = null;

    async function getAdminPasswordHash(): Promise<string> {
      if (adminPasswordHash) {
        return adminPasswordHash;
      }

      const password = process.env.DEV_ADMIN_PASSWORD;

      if (!password) {
        throw new Error('DEV_ADMIN_PASSWORD is required to create the development admin user');
      }

      adminPasswordHash = await passwordService.hash(password);

      return adminPasswordHash;
    }

    async function getRolePasswordHash(): Promise<string> {
      if (rolePasswordHash) {
        return rolePasswordHash;
      }

      const password = process.env.DEV_ROLE_PASSWORD;

      if (!password) {
        throw new Error('DEV_ROLE_PASSWORD is required to create development role users');
      }

      rolePasswordHash = await passwordService.hash(password);

      return rolePasswordHash;
    }

    // ----------------------------------------------------------------
    // User helper
    // ----------------------------------------------------------------
    async function ensureRoleUser(email: string, displayName: string) {
      const passwordHash = await getRolePasswordHash();

      let roleUser = await userRepository.findByEmail(email);

      if (!roleUser) {
        roleUser = await userRepository.create({
          tenantId,
          email,
          displayName,
          passwordHash,
          status: 'active',
        });

        console.log(`Created development user: ${roleUser.email}`);

        return roleUser;
      }

      const updatedUser = await userRepository.updatePasswordHash(
        tenantId,
        roleUser.id,
        passwordHash,
      );

      if (!updatedUser) {
        throw new Error(`Failed to synchronize development password for ${email}`);
      }

      console.log(`Synchronized development password: ${updatedUser.email}`);

      if (updatedUser.displayName === displayName) {
        return updatedUser;
      }

      const updatedProfile = await userRepository.updateDisplayName(
        tenantId,
        updatedUser.id,
        displayName,
      );

      if (!updatedProfile) {
        throw new Error(`Failed to synchronize development display name for ${email}`);
      }

      console.log(`Synchronized development display name: ${updatedProfile.email}`);

      return updatedProfile;
    }

    // ================================================================
    // CLIENT ADMIN
    //
    // Role:
    //   client_admin
    //
    // Scope:
    //   tenant
    // ================================================================

    const adminEmail = 'admin@intertrad.test';
    const adminDisplayName = 'Sophie Laurent';

    let admin = await userRepository.findByEmail(adminEmail);

    if (!admin) {
      const passwordHash = await getAdminPasswordHash();

      admin = await userRepository.create({
        tenantId,
        email: adminEmail,
        displayName: adminDisplayName,
        passwordHash,
        status: 'active',
      });

      console.log(`Created development user: ${admin.email}`);
    } else {
      const passwordHash = await getAdminPasswordHash();

      const updatedAdmin = await userRepository.updatePasswordHash(
        tenantId,
        admin.id,
        passwordHash,
      );

      if (!updatedAdmin) {
        throw new Error(`Failed to synchronize development password for ${adminEmail}`);
      }

      admin = updatedAdmin;

      if (admin.displayName !== adminDisplayName) {
        const updatedProfile = await userRepository.updateDisplayName(
          tenantId,
          admin.id,
          adminDisplayName,
        );

        if (!updatedProfile) {
          throw new Error(`Failed to synchronize development display name for ${adminEmail}`);
        }

        admin = updatedProfile;

        console.log(`Synchronized development display name: ${admin.email}`);
      }

      console.log(`Synchronized development password: ${admin.email}`);
    }

    const adminGrants = await grantRepository.findByUser(tenantId, admin.id);

    const hasClientAdminGrant = adminGrants.some(
      (grant) => grant.role === 'client_admin' && grant.scopeType === 'tenant',
    );

    if (!hasClientAdminGrant) {
      await grantRepository.create({
        tenantId,
        userId: admin.id,
        role: 'client_admin',
        scopeType: 'tenant',
      });

      console.log(`Created development client-admin grant: ${admin.email}`);
    } else {
      console.log(`Development client-admin grant already exists: ${admin.email}`);
    }

    // ================================================================
    // DIRECTOR
    //
    // Role:
    //   director
    //
    // Scope:
    //   France Sales organization
    // ================================================================

    const director = await ensureRoleUser('director@intertrad.test', 'Claire Dubois');

    const directorGrants = await grantRepository.findByUser(tenantId, director.id);

    const hasDirectorGrant = directorGrants.some(
      (grant) =>
        grant.role === 'director' &&
        grant.scopeType === 'organization' &&
        grant.organizationId === organizationId,
    );

    if (!hasDirectorGrant) {
      await grantRepository.create({
        tenantId,
        userId: director.id,
        role: 'director',
        scopeType: 'organization',
        organizationId,
      });

      console.log(`Created development director grant: ${director.email}`);
    } else {
      console.log(`Development director grant already exists: ${director.email}`);
    }

    // ================================================================
    // MANAGER
    //
    // Role:
    //   manager
    //
    // Scope:
    //   Paris Prospecting team
    // ================================================================

    const manager = await ensureRoleUser('manager@intertrad.test', 'Marie Garnier');

    const managerGrants = await grantRepository.findByUser(tenantId, manager.id);

    const hasManagerGrant = managerGrants.some(
      (grant) =>
        grant.role === 'manager' &&
        grant.scopeType === 'team' &&
        grant.organizationId === organizationId &&
        grant.teamId === teamId,
    );

    if (!hasManagerGrant) {
      await grantRepository.create({
        tenantId,
        userId: manager.id,
        role: 'manager',
        scopeType: 'team',
        organizationId,
        teamId,
      });

      console.log(`Created development manager grant: ${manager.email}`);
    } else {
      console.log(`Development manager grant already exists: ${manager.email}`);
    }

    // ================================================================
    // MANAGER MULTI-WORKSPACE FIXTURE
    //
    // TR-029 F5 development fixture:
    //   manager@intertrad.test
    //
    // Grants:
    //   manager    / Paris Prospecting team
    //   prospector / Paris Prospecting team
    //
    // This allows the frontend to verify workspace switching without
    // weakening or bypassing backend authorization.
    // ================================================================

    const hasManagerProspectorGrant = managerGrants.some(
      (grant) =>
        grant.role === 'prospector' &&
        grant.scopeType === 'team' &&
        grant.organizationId === organizationId &&
        grant.teamId === teamId,
    );

    if (!hasManagerProspectorGrant) {
      await grantRepository.create({
        tenantId,
        userId: manager.id,
        role: 'prospector',
        scopeType: 'team',
        organizationId,
        teamId,
      });

      console.log(`Created development manager multi-workspace prospector grant: ${manager.email}`);
    } else {
      console.log(
        `Development manager multi-workspace prospector grant already exists: ${manager.email}`,
      );
    }

    // ================================================================
    // PROSPECTOR
    //
    // Role:
    //   prospector
    //
    // Scope:
    //   Paris Prospecting team
    // ================================================================

    const prospector = await ensureRoleUser('prospector@intertrad.test', 'Nabil Benali');

    const prospectorGrants = await grantRepository.findByUser(tenantId, prospector.id);

    const hasProspectorGrant = prospectorGrants.some(
      (grant) =>
        grant.role === 'prospector' &&
        grant.scopeType === 'team' &&
        grant.organizationId === organizationId &&
        grant.teamId === teamId,
    );

    if (!hasProspectorGrant) {
      await grantRepository.create({
        tenantId,
        userId: prospector.id,
        role: 'prospector',
        scopeType: 'team',
        organizationId,
        teamId,
      });

      console.log(`Created development prospector grant: ${prospector.email}`);
    } else {
      console.log(`Development prospector grant already exists: ${prospector.email}`);
    }

    // ================================================================
    // OBSERVER
    //
    // Role:
    //   observer
    //
    // Scope:
    //   Paris Prospecting team
    //
    // Observer is intentionally team-scoped here so we can test
    // read-only/scoped frontend behavior separately from tenant-wide
    // administrator behavior.
    // ================================================================

    const observer = await ensureRoleUser('observer@intertrad.test', 'Camille Moreau');

    const observerGrants = await grantRepository.findByUser(tenantId, observer.id);

    const hasObserverGrant = observerGrants.some(
      (grant) =>
        grant.role === 'observer' &&
        grant.scopeType === 'team' &&
        grant.organizationId === organizationId &&
        grant.teamId === teamId,
    );

    if (!hasObserverGrant) {
      await grantRepository.create({
        tenantId,
        userId: observer.id,
        role: 'observer',
        scopeType: 'team',
        organizationId,
        teamId,
      });

      console.log(`Created development observer grant: ${observer.email}`);
    } else {
      console.log(`Development observer grant already exists: ${observer.email}`);
    }

    // ================================================================
    // NO-ACCESS USER
    //
    // TR-029 G2 development fixture:
    //
    // Authenticated account with intentionally zero access grants.
    // Used to verify the frontend fails closed and renders the
    // access-denied state instead of an application workspace.
    // ================================================================

    const noAccessUser = await ensureRoleUser('noaccess@intertrad.test', 'Alex Martin');

    // ================================================================
    // TR-031 WORK QUEUE / PROSPECT DETAIL DEVELOPMENT DATA
    // ================================================================

    const workQueueFixture = await seedDevelopmentWorkQueue({
      database,

      tenantId,

      organizationId,

      teamId,

      prospectorUserId: prospector.id,

      /*
       * manager@intertrad.test intentionally also has an exact
       * Prospector/team grant, making it useful as the second user
       * for ownership-isolation testing.
       */
      otherProspectorUserId: manager.id,
    });

    console.log('');
    console.log('TR-031 Work Queue development fixture ready');

    console.log(
      `Frontend campaigns: ${workQueueFixture.campaigns
        .map((campaign) => `${campaign.name} (${campaign.id})`)
        .join(', ')}`,
    );

    for (const prospect of workQueueFixture.prospects) {
      console.log(
        `${prospect.name} -> ` +
          `${prospect.campaignName} / ${prospect.campaignProspectId} ` +
          `(${prospect.activityCount} activities)`,
      );
    }

    const noAccessGrants = await grantRepository.findByUser(tenantId, noAccessUser.id);

    if (noAccessGrants.length > 0) {
      throw new Error('noaccess@intertrad.test must have zero access grants');
    }

    console.log(`Development no-access fixture ready: ${noAccessUser.email}`);
    // ----------------------------------------------------------------
    // Development summary
    // ----------------------------------------------------------------

    console.log('');
    console.log('============================================');
    console.log('TrackRoster development access users');
    console.log('============================================');

    console.log('admin@intertrad.test      -> client_admin / tenant');

    console.log('director@intertrad.test   -> director / France Sales');

    console.log('manager@intertrad.test    -> manager / Paris Prospecting');

    console.log('prospector@intertrad.test -> prospector / Paris Prospecting');

    console.log('observer@intertrad.test   -> observer / Paris Prospecting');
    console.log('noaccess@intertrad.test   -> authenticated / no access grants');

    console.log('============================================');
  } finally {
    await app.close();
  }
}

seed().catch((error: unknown) => {
  console.error('Database seed failed:', error);

  process.exitCode = 1;
});
