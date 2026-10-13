import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { WorkerArtifactStorageService } from './worker-artifact-storage.service.js';

describe('WorkerArtifactStorageService', () => {
  it('configures from the canonical object-storage environment names', () => {
    const service = new WorkerArtifactStorageService(
      new ConfigService({
        OBJECT_STORAGE_ENDPOINT: 'https://objects.example.test/s3',
        OBJECT_STORAGE_BUCKET: 'trackroster-files',
        OBJECT_STORAGE_ACCESS_KEY_ID: 'access-key',
        OBJECT_STORAGE_SECRET_ACCESS_KEY: 'secret-key',
        OBJECT_STORAGE_REGION: 'eu-west-1',
        OBJECT_STORAGE_FORCE_PATH_STYLE: 'true',
      }),
    );

    expect(service.configured()).toBe(true);
  });

  it('keeps legacy R2 names working for existing local deployments', () => {
    const service = new WorkerArtifactStorageService(
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

  it('reports storage as unavailable when required settings are missing', () => {
    expect(
      new WorkerArtifactStorageService(
        new ConfigService({ OBJECT_STORAGE_BUCKET: 'trackroster-files' }),
      ).configured(),
    ).toBe(false);
  });
});
