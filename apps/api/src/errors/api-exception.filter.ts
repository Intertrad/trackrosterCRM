import {
  isCampaignClosedError,
  isProspectArchivedError,
} from '../campaigns/campaign-work-error.js';
import { randomUUID } from 'node:crypto';

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

import type { ApiErrorMessage, ApiErrorResponse } from './api-error.types.js';

interface RequestWithId {
  id?: string;
}

interface HttpReply {
  header?(name: string, value: string): unknown;
  status(statusCode: number): {
    send(body: ApiErrorResponse): unknown;
  };
}

interface ExceptionResponseObject {
  statusCode?: unknown;
  code?: unknown;
  message?: unknown;
  error?: unknown;
  details?: unknown;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();

    const request = http.getRequest<RequestWithId>();

    const response = http.getResponse<HttpReply>();

    const requestId = request.id ?? randomUUID();
    response.header?.('x-request-id', requestId);

    if (isCampaignClosedError(exception) || isProspectArchivedError(exception)) {
      response.status(409).send({
        statusCode: 409,
        code: isProspectArchivedError(exception) ? 'PROSPECT_ARCHIVED' : 'CAMPAIGN_CLOSED',
        message: 'This record no longer accepts open work',
        error: 'Conflict',
        requestId,
      });
      return;
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();

      const normalized = this.normalizeHttpException(exception, statusCode, requestId);

      response.status(statusCode).send(normalized);

      return;
    }

    this.logUnexpectedException(exception, requestId);

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,

      code: 'INTERNAL_SERVER_ERROR',

      message: 'Internal server error',

      error: 'Internal Server Error',

      requestId,
    });
  }

  private normalizeHttpException(
    exception: HttpException,
    statusCode: number,
    requestId: string,
  ): ApiErrorResponse {
    const raw = exception.getResponse();

    if (typeof raw === 'string') {
      return {
        statusCode,

        code: this.defaultCode(statusCode, raw),

        message: raw,

        error: this.defaultError(statusCode),

        requestId,
      };
    }

    const response = this.asResponseObject(raw);

    const message = this.normalizeMessage(response?.message, exception.message);

    const customCode = typeof response?.code === 'string' ? response.code : null;

    const details = this.normalizeDetails(response?.details);

    const error =
      typeof response?.error === 'string' ? response.error : this.defaultError(statusCode);

    return {
      statusCode,

      code: customCode ?? this.defaultCode(statusCode, message),

      message,

      error,

      ...(details ? { details } : {}),

      requestId,
    };
  }

  private normalizeDetails(value: unknown): Record<string, unknown> | undefined {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
    return value as Record<string, unknown>;
  }

  private asResponseObject(value: unknown): ExceptionResponseObject | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return null;
    }

    return value as ExceptionResponseObject;
  }

  private normalizeMessage(value: unknown, fallback: string): ApiErrorMessage {
    if (typeof value === 'string') {
      return value;
    }

    if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
      return value;
    }

    return fallback;
  }

  private defaultCode(statusCode: number, message: ApiErrorMessage): string {
    if (statusCode === HttpStatus.BAD_REQUEST && Array.isArray(message)) {
      return 'VALIDATION_ERROR';
    }

    switch (statusCode) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';

      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';

      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';

      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';

      case HttpStatus.CONFLICT:
        return 'CONFLICT';

      case HttpStatus.PAYLOAD_TOO_LARGE:
        return 'PAYLOAD_TOO_LARGE';

      case HttpStatus.TOO_MANY_REQUESTS:
        return 'TOO_MANY_REQUESTS';

      case HttpStatus.SERVICE_UNAVAILABLE:
        return 'SERVICE_UNAVAILABLE';

      case HttpStatus.INTERNAL_SERVER_ERROR:
        return 'INTERNAL_SERVER_ERROR';

      default:
        return 'HTTP_ERROR';
    }
  }

  private defaultError(statusCode: number): string {
    switch (statusCode) {
      case HttpStatus.BAD_REQUEST:
        return 'Bad Request';

      case HttpStatus.UNAUTHORIZED:
        return 'Unauthorized';

      case HttpStatus.FORBIDDEN:
        return 'Forbidden';

      case HttpStatus.NOT_FOUND:
        return 'Not Found';

      case HttpStatus.CONFLICT:
        return 'Conflict';

      case HttpStatus.PAYLOAD_TOO_LARGE:
        return 'Payload Too Large';

      case HttpStatus.TOO_MANY_REQUESTS:
        return 'Too Many Requests';

      case HttpStatus.SERVICE_UNAVAILABLE:
        return 'Service Unavailable';

      case HttpStatus.INTERNAL_SERVER_ERROR:
        return 'Internal Server Error';

      default:
        return 'HTTP Error';
    }
  }

  private logUnexpectedException(exception: unknown, requestId: string): void {
    if (exception instanceof Error) {
      this.logger.error(`Unhandled exception requestId=${requestId}`, exception.stack);

      return;
    }

    this.logger.error(`Unhandled non-Error exception requestId=${requestId}`);
  }
}
