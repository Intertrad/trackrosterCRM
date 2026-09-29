export interface ApiErrorPayload {
  statusCode: number;
  code: string;
  message: string | string[];
  error: string;
  requestId?: string;
}

export class ApiError extends Error {
  readonly statusCode: number;

  readonly code: string;

  readonly errorName: string;

  readonly requestId?: string;

  readonly messages: string[];

  constructor(payload: ApiErrorPayload) {
    const messages = Array.isArray(payload.message) ? payload.message : [payload.message];

    super(messages.join(', '));

    this.name = 'ApiError';

    this.statusCode = payload.statusCode;
    this.code = payload.code;
    this.errorName = payload.error;
    this.requestId = payload.requestId;
    this.messages = messages;
  }
}
