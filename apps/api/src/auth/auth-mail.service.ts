import { randomUUID } from 'node:crypto';
import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  type OnModuleInit,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import { Database, DatabaseExecutor } from '../database/database.types.js';
import { authMailOutbox } from '../database/schema/auth-recovery.js';
import { openSecret, sealSecret } from './mfa-crypto.js';

export type MailMessage = { to: string; subject: string; text: string; html?: string };

function canonicalProductionOrigin(publicUrl: URL, production: boolean): string {
  if (
    production &&
    ['trackroaster.com', 'trackroster.com', 'www.trackroster.com'].includes(
      publicUrl.hostname.toLowerCase(),
    )
  ) {
    // The apex redirects to this host and the historical `trackroaster.com`
    // typo has no DNS record. Keep invitation links on the verified host.
    return 'https://www.trackroster.com';
  }
  return publicUrl.origin;
}

@Injectable()
export class AuthMailService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;
  private readonly logger = new Logger(AuthMailService.name);
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly config: ConfigService,
  ) {}

  private settings() {
    const endpoint = this.config.get<string>('MAILPIT_URL');
    const brevoKey = this.config.get<string>('BREVO_API_KEY');
    const key = this.config.get<string>('MFA_ENCRYPTION_KEY');
    const origin = this.config.get<string>('AUTH_PUBLIC_ORIGIN');
    if ((!endpoint && !brevoKey) || !key || !/^[a-f0-9]{64}$/i.test(key) || !origin)
      throw new ServiceUnavailableException('Account email is not configured');
    const url = endpoint ? new URL(endpoint) : undefined,
      publicUrl = new URL(origin);
    const production = this.config.get('NODE_ENV') === 'production';
    const localPublicHost = ['127.0.0.1', 'localhost', '::1', 'mailpit'].includes(
      publicUrl.hostname,
    );
    if (
      (endpoint &&
        (this.config.get('NODE_ENV') === 'production' ||
          !['127.0.0.1', 'localhost', 'mailpit'].includes(url!.hostname) ||
          url!.protocol !== 'http:' ||
          url!.username ||
          url!.password)) ||
      !['http:', 'https:'].includes(publicUrl.protocol) ||
      publicUrl.username ||
      publicUrl.password ||
      (production && (publicUrl.protocol !== 'https:' || localPublicHost))
    )
      throw new ServiceUnavailableException(
        production
          ? 'Production email links require AUTH_PUBLIC_ORIGIN to be an external HTTPS origin'
          : 'Local mailbox configuration is invalid',
      );
    return {
      endpoint: url?.origin,
      brevoKey,
      key: Buffer.from(key, 'hex'),
      origin: canonicalProductionOrigin(publicUrl, production),
    };
  }
  assertConfigured() {
    return this.settings();
  }
  publicLink(path: string, token: string) {
    // Fragment keeps the bearer secret out of HTTP request URLs and referrers.
    return `${this.settings().origin}${path}#token=${encodeURIComponent(token)}`;
  }
  publicAsset(path: string) {
    return new URL(path, `${this.settings().origin}/`).toString();
  }
  async enqueue(message: MailMessage, expiresAt: Date, executor: DatabaseExecutor) {
    const id = randomUUID();
    const encryptedPayload = sealSecret(
      Buffer.from(JSON.stringify(message)),
      this.settings().key,
      `mail:${id}`,
    );
    await executor.insert(authMailOutbox).values({ id, encryptedPayload, expiresAt });
  }
  onModuleInit() {
    if (!this.config.get('MAILPIT_URL') && !this.config.get('BREVO_API_KEY')) return;
    this.settings();
    this.timer = setInterval(() => {
      if (!this.running)
        this.running = this.dispatchPending()
          .catch(() => {
            // Do not log message bodies, email addresses, reset URLs, or driver parameters.
            this.logger.warn('Account email dispatch temporarily unavailable');
          })
          .finally(() => {
            this.running = undefined;
          });
    }, 1000);
    this.timer.unref();
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }

  async dispatchPending(): Promise<void> {
    const settings = this.settings();
    await this.db.transaction(async (tx) => {
      await tx
        .update(authMailOutbox)
        .set({ encryptedPayload: null, failedAt: sql`clock_timestamp()` })
        .where(
          and(
            isNull(authMailOutbox.deliveredAt),
            isNull(authMailOutbox.failedAt),
            sql`${authMailOutbox.expiresAt} <= clock_timestamp()`,
          ),
        );
      const [message] = await tx
        .select()
        .from(authMailOutbox)
        .where(
          and(
            isNull(authMailOutbox.deliveredAt),
            isNull(authMailOutbox.failedAt),
            sql`${authMailOutbox.nextAttemptAt} <= clock_timestamp()`,
            sql`${authMailOutbox.expiresAt} > clock_timestamp()`,
          ),
        )
        .orderBy(authMailOutbox.nextAttemptAt)
        .limit(1)
        .for('update', { skipLocked: true });
      if (!message?.encryptedPayload) return;
      try {
        const payload = JSON.parse(
          openSecret(message.encryptedPayload, settings.key, `mail:${message.id}`).toString(),
        ) as MailMessage;

        /*
         * The local mailbox wins when it is configured.
         *
         * settings() already refuses any endpoint that is not loopback, so a
         * MAILPIT_URL can only mean a development machine — and on a machine
         * that also carries a Brevo key, preferring the provider meant every
         * invitation and password reset went to real addresses over the
         * public internet, while the mailbox the developer was watching
         * stayed empty. Of 45 queued messages here, none had ever been
         * delivered locally.
         */
        const useLocalMailbox = Boolean(settings.endpoint);

        const response = await fetch(
          useLocalMailbox
            ? `${settings.endpoint}/api/v1/send`
            : 'https://api.brevo.com/v3/smtp/email',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(useLocalMailbox || !settings.brevoKey ? {} : { 'api-key': settings.brevoKey }),
            },
            signal: AbortSignal.timeout(5000),
            body: JSON.stringify({
              /*
               * The two APIs disagree on the sender field: Mailpit wants
               * `From`, Brevo wants `sender`. Sending Brevo's spelling to the
               * local mailbox had it reject every message, which is why all
               * 50 queued rows showed attempts and none showed a delivery.
               */
              ...(useLocalMailbox
                ? { From: { Email: 'accounts@trackroster.test', Name: 'TrackRoster' } }
                : {
                    sender: {
                      email: this.config.get('BREVO_SENDER_EMAIL') ?? 'accounts@trackroster.test',
                      name: 'TrackRoster',
                    },
                  }),
              ...(useLocalMailbox
                ? {
                    To: [{ Email: payload.to }],
                    Subject: payload.subject,
                    Text: payload.text,
                    ...(payload.html ? { HTML: payload.html } : {}),
                  }
                : {
                    to: [{ email: payload.to }],
                    subject: payload.subject,
                    textContent: payload.text,
                    ...(payload.html ? { htmlContent: payload.html } : {}),
                  }),
            }),
          },
        );
        if (!response.ok) throw new Error('Mailbox rejected delivery');
        await tx
          .update(authMailOutbox)
          .set({
            deliveredAt: sql`clock_timestamp()`,
            encryptedPayload: null,
            attempts: message.attempts + 1,
          })
          .where(eq(authMailOutbox.id, message.id));
      } catch {
        const failed = message.attempts >= 7;
        await tx
          .update(authMailOutbox)
          .set({
            attempts: message.attempts + 1,
            nextAttemptAt: sql`clock_timestamp() + interval '1 minute' * ${Math.min(16, 2 ** message.attempts)}`,
            ...(failed ? { failedAt: sql`clock_timestamp()`, encryptedPayload: null } : {}),
          })
          .where(eq(authMailOutbox.id, message.id));
      }
    });
  }
}
