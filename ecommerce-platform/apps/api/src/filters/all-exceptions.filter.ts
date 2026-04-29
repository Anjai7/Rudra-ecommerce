// ============================================================
// Global Exception Filter
// ============================================================
// Catches all unhandled exceptions, reports to Sentry,
// and returns standardized error responses.
// ============================================================

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as Sentry from '@sentry/node';
import type { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';
    let details: Record<string, unknown> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as Record<string, unknown>;
        message = (resp.message as string) || exception.message;
        code = (resp.error as string) || 'HTTP_ERROR';
        // Class-validator returns array of messages
        if (Array.isArray(resp.message)) {
          message = 'Validation failed';
          details = { errors: resp.message };
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      code = exception.name || 'UNKNOWN_ERROR';
    }

    // Log the error
    if (status >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} → ${status}: ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );

      // Report 5xx errors to Sentry
      if (process.env.SENTRY_DSN) {
        Sentry.withScope((scope) => {
          scope.setTag('url', request.url);
          scope.setTag('method', request.method);
          scope.setExtra('body', request.body);
          scope.setExtra('query', request.query);
          scope.setUser({
            ip_address: request.ip,
            id: (request as any).user?.supabase_uid,
          });
          Sentry.captureException(exception);
        });
      }
    } else {
      this.logger.warn(`[${request.method}] ${request.url} → ${status}: ${message}`);
    }

    response.status(status).json({
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
