import { applyDecorators, SetMetadata } from '@nestjs/common';

import {
  IDEMPOTENCY_OPERATION_METADATA,
  IDEMPOTENCY_OPTIONAL_METADATA,
  IDEMPOTENCY_OPERATION_PATTERN,
} from './idempotency.constants.js';

export function Idempotent(
  operation: string,
  options: { optional?: boolean } = {},
): MethodDecorator {
  if (!IDEMPOTENCY_OPERATION_PATTERN.test(operation)) {
    throw new Error(`Invalid idempotency operation: ${operation}`);
  }

  return applyDecorators(
    SetMetadata(IDEMPOTENCY_OPERATION_METADATA, operation),
    SetMetadata(IDEMPOTENCY_OPTIONAL_METADATA, options.optional === true),
  );
}
