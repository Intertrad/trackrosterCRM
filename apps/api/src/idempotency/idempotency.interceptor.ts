import {
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
  UnauthorizedException,
  type CallHandler,
  type ExecutionContext,
} from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';

import { Reflector } from '@nestjs/core';

import { catchError, from, map, mergeMap, Observable, of, throwError } from 'rxjs';

import type { AuthenticatedRequest } from '../auth/auth.types.js';

import {
  IDEMPOTENCY_HEADER,
  IDEMPOTENCY_OPERATION_METADATA,
  IDEMPOTENCY_OPTIONAL_METADATA,
  IDEMPOTENCY_REPLAY_HEADER,
} from './idempotency.constants.js';

import { IdempotencyService } from './idempotency.service.js';

import type { IdempotencyLifecycleIdentity } from './idempotency.types.js';
import { resourceETag } from '../http/resource-etag.js';

interface IdempotencyHttpRequest extends AuthenticatedRequest {
  method: string;

  headers: Record<string, string | string[] | undefined>;

  params?: unknown;

  query?: unknown;

  body?: unknown;
}

interface IdempotencyHttpReply {
  status(statusCode: number): IdempotencyHttpReply;

  header(name: string, value: string): IdempotencyHttpReply;
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(
    private readonly reflector: Reflector,

    private readonly idempotencyService: IdempotencyService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const operation = this.reflector.getAllAndOverride<string>(IDEMPOTENCY_OPERATION_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);

    /*
     * Most API routes are intentionally not
     * idempotency-managed.
     */
    if (!operation) {
      return next.handle();
    }

    const http = context.switchToHttp();

    const request = http.getRequest<IdempotencyHttpRequest>();

    const reply = http.getResponse<IdempotencyHttpReply>();

    const successStatus = this.resolveSuccessStatus(context, request.method);

    if (!request.auth) {
      throw new UnauthorizedException('Authentication required');
    }

    const headerValue = request.headers[IDEMPOTENCY_HEADER];
    if (
      headerValue === undefined &&
      this.reflector.getAllAndOverride<boolean>(IDEMPOTENCY_OPTIONAL_METADATA, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    ) {
      return next.handle();
    }

    /*
     * Duplicate header values are rejected by the
     * service as invalid rather than silently
     * choosing one.
     */
    const idempotencyKey = Array.isArray(headerValue) ? headerValue : headerValue;

    const decision = await this.idempotencyService.begin({
      tenantId: request.auth.tenantId,

      userId: request.auth.userId,

      operation,

      idempotencyKey,

      request: {
        method: request.method,

        params: request.params ?? {},

        query: request.query ?? {},

        body: request.body ?? null,
        ...(typeof request.headers['if-match'] === 'string'
          ? { ifMatch: request.headers['if-match'] }
          : {}),
      },
    });

    if (decision.kind === 'replay') {
      reply.status(decision.responseStatus);

      reply.header(IDEMPOTENCY_REPLAY_HEADER, 'true');
      reply.header('ETag', resourceETag(decision.responseBody));

      return of(decision.responseBody);
    }

    reply.header(IDEMPOTENCY_REPLAY_HEADER, 'false');

    /*
     * The authenticated ownership boundary is
     * captured once and carried through every
     * lifecycle transition.
     *
     * tenantId/userId come from AuthGuard-populated
     * server context, not request body/query data.
     */
    const lifecycleIdentity: IdempotencyLifecycleIdentity = {
      tenantId: request.auth.tenantId,

      userId: request.auth.userId,

      recordId: decision.recordId,
    };

    return next.handle().pipe(
      /*
       * The controller completed successfully.
       *
       * Persist its exact status/body before
       * allowing Nest to send the response.
       */
      mergeMap((responseBody) =>
        from(
          this.idempotencyService.complete({
            ...lifecycleIdentity,

            responseStatus: successStatus,

            responseBody,
          }),
        ).pipe(map(() => responseBody)),
      ),

      catchError((error: unknown) => {
        /*
         * 4xx means the request was rejected.
         *
         * It must not permanently consume the
         * key; the caller may correct and retry.
         */
        if (error instanceof HttpException && error.getStatus() < 500) {
          return from(this.releaseSafely(lifecycleIdentity)).pipe(
            mergeMap(() => throwError(() => error)),
          );
        }

        /*
         * 5xx or an unknown error may have
         * happened after the business mutation.
         *
         * Fail closed.
         */
        return from(this.markUncertainSafely(lifecycleIdentity)).pipe(
          mergeMap(() => throwError(() => error)),
        );
      }),
    );
  }

  private resolveSuccessStatus(context: ExecutionContext, method: string): number {
    const explicitStatus = this.reflector.get<number>(HTTP_CODE_METADATA, context.getHandler());

    if (explicitStatus !== undefined) {
      return explicitStatus;
    }

    /*
     * Nest defaults:
     *
     * POST  -> 201
     * other methods -> 200
     */
    return method.toUpperCase() === 'POST' ? 201 : 200;
  }

  private async releaseSafely(identity: IdempotencyLifecycleIdentity): Promise<void> {
    try {
      await this.idempotencyService.release(identity);
    } catch (error) {
      /*
       * Leaving the row processing is safer than
       * accidentally allowing a duplicate write.
       */
      this.logPersistenceFailure('release', identity.recordId, error);
    }
  }

  private async markUncertainSafely(identity: IdempotencyLifecycleIdentity): Promise<void> {
    try {
      await this.idempotencyService.markUncertain(identity);
    } catch (error) {
      /*
       * If persistence itself is unavailable, the
       * existing processing row still prevents an
       * immediate duplicate execution.
       */
      this.logPersistenceFailure('mark uncertain', identity.recordId, error);
    }
  }

  private logPersistenceFailure(operation: string, recordId: string, error: unknown): void {
    if (error instanceof Error) {
      this.logger.error(`Failed to ${operation} idempotency record ${recordId}`, error.stack);

      return;
    }

    this.logger.error(`Failed to ${operation} idempotency record ${recordId}`);
  }
}
