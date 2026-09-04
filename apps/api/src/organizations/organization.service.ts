import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import { NewOrganization, Organization } from '../database/schema/organizations.js';
import { TenantRepository } from '../tenants/tenant.repository.js';
import { OrganizationRepository } from './organization.repository.js';

export interface CreateOrganizationInput {
  tenantId: string;
  name: string;
  slug: string;
}

@Injectable()
export class OrganizationService {
  constructor(
    @Inject(OrganizationRepository)
    private readonly organizationRepository: OrganizationRepository,

    @Inject(TenantRepository)
    private readonly tenantRepository: TenantRepository,
  ) {}

  async create(input: CreateOrganizationInput): Promise<Organization> {
    const tenant = await this.tenantRepository.findById(input.tenantId);

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const slug = input.slug.trim().toLowerCase();

    const existingOrganization = await this.organizationRepository.findBySlug(input.tenantId, slug);

    if (existingOrganization) {
      throw new ConflictException(`Organization with slug "${slug}" already exists in this tenant`);
    }

    const organization: NewOrganization = {
      tenantId: input.tenantId,
      name: input.name.trim(),
      slug,
      status: 'active',
    };

    return this.organizationRepository.create(organization);
  }

  async findById(tenantId: string, organizationId: string): Promise<Organization | null> {
    return this.organizationRepository.findById(tenantId, organizationId);
  }

  async findBySlug(tenantId: string, slug: string): Promise<Organization | null> {
    return this.organizationRepository.findBySlug(tenantId, slug.trim().toLowerCase());
  }

  async findByTenant(tenantId: string): Promise<Organization[]> {
    return this.organizationRepository.findByTenant(tenantId);
  }
}
