import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

@Injectable()
export class WorkerArtifactStorageService {
  private readonly client: S3Client | null;
  private readonly bucket: string;
  constructor(config: ConfigService) {
    /*
     * Keep the worker on the same provider contract as the API. The
     * OBJECT_STORAGE_* names are canonical; R2_* remains a compatibility
     * alias for existing local deployments.
     */
    const value = (...keys: string[]): string | undefined => {
      for (const key of keys) {
        const candidate = config.get<string>(key);
        if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
      }
      return undefined;
    };

    this.bucket = value('OBJECT_STORAGE_BUCKET', 'R2_BUCKET') ?? '';
    const endpoint = value('OBJECT_STORAGE_ENDPOINT', 'R2_ENDPOINT');
    const accessKeyId = value('OBJECT_STORAGE_ACCESS_KEY_ID', 'R2_ACCESS_KEY_ID');
    const secretAccessKey = value('OBJECT_STORAGE_SECRET_ACCESS_KEY', 'R2_SECRET_ACCESS_KEY');
    const region = value('OBJECT_STORAGE_REGION', 'R2_REGION') ?? 'auto';
    const forcePathStyle =
      value('OBJECT_STORAGE_FORCE_PATH_STYLE', 'R2_FORCE_PATH_STYLE') === 'true';
    this.client =
      endpoint && this.bucket && accessKeyId && secretAccessKey
        ? new S3Client({
            region,
            endpoint,
            forcePathStyle,
            credentials: { accessKeyId, secretAccessKey },
          })
        : null;
  }
  configured() {
    return this.client !== null;
  }
  async put(key: string, body: string, contentType: string) {
    if (!this.configured()) return { key, uploaded: false };
    await this.client!.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
    return { key, uploaded: true };
  }
}
