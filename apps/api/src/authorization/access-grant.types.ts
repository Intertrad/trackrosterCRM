export interface TenantAccessGrantInput {
  tenantId: string;
  userId: string;

  role: 'client_admin' | 'observer';
  scopeType: 'tenant';
}

export interface OrganizationAccessGrantInput {
  tenantId: string;
  userId: string;

  role: 'director' | 'observer';
  scopeType: 'organization';

  organizationId: string;
}

export interface TeamAccessGrantInput {
  tenantId: string;
  userId: string;

  role: 'manager' | 'prospector' | 'observer';
  scopeType: 'team';

  organizationId: string;
  teamId: string;
}

export type CreateAccessGrantInput =
  TenantAccessGrantInput | OrganizationAccessGrantInput | TeamAccessGrantInput;

/*
 * Server-resolved read authority for one resource.
 *
 * The discriminated union prevents a repository
 * caller from constructing an incoherent scope such
 * as a team without its owning organization.
 */
export type ResolvedViewScope =
  | {
      scopeType: 'tenant';

      organizationId: null;

      teamId: null;
    }
  | {
      scopeType: 'organization';

      organizationId: string;

      teamId: null;
    }
  | {
      scopeType: 'team';

      organizationId: string;

      teamId: string;
    };

export type CreateAccessGrantCommand = CreateAccessGrantInput & {
  /*
   * Authenticated administrator who is changing
   * another user's authorization.
   *
   * This value is supplied by CurrentAuth and is
   * never accepted from the request body.
   */
  actorUserId: string;
};

export interface RevokeAccessGrantCommand {
  tenantId: string;

  actorUserId: string;

  userId: string;

  grantId: string;
}
