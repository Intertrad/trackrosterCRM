import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
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
    return from(
      this.database.transaction(async (tx) => {
        await setTenantContext(tx, tenantId);
        return runWithTenantExecutor(tx, () => lastValueFrom(next.handle()));
      }),
    );
  }
}
