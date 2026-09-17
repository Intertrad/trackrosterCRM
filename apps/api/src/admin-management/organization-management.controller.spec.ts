import { RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthGuard } from '../auth/auth.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { ClientAdminGuard } from '../authorization/client-admin.guard.js';
import type { Organization } from '../database/schema/organizations.js';
import { OrganizationService } from '../organizations/organization.service.js';
import { OrganizationManagementController } from './organization-management.controller.js';

describe('OrganizationManagementController', () => {
  let organizationService: {
    findByTenant: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
  };

  let controller: OrganizationManagementController;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const actorUserId = '22222222-2222-4222-8222-222222222222';

  const organizationId = '33333333-3333-4333-8333-333333333333';

  const auth = {
    tenantId,
    userId: actorUserId,
  } as AuthenticatedUser;

  const organization: Organization = {
    id: organizationId,
    tenantId,
    name: 'France Sales',
    slug: 'france-sales',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    organizationService = {
      findByTenant: vi.fn(),
      create: vi.fn(),
      updateStatus: vi.fn(),
    };

    controller = new OrganizationManagementController(
      organizationService as unknown as OrganizationService,
    );
  });

  it('uses the authenticated tenant when listing organizations', async () => {
    organizationService.findByTenant.mockResolvedValue([organization]);

    const result = await controller.list(auth);

    expect(organizationService.findByTenant).toHaveBeenCalledWith(tenantId);

    expect(result).toEqual([organization]);
  });

  it('uses the authenticated tenant when creating an organization', async () => {
    organizationService.create.mockResolvedValue(organization);

    const result = await controller.create(auth, {
      name: 'France Sales',
      slug: 'france-sales',
    });

    expect(organizationService.create).toHaveBeenCalledWith({
      tenantId,
      name: 'France Sales',
      slug: 'france-sales',
    });

    expect(result).toBe(organization);
  });

  it('uses the authenticated tenant and route organization id when updating status', async () => {
    const inactiveOrganization: Organization = {
      ...organization,
      status: 'inactive',
    };

    organizationService.updateStatus.mockResolvedValue(inactiveOrganization);

    const result = await controller.updateStatus(auth, organizationId, {
      status: 'inactive',
    });

    expect(organizationService.updateStatus).toHaveBeenCalledWith(
      tenantId,
      organizationId,
      'inactive',
    );

    expect(result).toBe(inactiveOrganization);
  });

  it('is exposed under the organizations route', () => {
    expect(Reflect.getMetadata(PATH_METADATA, OrganizationManagementController)).toBe(
      'organizations',
    );
  });

  it('requires authentication and Client Admin authorization', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, OrganizationManagementController)).toEqual([
      AuthGuard,
      ClientAdminGuard,
    ]);
  });

  it('exposes the expected organization management methods', () => {
    const prototype = OrganizationManagementController.prototype;

    expect(Reflect.getMetadata(PATH_METADATA, prototype.list)).toBe('/');

    expect(Reflect.getMetadata(METHOD_METADATA, prototype.list)).toBe(RequestMethod.GET);

    expect(Reflect.getMetadata(PATH_METADATA, prototype.create)).toBe('/');

    expect(Reflect.getMetadata(METHOD_METADATA, prototype.create)).toBe(RequestMethod.POST);

    expect(Reflect.getMetadata(PATH_METADATA, prototype.updateStatus)).toBe(
      ':organizationId/status',
    );

    expect(Reflect.getMetadata(METHOD_METADATA, prototype.updateStatus)).toBe(RequestMethod.PATCH);
  });
});
