import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from '../../app.module.js';
import { TenantService } from '../../tenants/tenant.service.js';

async function seed(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const tenantService = app.get(TenantService);

    const existingTenant = await tenantService.findBySlug('intertrad');

    if (existingTenant) {
      console.log(`Development tenant already exists: ${existingTenant.id}`);
      return;
    }

    const tenant = await tenantService.create({
      name: 'Intertrad',
      slug: 'intertrad',
    });

    console.log(`Created development tenant: ${tenant.id}`);
  } finally {
    await app.close();
  }
}

seed().catch((error: unknown) => {
  console.error('Database seed failed:', error);
  process.exitCode = 1;
});
