import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NOTIFICATION_DIGEST_JOB } from '@trackroster/jobs';
import { eq } from 'drizzle-orm';

import { DATABASE } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { tenants } from '../database/schema/index.js';
import { JobProducerService } from '../jobs/job-producer.service.js';

const DEFAULT_POLL_INTERVAL_MS = 60_000;
const DEFAULT_DIGEST_HOUR_UTC = 8;
const DEFAULT_INACTIVITY_DAYS = 7;

/** Enqueues one tenant-scoped inactivity digest per UTC day. */
@Injectable()
export class NotificationDigestSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationDigestSchedulerService.name);
  private readonly pollIntervalMs: number;
  private readonly digestHourUtc: number;
  private readonly inactivityDays: number;
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private lastScheduledDay: string | null = null;

  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly jobs: JobProducerService,
    config: ConfigService,
  ) {
    this.pollIntervalMs = readPositiveInteger(
      config.get<string>('NOTIFICATION_DIGEST_POLL_INTERVAL_MS'),
      DEFAULT_POLL_INTERVAL_MS,
    );
    this.digestHourUtc = readBoundedInteger(
      config.get<string>('NOTIFICATION_DIGEST_HOUR_UTC'),
      DEFAULT_DIGEST_HOUR_UTC,
      0,
      23,
    );
    this.inactivityDays = readBoundedInteger(
      config.get<string>('NOTIFICATION_INACTIVITY_DAYS'),
      DEFAULT_INACTIVITY_DAYS,
      1,
      365,
    );
  }

  onModuleInit(): void {
    if (process.env.NOTIFICATION_DIGEST_SCHEDULER === 'off') return;

    this.timer = setInterval(() => {
      void this.drain().catch((error: unknown) => {
        this.logger.warn(
          `Notification digest scheduling will retry: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    }, this.pollIntervalMs);
    this.timer.unref();

    void this.drain().catch((error: unknown) => {
      this.logger.warn(
        `Notification digest scheduling startup check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async drain(asOf = new Date()): Promise<number> {
    if (this.running || asOf.getUTCHours() < this.digestHourUtc) return 0;

    const day = asOf.toISOString().slice(0, 10);
    if (this.lastScheduledDay === day) return 0;

    this.running = true;
    try {
      const activeTenants = await this.database
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.status, 'active'));

      for (const tenant of activeTenants) {
        const requestedAt = new Date().toISOString();
        await this.jobs.enqueue(NOTIFICATION_DIGEST_JOB, {
          jobId: buildDigestJobId(tenant.id, asOf, this.inactivityDays),
          tenantId: tenant.id,
          requestedAt,
          asOf: asOf.toISOString(),
          inactivityDays: this.inactivityDays,
        });
      }

      this.lastScheduledDay = day;
      return activeTenants.length;
    } finally {
      this.running = false;
    }
  }
}

function buildDigestJobId(tenantId: string, asOf: Date, inactivityDays: number): string {
  return ['notification-digest', tenantId, asOf.toISOString().slice(0, 10), inactivityDays].join(
    '-',
  );
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error('Notification digest poll interval must be a positive integer');
  }
  return parsed;
}

function readBoundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`Notification digest value must be between ${minimum} and ${maximum}`);
  }
  return parsed;
}
