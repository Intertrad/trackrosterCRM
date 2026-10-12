import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class ObjectStorageService {
  private readonly client: S3Client | null;
  private readonly bucket: string;
  constructor(private readonly config: ConfigService) {
    /*
     * OBJECT_STORAGE_* is the canonical deployment contract used by the
     * application environment and production runbooks. Keep R2_* as a
     * backwards-compatible alias for existing MinIO/R2 local setups.
     */
    this.bucket = this.value('OBJECT_STORAGE_BUCKET', 'R2_BUCKET') ?? '';
    const endpoint = this.value('OBJECT_STORAGE_ENDPOINT', 'R2_ENDPOINT');
    this.client =
      endpoint && this.bucket
        ? new S3Client({
            region: this.value('OBJECT_STORAGE_REGION', 'R2_REGION') ?? 'auto',
            endpoint,
            forcePathStyle:
              this.value('OBJECT_STORAGE_FORCE_PATH_STYLE', 'R2_FORCE_PATH_STYLE') === 'true',
            credentials: {
              accessKeyId: this.value('OBJECT_STORAGE_ACCESS_KEY_ID', 'R2_ACCESS_KEY_ID') ?? '',
              secretAccessKey:
                this.value('OBJECT_STORAGE_SECRET_ACCESS_KEY', 'R2_SECRET_ACCESS_KEY') ?? '',
            },
          })
        : null;
  }

  private value(...keys: string[]): string | undefined {
    for (const key of keys) {
      const value = this.config.get<string>(key);
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return undefined;
  }
  async uploadUrl(key: string, contentType: string, expiresIn = 900) {
    if (!this.client) return null;
    return getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      { expiresIn },
    );
  }
  async downloadUrl(key: string, expiresIn = 300) {
    if (!this.client) return null;
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn,
    });
  }
  configured() {
    return this.client !== null;
  }
}
