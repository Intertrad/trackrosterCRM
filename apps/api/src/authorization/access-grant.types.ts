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
