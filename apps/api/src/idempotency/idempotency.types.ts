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
