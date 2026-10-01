import 'reflect-metadata';

import { and, eq, isNull } from 'drizzle-orm';
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
import { platformAccessGrants } from '../schema/index.js';
import { withTenantContext } from '../tenant-context.js';

/*
 * Bootstraps the TrackRoster Beta tenant.
 *
 * Built out of the same domain services the development seed uses —
 * TenantService, OrganizationService, TeamService, UserRepository,
 * PasswordService, UserAccessGrantRepository — so nothing here reaches past the
 * application's own rules. There is no hand-written tenant or auth SQL, and in
 * particular no INSERT into `identities` or `tenant_memberships`: migration
 * 0024 installs `users_identity_membership_sync_trigger`, which mirrors every
 * legacy `users` write into a same-ID identity and membership. Writing those
 * tables directly is what the Phase A runbook forbids, and it is also
 * unnecessary — creating the user is what creates the login.
 *
 * Separate from development.seed.ts rather than a flag on it, because that seed
 * is the bootstrap for the `intertrad` development sandbox and beta must not be
 * able to alter it.
 *
 * What this deliberately does NOT create: campaigns, prospects, assignments,
 * actions or any other operational row. Beta exists to certify the real
 * référentiel through the real workflow, and pre-manufactured operational data
 * would make a passing run meaningless. The establishment base arrives through
 * the import API, and everything downstream of it is produced by the
 * certification itself.
 *
 * Idempotent: every step looks the name up first, so re-running it is a no-op
 * apart from re-synchronising passwords.
 *
 *   node scripts/beta.mjs run pnpm --filter api db:seed:beta
 */

/* The five entities that consume the shared référentiel through campaigns. */
const ORGANIZATIONS = [
  { name: 'OFTI', slug: 'ofti' },
  { name: 'GFTIJ', slug: 'gftij' },
  { name: 'INTERTRAD', slug: 'intertrad' },
  { name: 'SDI', slug: 'sdi' },
  { name: 'AFTIJ', slug: 'aftij' },
] as const;

/*
 * Two teams, in two different organizations, which is the minimum the planned
 * certification needs: one to receive the enrolment and work the prospect, and
 * a second under a different entity so the cross-entity collision test is
 * genuinely cross-entity rather than two teams of one company.
 */
const TEAMS = [
  { organizationSlug: 'ofti', name: 'OFTI Prospection', slug: 'ofti-prospection' },
  { organizationSlug: 'gftij', name: 'GFTIJ Prospection', slug: 'gftij-prospection' },
] as const;

async function seed(): Promise<void> {
  const password = process.env.BETA_USER_PASSWORD;

  if (!password) {
    throw new Error('BETA_USER_PASSWORD is required to bootstrap the beta tenant');
  }

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

    let tenant = await tenantService.findBySlug('trackroster-beta');

    if (!tenant) {
      tenant = await tenantService.create({ name: 'TrackRoster Beta', slug: 'trackroster-beta' });

      console.log(`Created beta tenant: ${tenant.id}`);
    } else {
      console.log(`Beta tenant already exists: ${tenant.id}`);
    }

    const tenantId = tenant.id;

    // ----------------------------------------------------------------
    // Organizations
    //
    // The establishment référentiel is tenant-level and carries no
    // organization_id, so these five reach it only through campaigns and
    // assignments. Creating them does not divide the base.
    // ----------------------------------------------------------------

    const organizationIds = new Map<string, string>();

    for (const entity of ORGANIZATIONS) {
      let organization = await organizationService.findBySlug(tenantId, entity.slug);

      if (!organization) {
        organization = await organizationService.create({
          tenantId,
          name: entity.name,
          slug: entity.slug,
        });

        console.log(`Created beta organization: ${entity.name}`);
      } else {
        console.log(`Beta organization already exists: ${entity.name}`);
      }

      organizationIds.set(entity.slug, organization.id);
    }

    // ----------------------------------------------------------------
    // Teams
    // ----------------------------------------------------------------

    const teamIds = new Map<string, string>();

    for (const definition of TEAMS) {
      const organizationId = organizationIds.get(definition.organizationSlug);

      if (!organizationId) {
        throw new Error(`Organization ${definition.organizationSlug} was not created`);
      }

      let team = await teamService.findBySlug(tenantId, organizationId, definition.slug);

      if (!team) {
        team = await teamService.create({
          tenantId,
          organizationId,
          name: definition.name,
          slug: definition.slug,
        });

        console.log(`Created beta team: ${definition.name}`);
      } else {
        console.log(`Beta team already exists: ${definition.name}`);
      }

      teamIds.set(definition.slug, team.id);
    }

    // ----------------------------------------------------------------
    // Identities
    //
    // One hash for all seven: they are local beta test accounts sharing one
    // generated password held only in .env.beta, and hashing once keeps a
    // re-run quick. The password is never logged.
    //
    // Hashed outside the transaction below: argon2 is deliberately slow, and
    // holding a transaction open across it for no reason is the kind of thing
    // that looks harmless until the same pattern appears in a request.
    // ----------------------------------------------------------------

    const passwordHash = await passwordService.hash(password);

    /*
     * The tenant context the repositories need.
     *
     * `UserRepository.findByEmail` reads `tenant_memberships`, which carries a
     * tenant-isolation policy, and this seed runs as `trackroster_app` like the
     * application does. Outside a tenant context that lookup returns no rows —
     * correctly — so a re-run saw no existing user, tried to insert, and was
     * stopped by `users_email_unique` instead. The first run only worked because
     * the write paths open their own context while that read does not.
     *
     * `withTenantContext` sets `trackroster.tenant_id` transaction-locally and
     * installs the transaction as the ambient executor, which is the same
     * mechanism a request uses. One transaction also makes the identity block
     * atomic: a failure part-way through leaves no half-built beta operator.
     */
    await withTenantContext(database, tenantId, async () => {
      async function ensureUser(email: string, displayName: string) {
        const existing = await userRepository.findByEmail(email);

        if (!existing) {
          const created = await userRepository.create({
            tenantId,
            email,
            displayName,
            passwordHash,
            status: 'active',
          });

          console.log(`Created beta user: ${created.email}`);

          return created;
        }

        /* Re-running must leave a usable password behind, as the development
         * seed does, otherwise a forgotten one strands the environment. */
        const synchronized = await userRepository.updatePasswordHash(
          tenantId,
          existing.id,
          passwordHash,
        );

        if (!synchronized) {
          throw new Error(`Failed to synchronize beta password for ${email}`);
        }

        console.log(`Synchronized beta password: ${synchronized.email}`);

        return synchronized;
      }

      async function ensureGrant(
        userId: string,
        email: string,
        role: 'client_admin' | 'director' | 'manager' | 'prospector' | 'observer',
        scope:
          | { scopeType: 'tenant' }
          | { scopeType: 'organization'; organizationId: string }
          | { scopeType: 'team'; organizationId: string; teamId: string },
      ): Promise<void> {
        const grants = await grantRepository.findByUser(tenantId, userId);

        const present = grants.some(
          (grant) =>
            grant.role === role &&
            grant.scopeType === scope.scopeType &&
            (scope.scopeType === 'tenant' ||
              (scope.scopeType === 'organization' &&
                grant.organizationId === scope.organizationId) ||
              (scope.scopeType === 'team' &&
                grant.organizationId === scope.organizationId &&
                grant.teamId === scope.teamId)),
        );

        if (present) {
          console.log(`Beta ${role} grant already exists: ${email}`);

          return;
        }

        await grantRepository.create({ tenantId, userId, role, ...scope });

        console.log(`Created beta ${role} grant: ${email}`);
      }

      const oftiOrganizationId = organizationIds.get('ofti')!;
      const gftijOrganizationId = organizationIds.get('gftij')!;
      const oftiTeamId = teamIds.get('ofti-prospection')!;
      const gftijTeamId = teamIds.get('gftij-prospection')!;

      const admin = await ensureUser('admin@beta.trackroster.test', 'Beta Administrator');

      await ensureGrant(admin.id, admin.email, 'client_admin', { scopeType: 'tenant' });

      const manager = await ensureUser('manager@beta.trackroster.test', 'Beta Manager OFTI');

      await ensureGrant(manager.id, manager.email, 'manager', {
        scopeType: 'team',
        organizationId: oftiOrganizationId,
        teamId: oftiTeamId,
      });

      const prospectorA = await ensureUser(
        'prospector-a@beta.trackroster.test',
        'Beta Prospector A',
      );

      await ensureGrant(prospectorA.id, prospectorA.email, 'prospector', {
        scopeType: 'team',
        organizationId: oftiOrganizationId,
        teamId: oftiTeamId,
      });

      /* Prospector B sits under a different entity on purpose: the collision test
       * is about two organizations reaching one shared establishment. */
      const prospectorB = await ensureUser(
        'prospector-b@beta.trackroster.test',
        'Beta Prospector B',
      );

      await ensureGrant(prospectorB.id, prospectorB.email, 'prospector', {
        scopeType: 'team',
        organizationId: gftijOrganizationId,
        teamId: gftijTeamId,
      });

      const director = await ensureUser('director@beta.trackroster.test', 'Beta Director');

      await ensureGrant(director.id, director.email, 'director', {
        scopeType: 'organization',
        organizationId: oftiOrganizationId,
      });

      /* The persisted role is `observer`; product language also calls this
       * read-only persona an auditor. Keep the canonical database role so the
       * fixture exercises the same authorization path as production. */
      const observer = await ensureUser('observer@beta.trackroster.test', 'Beta Observer Auditor');

      await ensureGrant(observer.id, observer.email, 'observer', {
        scopeType: 'organization',
        organizationId: oftiOrganizationId,
      });

      /* Platform authority is identity-level and separate from tenant roles.
       * A tenant membership is still required by login, so this fixture has a
       * tenant-scoped client-admin grant solely to make authenticated browser
       * checks possible; platformAdmin is derived from the grant below. */
      const superAdmin = await ensureUser(
        'super-admin@beta.trackroster.test',
        'Beta Super Administrator',
      );

      await ensureGrant(superAdmin.id, superAdmin.email, 'client_admin', {
        scopeType: 'tenant',
      });

      const [existingPlatformGrant] = await database
        .select({ id: platformAccessGrants.id })
        .from(platformAccessGrants)
        .where(
          and(
            eq(platformAccessGrants.identityId, superAdmin.id),
            eq(platformAccessGrants.role, 'super_admin'),
            isNull(platformAccessGrants.revokedAt),
          ),
        )
        .limit(1);

      if (existingPlatformGrant) {
        console.log(`Beta super_admin platform grant already exists: ${superAdmin.email}`);
      } else {
        await database.insert(platformAccessGrants).values({
          identityId: superAdmin.id,
          role: 'super_admin',
          grantSource: 'bootstrap',
          grantReason: 'TrackRoster beta role certification fixture',
          externalReference: 'trackroster-beta-super-admin',
        });

        console.log(`Created beta super_admin platform grant: ${superAdmin.email}`);
      }
    });

    console.log('Beta bootstrap complete.');
  } finally {
    await app.close();
  }
}

void seed();
