import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WorkerArtifactStorageService {
  private readonly uploadTemplate: string;
  private readonly bucket: string;
  constructor(config: ConfigService) {
    this.bucket = config.get<string>('R2_BUCKET') ?? '';
    this.uploadTemplate = config.get<string>('R2_UPLOAD_URL_TEMPLATE') ?? '';
  }
  configured() {
    return Boolean(this.uploadTemplate && this.bucket);
  }
  async put(key: string, body: string, contentType: string) {
    if (!this.configured()) return { key, uploaded: false };
    const url = this.uploadTemplate.replace('{key}', encodeURIComponent(key));
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'content-type': contentType },
      body,
    });
    if (!response.ok) throw new Error(`artifact upload failed with HTTP ${response.status}`);
    return { key, uploaded: true };
  }
}
