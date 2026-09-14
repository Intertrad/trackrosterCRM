export interface IdempotencyRequestIdentity {
  method: string;

  params: unknown;

  query: unknown;

  body: unknown;
}

export interface BeginIdempotencyInput {
  tenantId: string;

  userId: string;

  operation: string;

  idempotencyKey: unknown;

  request: IdempotencyRequestIdentity;
}

/*
 * Identity carried through the lifecycle of an
 * already-claimed idempotency record.
 *
 * The interceptor derives tenantId/userId from
 * authenticated server context, never from client
 * request payload data.
 */
export interface IdempotencyLifecycleIdentity {
  tenantId: string;

  userId: string;

  recordId: string;
}

export interface CompleteIdempotencyInput extends IdempotencyLifecycleIdentity {
  responseStatus: number;

  responseBody: unknown;
}

export interface ExecuteIdempotencyDecision {
  kind: 'execute';

  recordId: string;
}

export interface ReplayIdempotencyDecision {
  kind: 'replay';

  responseStatus: number;

  responseBody: unknown;
}

export type IdempotencyDecision = ExecuteIdempotencyDecision | ReplayIdempotencyDecision;
