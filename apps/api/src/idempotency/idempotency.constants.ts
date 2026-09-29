export const IDEMPOTENCY_OPTIONAL_METADATA = 'trackroster:idempotency-optional';
export const IDEMPOTENCY_OPERATION_METADATA = 'trackroster:idempotency-operation';

export const IDEMPOTENCY_HEADER = 'idempotency-key';

export const IDEMPOTENCY_REPLAY_HEADER = 'Idempotency-Replayed';

export const IDEMPOTENCY_RETENTION_MS = 24 * 60 * 60 * 1000;

export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export const IDEMPOTENCY_OPERATION_PATTERN = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/;
