import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { NewTenant, Tenant } from '../database/schema/tenants.js';
import { TenantRepository } from './tenant.repository.js';

export interface CreateTenantInput {
  name: string;
  slug: string;
}

@Injectable()
export class TenantService {
  constructor(
    @Inject(TenantRepository)
    private readonly tenantRepository: TenantRepository,
  ) {}

  async create(input: CreateTenantInput): Promise<Tenant> {
    const slug = input.slug.trim().toLowerCase();

    const existingTenant = await this.tenantRepository.findBySlug(slug);

    if (existingTenant) {
      throw new ConflictException(`Tenant with slug "${slug}" already exists`);
    }

    const tenant: NewTenant = {
      name: input.name.trim(),
      slug,
      status: 'active',
    };

    return this.tenantRepository.create(tenant);
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    return this.tenantRepository.findBySlug(slug.trim().toLowerCase());
  }

  async findById(id: string): Promise<Tenant | null> {
    return this.tenantRepository.findById(id);
  }
}
