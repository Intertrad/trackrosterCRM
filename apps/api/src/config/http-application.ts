import { ValidationPipe, VERSION_NEUTRAL, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { registerImportMultipart } from '../imports/import-multipart.js';
import { parseCorsOrigins, securityHeaders } from './http-security.js';

export async function configureHttpApplication(app: NestFastifyApplication): Promise<void> {
  const config = app.get(ConfigService);
  const allowedOrigins = parseCorsOrigins(config.get<string>('API_CORS_ORIGINS'));
  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    credentials: true,
  });

  const instance = app.getHttpAdapter().getInstance();
  instance.addHook(
    'onSend',
    async (_request: unknown, reply: { header: (key: string, value: string) => void }) => {
      for (const [key, value] of Object.entries(
        securityHeaders(config.get<string>('NODE_ENV')?.toLowerCase() === 'production'),
      )) {
        reply.header(key, value);
      }
    },
  );

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
