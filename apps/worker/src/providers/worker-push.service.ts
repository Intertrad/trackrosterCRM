import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WorkerPushService {
  private readonly endpoint: string;
  private readonly apiKey: string;

  constructor(config: ConfigService) {
    this.endpoint = config.get<string>('PUSH_PROVIDER_URL') ?? '';
    this.apiKey = config.get<string>('PUSH_PROVIDER_API_KEY') ?? '';
  }

  get configured(): boolean {
    return Boolean(this.endpoint && this.apiKey);
  }

  async send(token: string, title: string, body: string) {
    if (!this.configured) return { sent: false, invalid: false, providerId: null };
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ token, title, body }),
    });
    if (response.status === 400 || response.status === 404 || response.status === 410) {
      return { sent: false, invalid: true, providerId: null };
    }
    const payload = (await response.json().catch(() => ({}))) as {
      id?: string;
      messageId?: string;
    };
    if (!response.ok) throw new Error(`Push delivery failed with HTTP ${response.status}`);
    return { sent: true, invalid: false, providerId: payload.messageId ?? payload.id ?? null };
  }
}
