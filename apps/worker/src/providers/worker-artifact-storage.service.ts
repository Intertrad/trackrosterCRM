import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

@Injectable()
export class WorkerArtifactStorageService {
  private readonly client: S3Client | null;
  private readonly bucket: string;
  constructor(config: ConfigService) {
    this.bucket = config.get<string>('R2_BUCKET') ?? '';
    const endpoint = config.get<string>('R2_ENDPOINT');
    const accessKeyId = config.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = config.get<string>('R2_SECRET_ACCESS_KEY');
    this.client =
      endpoint && this.bucket && accessKeyId && secretAccessKey
        ? new S3Client({
            region: 'auto',
            endpoint,
            forcePathStyle: true,
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
