export type ApiErrorMessage = string | string[];

export interface ApiErrorResponse {
  statusCode: number;

  code: string;

  message: ApiErrorMessage;

  error: string;

  /** Optional machine-readable context, such as validation issue metadata. */
  details?: Record<string, unknown>;

  requestId: string;
}
