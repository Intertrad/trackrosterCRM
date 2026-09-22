import { ValidationPipe, VERSION_NEUTRAL, VersioningType } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { registerImportMultipart } from '../imports/import-multipart.js';

export async function configureHttpApplication(app: NestFastifyApplication): Promise<void> {
  // Preserve existing web clients while exposing the product's /api/v1 contract.
  app.enableVersioning({
    type: VersioningType.URI,
    prefix: 'api/v',
    defaultVersion: [VERSION_NEUTRAL, '1'],
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableShutdownHooks();
  await registerImportMultipart(app);
}
