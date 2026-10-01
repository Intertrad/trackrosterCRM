import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WorkerPushService {
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly appId: string;
  private readonly isOneSignal: boolean;

  constructor(config: ConfigService) {
    this.endpoint = config.get<string>('PUSH_PROVIDER_URL')?.trim() ?? '';
    this.apiKey = config.get<string>('PUSH_PROVIDER_API_KEY')?.trim() ?? '';
    this.appId = config.get<string>('PUSH_PROVIDER_APP_ID')?.trim() ?? '';
    this.isOneSignal = (() => {
      try {
        return new URL(this.endpoint).hostname === 'api.onesignal.com';
      } catch {
        return false;
      }
    })();
  }

  get configured(): boolean {
    return Boolean(this.endpoint && this.apiKey && (!this.isOneSignal || this.appId));
  }

  async send(token: string, title: string, body: string) {
    if (!this.configured) return { sent: false, invalid: false, providerId: null };

    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };
    const requestPayload = this.isOneSignal
      ? {
          app_id: this.appId,
          target_channel: 'push',
          include_subscription_ids: [token],
          headings: { en: title },
          contents: { en: body },
        }
      : { token, title, body };

    headers.authorization = this.isOneSignal ? `Key ${this.apiKey}` : `Bearer ${this.apiKey}`;

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestPayload),
    });

    if (
      response.status === 404 ||
      response.status === 410 ||
      (!this.isOneSignal && response.status === 400)
    ) {
      return { sent: false, invalid: true, providerId: null };
    }
    const responsePayload = (await response.json().catch(() => ({}))) as {
      id?: string;
      messageId?: string;
    };
    if (!response.ok) throw new Error(`Push delivery failed with HTTP ${response.status}`);
    return {
      sent: true,
      invalid: false,
      providerId: responsePayload.messageId ?? responsePayload.id ?? null,
    };
  }
}
