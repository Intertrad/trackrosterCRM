import { randomUUID } from 'node:crypto';

import { NestFactory } from '@nestjs/core';
import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { DATABASE } from '../src/database/database.constants.js';
import type { Database } from '../src/database/database.types.js';
import { identities } from '../src/database/schema/identities.js';
import { organizations } from '../src/database/schema/organizations.js';
import { platformAccessGrants } from '../src/database/schema/platform-access-grants.js';
import { supportAccessGrants } from '../src/database/schema/support-access-grants.js';
import { teams } from '../src/database/schema/teams.js';
import { tenantMemberships } from '../src/database/schema/tenant-memberships.js';
import { tenants } from '../src/database/schema/tenants.js';
import { users } from '../src/database/schema/users.js';
import { OrganizationService } from '../src/organizations/organization.service.js';
import { TeamService } from '../src/teams/team.service.js';
import { TenantService } from '../src/tenants/tenant.service.js';
import { UserRepository } from '../src/users/user.repository.js';

describe('Identity and access schema integration', () => {
  let app: Awaited<ReturnType<typeof NestFactory.createApplicationContext>> | undefined;
  let database: Database | undefined;
  let userRepository: UserRepository;

  let tenantAId = '';
  let tenantBId = '';
  let organizationAId = '';
  let organizationBId = '';
  let teamAId = '';
  let teamBId = '';
  let legacyUserId = '';

  let bootstrapIdentityId = '';
  let bootstrapGrantId = '';
  let approverIdentityId = '';
  let supportOperatorIdentityId = '';
  let supportOperatorGrantId = '';

  const directIdentityIds: string[] = [];
  const extraMembershipIds: string[] = [];

  function getDatabase(): Database {
    if (!database) {
      throw new Error('Integration database has not been initialized');
    }

    return database;
  }

  function postgresConstraint(code: string, constraint: string): object {
    return {
      cause: {
        code,
        constraint,
      },
    };
  }

  function addMilliseconds(date: Date, milliseconds: number): Date {
    return new Date(date.getTime() + milliseconds);
  }

  async function createIdentity(label: string): Promise<string> {
    const id = randomUUID();
    const suffix = randomUUID().replaceAll('-', '');

    await getDatabase()
      .insert(identities)
      .values({
        id,
        email: `${label}-${suffix}@trackroster.test`,
        passwordHash: null,
        status: 'active',
      });

    directIdentityIds.push(id);

    return id;
  }

  async function createPlatformGrant(input: {
    identityId: string;
    role: 'super_admin' | 'support_operator';
    grantSource: 'bootstrap' | 'platform_admin';
    grantedByIdentityId?: string;
    label: string;
  }): Promise<string> {
    const id = randomUUID();
    const timestamp = new Date(Date.now() - 60_000);

    await getDatabase()
      .insert(platformAccessGrants)
      .values({
        id,
        identityId: input.identityId,
        role: input.role,
        grantSource: input.grantSource,
        grantedByIdentityId: input.grantedByIdentityId,
        grantReason: `Integration grant for ${input.label}`,
        externalReference: `integration-${input.label}-${randomUUID()}`,
        grantedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

    return id;
  }

  async function createSupportOperator(label: string): Promise<{
    identityId: string;
    grantId: string;
  }> {
    const identityId = await createIdentity(label);
    const grantId = await createPlatformGrant({
      identityId,
      role: 'support_operator',
      grantSource: 'platform_admin',
      grantedByIdentityId: bootstrapIdentityId,
      label,
    });

    return {
      identityId,
      grantId,
    };
  }

  async function getLegacyMirror(userId: string) {
    const [identity] = await getDatabase()
      .select()
      .from(identities)
      .where(eq(identities.id, userId))
      .limit(1);

    const [membership] = await getDatabase()
      .select()
      .from(tenantMemberships)
      .where(eq(tenantMemberships.id, userId))
      .limit(1);

    return {
      identity,
      membership,
    };
  }

  beforeAll(async () => {
    app = await NestFactory.createApplicationContext(AppModule, {
      logger: false,
      abortOnError: false,
    });

    database = app.get<Database>(DATABASE);
    userRepository = app.get(UserRepository);

    const tenantService = app.get(TenantService);
    const organizationService = app.get(OrganizationService);
    const teamService = app.get(TeamService);
    const suffix = randomUUID().replaceAll('-', '').slice(0, 12);

    const tenantA = await tenantService.create({
      name: `Identity Schema Tenant A ${suffix}`,
      slug: `identity-schema-a-${suffix}`,
    });

    const tenantB = await tenantService.create({
      name: `Identity Schema Tenant B ${suffix}`,
      slug: `identity-schema-b-${suffix}`,
    });

    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    const organizationA = await organizationService.create({
      tenantId: tenantAId,
      name: `Identity Organization A ${suffix}`,
      slug: `identity-organization-a-${suffix}`,
    });

    const organizationB = await organizationService.create({
      tenantId: tenantBId,
      name: `Identity Organization B ${suffix}`,
      slug: `identity-organization-b-${suffix}`,
    });

    organizationAId = organizationA.id;
    organizationBId = organizationB.id;

    const teamA = await teamService.create({
      tenantId: tenantAId,
      organizationId: organizationAId,
      name: `Identity Team A ${suffix}`,
      slug: `identity-team-a-${suffix}`,
    });

    const teamB = await teamService.create({
      tenantId: tenantBId,
      organizationId: organizationBId,
      name: `Identity Team B ${suffix}`,
      slug: `identity-team-b-${suffix}`,
    });

    teamAId = teamA.id;
    teamBId = teamB.id;

    const legacyUser = await userRepository.create({
      tenantId: tenantAId,
      email: `identity-legacy-${suffix}@trackroster.test`,
      displayName: 'Identity Legacy User',
      passwordHash: 'identity-schema-initial-password-hash',
      status: 'active',
    });

    legacyUserId = legacyUser.id;

    bootstrapIdentityId = await createIdentity('bootstrap-admin');
    bootstrapGrantId = await createPlatformGrant({
      identityId: bootstrapIdentityId,
      role: 'super_admin',
      grantSource: 'bootstrap',
      label: 'bootstrap-admin',
    });

    approverIdentityId = await createIdentity('support-approver');
    await createPlatformGrant({
      identityId: approverIdentityId,
      role: 'super_admin',
      grantSource: 'platform_admin',
      grantedByIdentityId: bootstrapIdentityId,
      label: 'support-approver',
    });

    supportOperatorIdentityId = await createIdentity('support-operator');
    supportOperatorGrantId = await createPlatformGrant({
      identityId: supportOperatorIdentityId,
      role: 'support_operator',
      grantSource: 'platform_admin',
      grantedByIdentityId: bootstrapIdentityId,
      label: 'support-operator',
    });
  });

  afterAll(async () => {
    try {
      if (database) {
        if (tenantAId) {
          await database
            .delete(supportAccessGrants)
            .where(inArray(supportAccessGrants.tenantId, [tenantAId, tenantBId]));
        }

        if (directIdentityIds.length > 0) {
          await database
            .delete(platformAccessGrants)
            .where(inArray(platformAccessGrants.identityId, directIdentityIds));
        }

        if (extraMembershipIds.length > 0) {
          await database
            .delete(tenantMemberships)
            .where(inArray(tenantMemberships.id, extraMembershipIds));
        }

        if (tenantAId) {
          await database.delete(users).where(eq(users.tenantId, tenantAId));
        }

        if (tenantBId) {
          await database.delete(users).where(eq(users.tenantId, tenantBId));
        }

        if (tenantAId && tenantBId) {
          await database
            .delete(tenantMemberships)
            .where(inArray(tenantMemberships.tenantId, [tenantAId, tenantBId]));
        }

        if (directIdentityIds.length > 0) {
          await database.delete(identities).where(inArray(identities.id, directIdentityIds));
        }

        if (tenantAId) {
          await database.delete(teams).where(eq(teams.tenantId, tenantAId));
          await database.delete(organizations).where(eq(organizations.tenantId, tenantAId));
          await database.delete(tenants).where(eq(tenants.id, tenantAId));
        }

        if (tenantBId) {
          await database.delete(teams).where(eq(teams.tenantId, tenantBId));
          await database.delete(organizations).where(eq(organizations.tenantId, tenantBId));
          await database.delete(tenants).where(eq(tenants.id, tenantBId));
        }
      }
    } finally {
      if (app) {
        await app.close();
      }
    }
  });

  it('reconciles each legacy fixture to a same-id identity and tenant membership', async () => {
    const rows = await getDatabase()
      .select({
        userId: users.id,
        userTenantId: users.tenantId,
        userEmail: users.email,
        userPasswordHash: users.passwordHash,
        userDisplayName: users.displayName,
        userStatus: users.status,
        userCreatedAt: users.createdAt,
        userUpdatedAt: users.updatedAt,
        identityId: identities.id,
        identityEmail: identities.email,
        identityPasswordHash: identities.passwordHash,
        identityStatus: identities.status,
        identityCredentialsUpdatedAt: identities.credentialsUpdatedAt,
        identitySecurityStateUpdatedAt: identities.securityStateUpdatedAt,
        identitySuspendedAt: identities.suspendedAt,
        identityDisabledAt: identities.disabledAt,
        identityCreatedAt: identities.createdAt,
        identityUpdatedAt: identities.updatedAt,
        membershipId: tenantMemberships.id,
        membershipTenantId: tenantMemberships.tenantId,
        membershipIdentityId: tenantMemberships.identityId,
        membershipDisplayName: tenantMemberships.displayName,
        membershipStatus: tenantMemberships.status,
        membershipInvitedAt: tenantMemberships.invitedAt,
        membershipActivatedAt: tenantMemberships.activatedAt,
        membershipSuspendedAt: tenantMemberships.suspendedAt,
        membershipDepartedAt: tenantMemberships.departedAt,
        membershipDefaultOrganizationId: tenantMemberships.defaultOrganizationId,
        membershipDefaultTeamId: tenantMemberships.defaultTeamId,
        membershipCreatedAt: tenantMemberships.createdAt,
        membershipUpdatedAt: tenantMemberships.updatedAt,
      })
      .from(users)
      .leftJoin(identities, eq(identities.id, users.id))
      .leftJoin(
        tenantMemberships,
        and(eq(tenantMemberships.id, users.id), eq(tenantMemberships.tenantId, users.tenantId)),
      )
      .where(inArray(users.tenantId, [tenantAId, tenantBId]));

    expect(rows.length).toBeGreaterThan(0);

    for (const row of rows) {
      expect(row.identityId).toBe(row.userId);
      expect(row.identityEmail).toBe(row.userEmail);
      expect(row.identityPasswordHash).toBe(row.userPasswordHash);
      expect(row.identityStatus).toBe(row.userStatus);
      expect(row.identityCredentialsUpdatedAt).toEqual(row.userUpdatedAt);
      expect(row.identitySecurityStateUpdatedAt).toEqual(row.userUpdatedAt);
      expect(row.identityCreatedAt).toEqual(row.userCreatedAt);
      expect(row.identityUpdatedAt).toEqual(row.userUpdatedAt);

      expect(row.membershipId).toBe(row.userId);
      expect(row.membershipTenantId).toBe(row.userTenantId);
      expect(row.membershipIdentityId).toBe(row.userId);
      expect(row.membershipDisplayName).toBe(row.userDisplayName);
      expect(row.membershipInvitedAt).toBeNull();
      expect(row.membershipActivatedAt).toEqual(row.userCreatedAt);
      expect(row.membershipDepartedAt).toBeNull();
      expect(row.membershipDefaultOrganizationId).toBeNull();
      expect(row.membershipDefaultTeamId).toBeNull();
      expect(row.membershipCreatedAt).toEqual(row.userCreatedAt);
      expect(row.membershipUpdatedAt).toEqual(row.userUpdatedAt);

      if (row.userStatus === 'active') {
        expect(row.identitySuspendedAt).toBeNull();
        expect(row.identityDisabledAt).toBeNull();
        expect(row.membershipStatus).toBe('active');
        expect(row.membershipSuspendedAt).toBeNull();
      } else {
        expect(row.membershipStatus).toBe('suspended');
        expect(row.membershipSuspendedAt).not.toBeNull();

        if (row.userStatus === 'suspended') {
          expect(row.identitySuspendedAt).not.toBeNull();
          expect(row.identityDisabledAt).toBeNull();
        } else {
          expect(row.identityDisabledAt).not.toBeNull();
        }
      }
    }
  });

  it('atomically mirrors legacy creates and preserves suspension time across unrelated updates', async () => {
    const initialMirror = await getLegacyMirror(legacyUserId);

    expect(initialMirror.identity).toMatchObject({
      id: legacyUserId,
      email: expect.stringContaining('identity-legacy-'),
      passwordHash: 'identity-schema-initial-password-hash',
      status: 'active',
    });
    expect(initialMirror.membership).toMatchObject({
      id: legacyUserId,
      tenantId: tenantAId,
      identityId: legacyUserId,
      displayName: 'Identity Legacy User',
      status: 'active',
    });

    await getDatabase()
      .update(users)
      .set({ status: 'suspended', updatedAt: new Date() })
      .where(eq(users.id, legacyUserId));

    const suspendedMirror = await getLegacyMirror(legacyUserId);
    const identitySuspendedAt = suspendedMirror.identity?.suspendedAt;
    const membershipSuspendedAt = suspendedMirror.membership?.suspendedAt;

    expect(identitySuspendedAt).toBeInstanceOf(Date);
    expect(membershipSuspendedAt).toBeInstanceOf(Date);

    await getDatabase()
      .update(users)
      .set({ displayName: 'Updated Legacy Name', updatedAt: new Date() })
      .where(eq(users.id, legacyUserId));
    await getDatabase()
      .update(users)
      .set({ passwordHash: 'identity-schema-updated-password-hash', updatedAt: new Date() })
      .where(eq(users.id, legacyUserId));

    const updatedMirror = await getLegacyMirror(legacyUserId);

    expect(updatedMirror.identity?.passwordHash).toBe('identity-schema-updated-password-hash');
    expect(updatedMirror.identity?.suspendedAt?.getTime()).toBe(identitySuspendedAt?.getTime());
    expect(updatedMirror.membership?.displayName).toBe('Updated Legacy Name');
    expect(updatedMirror.membership?.suspendedAt?.getTime()).toBe(membershipSuspendedAt?.getTime());

    await getDatabase()
      .update(users)
      .set({ status: 'disabled', updatedAt: new Date() })
      .where(eq(users.id, legacyUserId));

    const disabledMirror = await getLegacyMirror(legacyUserId);

    expect(disabledMirror.identity?.status).toBe('disabled');
    expect(disabledMirror.identity?.disabledAt).toBeInstanceOf(Date);
    expect(disabledMirror.identity?.suspendedAt?.getTime()).toBe(identitySuspendedAt?.getTime());
    expect(disabledMirror.membership?.status).toBe('suspended');
    expect(disabledMirror.membership?.suspendedAt?.getTime()).toBe(
      membershipSuspendedAt?.getTime(),
    );

    await getDatabase()
      .update(users)
      .set({ status: 'active', updatedAt: new Date() })
      .where(eq(users.id, legacyUserId));

    const activeMirror = await getLegacyMirror(legacyUserId);

    expect(activeMirror.identity?.status).toBe('active');
    expect(activeMirror.identity?.suspendedAt).toBeNull();
    expect(activeMirror.identity?.disabledAt).toBeNull();
    expect(activeMirror.membership?.status).toBe('active');
    expect(activeMirror.membership?.suspendedAt).toBeNull();
  });

  it('rolls a legacy write back when the shadow identity rejects it', async () => {
    const paddedEmailUserId = randomUUID();

    await expect(
      getDatabase()
        .insert(users)
        .values({
          id: paddedEmailUserId,
          tenantId: tenantAId,
          email: ` padded-${randomUUID()}@trackroster.test `,
          passwordHash: 'valid-password-hash',
          status: 'active',
        }),
    ).rejects.toMatchObject(postgresConstraint('23514', 'identities_email_normalized_check'));

    const [legacyUser] = await getDatabase()
      .select({
        id: users.id,
      })
      .from(users)
      .where(eq(users.id, paddedEmailUserId))
      .limit(1);

    expect(legacyUser).toBeUndefined();
  });

  it('removes an unreferenced shadow identity when a legacy user is directly deleted', async () => {
    const suffix = randomUUID().replaceAll('-', '');
    const temporaryUser = await userRepository.create({
      tenantId: tenantAId,
      email: `identity-delete-${suffix}@trackroster.test`,
      passwordHash: 'identity-delete-password-hash',
      status: 'active',
    });

    expect((await getLegacyMirror(temporaryUser.id)).identity).toBeDefined();

    await getDatabase().delete(users).where(eq(users.id, temporaryUser.id));

    const deletedMirror = await getLegacyMirror(temporaryUser.id);

    expect(deletedMirror.identity).toBeUndefined();
    expect(deletedMirror.membership).toBeUndefined();
  });

  it('supports multi-tenant membership while rejecting duplicate and malformed memberships', async () => {
    const timestamp = new Date();
    const secondMembershipId = randomUUID();

    await getDatabase().insert(tenantMemberships).values({
      id: secondMembershipId,
      tenantId: tenantBId,
      identityId: legacyUserId,
      displayName: 'Legacy User in Tenant B',
      status: 'active',
      activatedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    extraMembershipIds.push(secondMembershipId);

    await expect(
      getDatabase().insert(tenantMemberships).values({
        tenantId: tenantBId,
        identityId: legacyUserId,
        displayName: 'Duplicate membership',
        status: 'active',
        activatedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
    ).rejects.toMatchObject(
      postgresConstraint('23505', 'tenant_memberships_tenant_identity_unique'),
    );

    const malformedIdentityId = await createIdentity('malformed-membership');

    await expect(
      getDatabase().insert(tenantMemberships).values({
        tenantId: tenantAId,
        identityId: malformedIdentityId,
        status: 'active',
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
    ).rejects.toMatchObject(
      postgresConstraint('23514', 'tenant_memberships_status_timestamps_check'),
    );

    await expect(
      getDatabase().insert(tenantMemberships).values({
        tenantId: tenantAId,
        identityId: malformedIdentityId,
        status: 'active',
        activatedAt: timestamp,
        defaultTeamId: teamAId,
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
    ).rejects.toMatchObject(
      postgresConstraint('23514', 'tenant_memberships_default_scope_shape_check'),
    );
  });

  it('retains a global identity when deleting one legacy tenant membership', async () => {
    const suffix = randomUUID().replaceAll('-', '');
    const temporaryUser = await userRepository.create({
      tenantId: tenantAId,
      email: `identity-multi-tenant-delete-${suffix}@trackroster.test`,
      passwordHash: 'identity-multi-tenant-delete-password-hash',
      status: 'active',
    });
    const secondMembershipId = randomUUID();
    const timestamp = new Date();

    await getDatabase().insert(tenantMemberships).values({
      id: secondMembershipId,
      tenantId: tenantBId,
      identityId: temporaryUser.id,
      displayName: 'Multi-tenant retained identity',
      status: 'active',
      activatedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    extraMembershipIds.push(secondMembershipId);
    directIdentityIds.push(temporaryUser.id);

    await getDatabase().delete(users).where(eq(users.id, temporaryUser.id));

    const retainedMirror = await getLegacyMirror(temporaryUser.id);
    const [remainingMembership] = await getDatabase()
      .select()
      .from(tenantMemberships)
      .where(eq(tenantMemberships.id, secondMembershipId))
      .limit(1);

    expect(retainedMirror.identity).toMatchObject({
      id: temporaryUser.id,
      status: 'active',
    });
    expect(retainedMirror.membership).toBeUndefined();
    expect(remainingMembership).toMatchObject({
      tenantId: tenantBId,
      identityId: temporaryUser.id,
      status: 'active',
    });
  });

  it('rejects cross-tenant default organization and team preferences', async () => {
    const organizationIdentityId = await createIdentity('cross-tenant-organization');
    const teamIdentityId = await createIdentity('cross-tenant-team');
    const timestamp = new Date();

    await expect(
      getDatabase().insert(tenantMemberships).values({
        tenantId: tenantAId,
        identityId: organizationIdentityId,
        status: 'active',
        activatedAt: timestamp,
        defaultOrganizationId: organizationBId,
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
    ).rejects.toMatchObject(
      postgresConstraint('23503', 'tenant_memberships_default_organization_fk'),
    );

    await expect(
      getDatabase().insert(tenantMemberships).values({
        tenantId: tenantAId,
        identityId: teamIdentityId,
        status: 'active',
        activatedAt: timestamp,
        defaultOrganizationId: organizationAId,
        defaultTeamId: teamBId,
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
    ).rejects.toMatchObject(postgresConstraint('23503', 'tenant_memberships_default_team_fk'));
  });

  it('enforces bootstrap provenance and one unrevoked grant per identity role', async () => {
    const invalidBootstrapIdentityId = await createIdentity('invalid-bootstrap-operator');
    const timestamp = new Date(Date.now() - 60_000);

    await expect(
      getDatabase()
        .insert(platformAccessGrants)
        .values({
          identityId: invalidBootstrapIdentityId,
          role: 'support_operator',
          grantSource: 'bootstrap',
          grantReason: 'Invalid unaudited support bootstrap',
          externalReference: `invalid-bootstrap-${randomUUID()}`,
          grantedAt: timestamp,
          createdAt: timestamp,
          updatedAt: timestamp,
        }),
    ).rejects.toMatchObject(
      postgresConstraint('23514', 'platform_access_grants_source_actor_check'),
    );

    await expect(
      createPlatformGrant({
        identityId: supportOperatorIdentityId,
        role: 'support_operator',
        grantSource: 'platform_admin',
        grantedByIdentityId: bootstrapIdentityId,
        label: 'duplicate-support-operator',
      }),
    ).rejects.toMatchObject(
      postgresConstraint('23505', 'platform_access_grants_identity_role_unrevoked_unique'),
    );

    await createPlatformGrant({
      identityId: supportOperatorIdentityId,
      role: 'super_admin',
      grantSource: 'platform_admin',
      grantedByIdentityId: bootstrapIdentityId,
      label: 'operator-separate-super-admin-role',
    });

    const replacementIdentityId = await createIdentity('replaceable-support-operator');
    const originalGrantId = await createPlatformGrant({
      identityId: replacementIdentityId,
      role: 'support_operator',
      grantSource: 'platform_admin',
      grantedByIdentityId: bootstrapIdentityId,
      label: 'replaceable-support-operator',
    });
    const revokedAt = new Date();

    await expect(
      getDatabase()
        .update(platformAccessGrants)
        .set({
          revokedAt,
          updatedAt: revokedAt,
        })
        .where(eq(platformAccessGrants.id, originalGrantId)),
    ).rejects.toMatchObject(postgresConstraint('23514', 'platform_access_grants_revocation_check'));

    await getDatabase()
      .update(platformAccessGrants)
      .set({
        revokedByIdentityId: bootstrapIdentityId,
        revokedAt,
        revocationReason: 'Integration replacement',
        updatedAt: revokedAt,
      })
      .where(eq(platformAccessGrants.id, originalGrantId));

    await expect(
      createPlatformGrant({
        identityId: replacementIdentityId,
        role: 'support_operator',
        grantSource: 'platform_admin',
        grantedByIdentityId: bootstrapIdentityId,
        label: 'replacement-support-operator',
      }),
    ).resolves.toBeTruthy();
  });

  it('accepts requested, approved, revoked, and denied support workflow shapes', async () => {
    const base = new Date(Date.now() - 60_000);
    const requestedAt = base;
    const [requested] = await getDatabase()
      .insert(supportAccessGrants)
      .values({
        platformIdentityId: supportOperatorIdentityId,
        platformAccessGrantId: supportOperatorGrantId,
        tenantId: tenantAId,
        reason: 'Investigate tenant synchronization issue',
        externalReference: `SUP-${randomUUID()}`,
        status: 'requested',
        requestedByIdentityId: supportOperatorIdentityId,
        requestedAt,
        createdAt: base,
        updatedAt: base,
      })
      .returning();

    expect(requested).toBeDefined();

    await expect(
      getDatabase()
        .insert(supportAccessGrants)
        .values({
          platformIdentityId: supportOperatorIdentityId,
          platformAccessGrantId: supportOperatorGrantId,
          tenantId: tenantAId,
          reason: 'Duplicate pending request',
          externalReference: `SUP-${randomUUID()}`,
          status: 'requested',
          requestedByIdentityId: supportOperatorIdentityId,
          requestedAt,
          createdAt: base,
          updatedAt: base,
        }),
    ).rejects.toMatchObject(postgresConstraint('23505', 'support_access_grants_pending_unique'));

    if (!requested) {
      throw new Error('Requested support access fixture was not created');
    }

    const approvedAt = addMilliseconds(requestedAt, 1_000);
    const activatedAt = addMilliseconds(approvedAt, 1_000);
    const expiresAt = addMilliseconds(activatedAt, 8 * 60 * 60 * 1_000);

    await getDatabase()
      .update(supportAccessGrants)
      .set({
        status: 'approved',
        approvedByIdentityId: approverIdentityId,
        approvedAt,
        activatedAt,
        expiresAt,
        updatedAt: activatedAt,
      })
      .where(eq(supportAccessGrants.id, requested.id));

    const revokedAt = addMilliseconds(activatedAt, 60_000);

    await expect(
      getDatabase()
        .update(supportAccessGrants)
        .set({
          status: 'revoked',
          revokedAt,
          updatedAt: revokedAt,
        })
        .where(eq(supportAccessGrants.id, requested.id)),
    ).rejects.toMatchObject(postgresConstraint('23514', 'support_access_grants_state_shape_check'));

    await getDatabase()
      .update(supportAccessGrants)
      .set({
        status: 'revoked',
        revokedByIdentityId: approverIdentityId,
        revokedAt,
        revocationReason: 'Support session complete',
        updatedAt: revokedAt,
      })
      .where(eq(supportAccessGrants.id, requested.id));

    const [revoked] = await getDatabase()
      .select()
      .from(supportAccessGrants)
      .where(eq(supportAccessGrants.id, requested.id))
      .limit(1);

    expect(revoked).toMatchObject({
      status: 'revoked',
      scope: 'read_only',
      platformRole: 'support_operator',
      revokedByIdentityId: approverIdentityId,
    });

    const deniedOperator = await createSupportOperator('denied-support-operator');
    const deniedAt = addMilliseconds(base, 1_000);

    await expect(
      getDatabase()
        .insert(supportAccessGrants)
        .values({
          platformIdentityId: deniedOperator.identityId,
          platformAccessGrantId: deniedOperator.grantId,
          tenantId: tenantBId,
          reason: 'Request that should be denied',
          externalReference: `SUP-${randomUUID()}`,
          status: 'denied',
          requestedByIdentityId: deniedOperator.identityId,
          requestedAt: base,
          deniedByIdentityId: approverIdentityId,
          deniedAt,
          denialReason: 'Insufficient justification',
          createdAt: base,
          updatedAt: deniedAt,
        }),
    ).resolves.toBeDefined();
  });

  it('rejects wrong platform roles, cross-identity grants, self-approval, and unsafe windows', async () => {
    const isolatedOperator = await createSupportOperator('isolated-support-operator');
    const otherOperatorIdentityId = await createIdentity('other-support-operator');
    const base = new Date(Date.now() - 60_000);
    const approvedAt = addMilliseconds(base, 1_000);
    const activatedAt = addMilliseconds(approvedAt, 1_000);
    const safeExpiresAt = addMilliseconds(activatedAt, 60 * 60 * 1_000);

    await expect(
      getDatabase()
        .insert(supportAccessGrants)
        .values({
          platformIdentityId: bootstrapIdentityId,
          platformAccessGrantId: bootstrapGrantId,
          tenantId: tenantAId,
          reason: 'Super admin is not a support operator',
          externalReference: `SUP-${randomUUID()}`,
          status: 'requested',
          requestedByIdentityId: bootstrapIdentityId,
          requestedAt: base,
          createdAt: base,
          updatedAt: base,
        }),
    ).rejects.toMatchObject(
      postgresConstraint('23503', 'support_access_grants_platform_identity_grant_role_fk'),
    );

    await expect(
      getDatabase()
        .insert(supportAccessGrants)
        .values({
          platformIdentityId: bootstrapIdentityId,
          platformAccessGrantId: bootstrapGrantId,
          platformRole: 'super_admin',
          tenantId: tenantAId,
          reason: 'Support role cannot be widened',
          externalReference: `SUP-${randomUUID()}`,
          status: 'requested',
          requestedByIdentityId: bootstrapIdentityId,
          requestedAt: base,
          createdAt: base,
          updatedAt: base,
        }),
    ).rejects.toMatchObject(
      postgresConstraint('23514', 'support_access_grants_platform_role_check'),
    );

    await expect(
      getDatabase()
        .insert(supportAccessGrants)
        .values({
          platformIdentityId: otherOperatorIdentityId,
          platformAccessGrantId: isolatedOperator.grantId,
          tenantId: tenantAId,
          reason: 'Grant belongs to another identity',
          externalReference: `SUP-${randomUUID()}`,
          status: 'requested',
          requestedByIdentityId: otherOperatorIdentityId,
          requestedAt: base,
          createdAt: base,
          updatedAt: base,
        }),
    ).rejects.toMatchObject(
      postgresConstraint('23503', 'support_access_grants_platform_identity_grant_role_fk'),
    );

    await expect(
      getDatabase()
        .insert(supportAccessGrants)
        .values({
          platformIdentityId: isolatedOperator.identityId,
          platformAccessGrantId: isolatedOperator.grantId,
          tenantId: tenantAId,
          reason: 'Self-approved request',
          externalReference: `SUP-${randomUUID()}`,
          status: 'approved',
          requestedByIdentityId: isolatedOperator.identityId,
          requestedAt: base,
          approvedByIdentityId: isolatedOperator.identityId,
          approvedAt,
          activatedAt,
          expiresAt: safeExpiresAt,
          createdAt: base,
          updatedAt: activatedAt,
        }),
    ).rejects.toMatchObject(
      postgresConstraint('23514', 'support_access_grants_decision_actor_separation_check'),
    );

    await expect(
      getDatabase()
        .insert(supportAccessGrants)
        .values({
          platformIdentityId: isolatedOperator.identityId,
          platformAccessGrantId: isolatedOperator.grantId,
          tenantId: tenantAId,
          reason: 'Window exceeds the support maximum',
          externalReference: `SUP-${randomUUID()}`,
          status: 'approved',
          requestedByIdentityId: isolatedOperator.identityId,
          requestedAt: base,
          approvedByIdentityId: approverIdentityId,
          approvedAt,
          activatedAt,
          expiresAt: addMilliseconds(activatedAt, 8 * 60 * 60 * 1_000 + 1),
          createdAt: base,
          updatedAt: activatedAt,
        }),
    ).rejects.toMatchObject(
      postgresConstraint('23514', 'support_access_grants_timestamp_order_check'),
    );

    await expect(
      getDatabase()
        .insert(supportAccessGrants)
        .values({
          platformIdentityId: isolatedOperator.identityId,
          platformAccessGrantId: isolatedOperator.grantId,
          tenantId: tenantAId,
          reason: '',
          externalReference: `SUP-${randomUUID()}`,
          status: 'requested',
          requestedByIdentityId: isolatedOperator.identityId,
          requestedAt: base,
          createdAt: base,
          updatedAt: base,
        }),
    ).rejects.toMatchObject(
      postgresConstraint('23514', 'support_access_grants_reason_not_blank_check'),
    );
  });
});
