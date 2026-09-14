export type ApiErrorMessage = string | string[];

export interface ApiErrorResponse {
  statusCode: number;

  code: string;

  message: ApiErrorMessage;

  error: string;

  requestId: string;
}
