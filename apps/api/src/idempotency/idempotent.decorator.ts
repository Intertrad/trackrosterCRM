import { SetMetadata } from '@nestjs/common';

import {
  IDEMPOTENCY_OPERATION_METADATA,
  IDEMPOTENCY_OPERATION_PATTERN,
} from './idempotency.constants.js';

export function Idempotent(operation: string): MethodDecorator {
  if (!IDEMPOTENCY_OPERATION_PATTERN.test(operation)) {
    throw new Error(`Invalid idempotency operation: ${operation}`);
  }

  return SetMetadata(IDEMPOTENCY_OPERATION_METADATA, operation);
}
