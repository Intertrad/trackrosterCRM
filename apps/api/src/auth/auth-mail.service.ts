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

type MailMessage = { to: string; subject: string; text: string };
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
    const key = this.config.get<string>('MFA_ENCRYPTION_KEY');
    const origin = this.config.get<string>('AUTH_PUBLIC_ORIGIN');
    if (!endpoint || !key || !/^[a-f0-9]{64}$/i.test(key) || !origin)
      throw new ServiceUnavailableException('Account email is not configured');
    const url = new URL(endpoint),
      publicUrl = new URL(origin);
    if (
      this.config.get('NODE_ENV') === 'production' ||
      !['127.0.0.1', 'localhost', 'mailpit'].includes(url.hostname) ||
      url.protocol !== 'http:' ||
      url.username ||
      url.password ||
      !['http:', 'https:'].includes(publicUrl.protocol) ||
      publicUrl.username ||
      publicUrl.password
    )
      throw new ServiceUnavailableException('Local mailbox configuration is invalid');
    return { endpoint: url.origin, key: Buffer.from(key, 'hex'), origin: publicUrl.origin };
  }
  assertConfigured() {
    return this.settings();
  }
  publicLink(path: string, token: string) {
    // Fragment keeps the bearer secret out of HTTP request URLs and referrers.
    return `${this.settings().origin}${path}#token=${encodeURIComponent(token)}`;
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
    if (!this.config.get('MAILPIT_URL')) return;
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
        const response = await fetch(`${settings.endpoint}/api/v1/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(5000),
          body: JSON.stringify({
            From: { Email: 'accounts@trackroster.test', Name: 'TrackRoster' },
            To: [{ Email: payload.to }],
            Subject: payload.subject,
            Text: payload.text,
          }),
        });
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
