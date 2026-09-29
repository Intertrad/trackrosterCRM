import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class ObjectStorageService {
  private readonly client: S3Client | null;
  private readonly bucket: string;
  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>('R2_BUCKET') ?? '';
    const endpoint = this.config.get<string>('R2_ENDPOINT');
    this.client =
      endpoint && this.bucket
        ? new S3Client({
            region: 'auto',
            endpoint,
            forcePathStyle: this.config.get<string>('R2_FORCE_PATH_STYLE') === 'true',
            credentials: {
              accessKeyId: this.config.get<string>('R2_ACCESS_KEY_ID') ?? '',
              secretAccessKey: this.config.get<string>('R2_SECRET_ACCESS_KEY') ?? '',
            },
          })
        : null;
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
