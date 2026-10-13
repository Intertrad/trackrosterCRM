import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, from, lastValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { sql } from 'drizzle-orm';
import { DATABASE } from './database.constants.js';
import type { Database, DatabaseTransaction } from './database.types.js';
import { setTenantContext } from './tenant-context.js';
import { runWithTenantExecutor } from './request-tenant-executor.js';
import { Inject } from '@nestjs/common';

@Injectable()
export class TenantTransactionInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TenantTransactionInterceptor.name);

  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly config: ConfigService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ auth?: { tenantId?: string } }>();
    const tenantId = request.auth?.tenantId;
    if (!tenantId) return next.handle();
    let persistAfterCommit: (() => Promise<void>) | undefined;
    const transaction = this.database.transaction(async (tx) => {
      await setTenantContext(tx, tenantId);
      await this.configureTransactionLimits(tx);
      const startedAt = Date.now();
      try {
        return await runWithTenantExecutor(tx, () => lastValueFrom(next.handle()));
      } catch (error) {
        /*
         * A Redis lease can be acquired just before durable confirmation
         * fails. The reservation service marks that error explicitly so the
         * pending ledger row is persisted immediately after this transaction
         * commits, while the client still receives the intended 503 response.
         */
        if (
          error &&
          typeof error === 'object' &&
          'commitTenantTransaction' in error &&
          error.commitTenantTransaction === true
        ) {
          const response = context.switchToHttp().getResponse<{ status: (code: number) => void }>();
          const status = error instanceof HttpException ? error.getStatus() : 503;
          if ('persistAfterCommit' in error && typeof error.persistAfterCommit === 'function') {
            persistAfterCommit = error.persistAfterCommit as () => Promise<void>;
          }
          response.status(status);
          return error instanceof HttpException ? error.getResponse() : { statusCode: status };
        }
        throw error;
      } finally {
        const elapsedMs = Date.now() - startedAt;
        const warningThresholdMs = this.transactionWarningThresholdMs();
        if (elapsedMs > warningThresholdMs) {
          this.logger.warn(`Tenant transaction exceeded ${warningThresholdMs}ms (${elapsedMs}ms)`);
        }
      }
    });
    return from(
      transaction.then(async (result) => {
        if (persistAfterCommit) await persistAfterCommit();
        return result;
      }),
    );
  }

  private async configureTransactionLimits(tx: DatabaseTransaction): Promise<void> {
    const statementTimeoutMs = this.boundedSetting(
      'DATABASE_STATEMENT_TIMEOUT_MS',
      30_000,
      250,
      120_000,
    );
    const idleTransactionTimeoutMs = this.boundedSetting(
      'DATABASE_IDLE_TRANSACTION_TIMEOUT_MS',
      30_000,
      1_000,
      300_000,
    );

    await tx.execute(
      sql`select set_config('statement_timeout', ${String(statementTimeoutMs)}, true)`,
    );
    await tx.execute(
      sql`select set_config('idle_in_transaction_session_timeout', ${String(idleTransactionTimeoutMs)}, true)`,
    );
  }

  private transactionWarningThresholdMs(): number {
    return this.boundedSetting('DATABASE_IDLE_TRANSACTION_TIMEOUT_MS', 30_000, 1_000, 300_000);
  }

  private boundedSetting(key: string, fallback: number, minimum: number, maximum: number): number {
    const value = this.config.get<string>(key);
    if (value === undefined) return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
      return fallback;
    }
    return parsed;
  }
}
