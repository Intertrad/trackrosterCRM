import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, from, lastValueFrom } from 'rxjs';
import { DATABASE } from './database.constants.js';
import type { Database } from './database.types.js';
import { setTenantContext } from './tenant-context.js';
import { runWithTenantExecutor } from './request-tenant-executor.js';
import { Inject } from '@nestjs/common';

@Injectable()
export class TenantTransactionInterceptor implements NestInterceptor {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ auth?: { tenantId?: string } }>();
    const tenantId = request.auth?.tenantId;
    if (!tenantId) return next.handle();
    let persistAfterCommit: (() => Promise<void>) | undefined;
    const transaction = this.database.transaction(async (tx) => {
      await setTenantContext(tx, tenantId);
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
      }
    });
    return from(
      transaction.then(async (result) => {
        if (persistAfterCommit) await persistAfterCommit();
        return result;
      }),
    );
  }
}
