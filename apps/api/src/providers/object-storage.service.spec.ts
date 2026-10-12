import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { ObjectStorageService } from './object-storage.service.js';

const credentials = {
  OBJECT_STORAGE_ENDPOINT: 'https://objects.example.test/s3',
  OBJECT_STORAGE_BUCKET: 'trackroster-files',
  OBJECT_STORAGE_ACCESS_KEY_ID: 'access-key',
  OBJECT_STORAGE_SECRET_ACCESS_KEY: 'secret-key',
  OBJECT_STORAGE_REGION: 'eu-west-1',
};

describe('ObjectStorageService', () => {
  it('configures from the canonical OBJECT_STORAGE_* environment names', async () => {
    const service = new ObjectStorageService(new ConfigService(credentials));

    expect(service.configured()).toBe(true);
    await expect(service.uploadUrl('tenant/file.txt', 'text/plain')).resolves.toContain(
      'objects.example.test/s3/tenant/file.txt',
    );
  });

  it('keeps the legacy R2_* names working for local setups', () => {
    const service = new ObjectStorageService(
      new ConfigService({
        R2_ENDPOINT: 'http://127.0.0.1:9000',
        R2_BUCKET: 'trackroster-dev',
        R2_ACCESS_KEY_ID: 'minio',
        R2_SECRET_ACCESS_KEY: 'minio-secret',
        R2_FORCE_PATH_STYLE: 'true',
      }),
    );

    expect(service.configured()).toBe(true);
  });

  it('reports storage as unavailable when endpoint or bucket is missing', () => {
    expect(
      new ObjectStorageService(
        new ConfigService({ OBJECT_STORAGE_BUCKET: 'trackroster-files' }),
      ).configured(),
    ).toBe(false);
    expect(
      new ObjectStorageService(
        new ConfigService({ OBJECT_STORAGE_ENDPOINT: 'https://objects.example.test/s3' }),
      ).configured(),
    ).toBe(false);
  });
});
