import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
@Injectable()
export class WorkerMailService {
  private readonly apiKey: string;
  private readonly sender: string;
  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('BREVO_API_KEY') ?? '';
    this.sender = config.get<string>('BREVO_SENDER_EMAIL') ?? '';
  }
  get configured(): boolean {
    return Boolean(this.apiKey && this.sender);
  }
  async sendNotification(recipient: string, subject: string, message: string) {
    if (!this.configured) return { sent: false, providerId: null };
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': this.apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { email: this.sender },
        to: [{ email: recipient }],
        subject,
        textContent: message,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as { messageId?: string };
    if (!response.ok) throw new Error(`Brevo delivery failed with HTTP ${response.status}`);
    return { sent: true, providerId: payload.messageId ?? null };
  }
  async sendReport(recipients: string[], subject: string, filename: string, content: string) {
    if (!this.apiKey || !this.sender) return { sent: false, providerId: null };
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': this.apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { email: this.sender },
        to: recipients.map((email) => ({ email })),
        subject,
        textContent: 'Your TrackRoster report is attached.',
        attachment: [{ name: filename, content: Buffer.from(content).toString('base64') }],
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as { messageId?: string };
    if (!response.ok) throw new Error(`Brevo delivery failed with HTTP ${response.status}`);
    return { sent: true, providerId: payload.messageId ?? null };
  }
}
