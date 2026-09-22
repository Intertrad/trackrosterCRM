import { createHash } from 'node:crypto';
import {
  Injectable,
  PreconditionFailedException,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { map } from 'rxjs';

export function resourceETag(resource: unknown): string {
  // JSONB may reorder object keys when an idempotent response is replayed.
  // Normalize Dates and sort keys so the same representation keeps its ETag.
  const normalized: unknown = JSON.parse(JSON.stringify(resource ?? null));
  const canonical = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
    if (typeof value === 'object' && value !== null)
      return `{${Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
        .join(',')}}`;
    return JSON.stringify(value);
  };
  return `"${createHash('sha256').update(canonical(normalized)).digest('hex')}"`;
}

/** Call only after locking the mutable resource in its write transaction. */
export function assertResourceMatches(ifMatch: string | undefined, resource: unknown): void {
  if (ifMatch === undefined || ifMatch === '*') return;
  const currentETag = resourceETag(resource);
  if (
    !ifMatch
      .split(',')
      .map((value) => value.trim())
      .includes(currentETag)
  ) {
    throw new PreconditionFailedException({
      code: 'RESOURCE_VERSION_CONFLICT',
      message: 'This resource changed. Reload it before applying your changes.',
      currentETag,
    });
  }
}

@Injectable()
export class ResourceETagInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(
      map((resource) => {
        context
          .switchToHttp()
          .getResponse<{ header(name: string, value: string): unknown }>()
          .header('ETag', resourceETag(resource));
        return resource;
      }),
    );
  }
}
