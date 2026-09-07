import multipart from '@fastify/multipart';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

import { MAX_IMPORT_FILE_BYTES } from './import-preview.constants.js';

/*
 * @fastify/multipart and Nest's Fastify adapter can resolve
 * different Fastify type identities.
 *
 * Keep the compatibility cast isolated to this registration
 * boundary instead of importing Fastify types directly.
 */
type NestFastifyPlugin = Parameters<NestFastifyApplication['register']>[0];

const multipartPlugin = multipart as unknown as NestFastifyPlugin;

export async function registerImportMultipart(app: NestFastifyApplication): Promise<void> {
  await app.register(multipartPlugin, {
    limits: {
      fileSize: MAX_IMPORT_FILE_BYTES,
      files: 1,
    },
  });
}
