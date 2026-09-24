import { randomUUID } from 'node:crypto';
import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { FieldErrorDetail } from '../api/field-error-details.js';
import { AppException } from './app.exception.js';
import { ErrorCode } from './error-code.js';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const supplied = request.headers['x-trace-id'];
    const traceId =
      typeof supplied === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(supplied)
        ? supplied
        : randomUUID();
    response.setHeader('x-trace-id', traceId);

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const error = (HttpStatus[status] ?? 'INTERNAL_SERVER_ERROR')
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
      .replace(/_/g, ' ');
    let errorCode: string = ErrorCode.INTERNAL_SERVER_ERROR.code;
    let message: string = ErrorCode.INTERNAL_SERVER_ERROR.defaultMessage;
    let subErrors: FieldErrorDetail[] | undefined;

    if (exception instanceof AppException) {
      errorCode = exception.errorCode;
      message = exception.message;
    } else if (exception instanceof BadRequestException) {
      errorCode = ErrorCode.VALIDATION_ERROR.code;
      const details = exception.getResponse();
      const raw =
        typeof details === 'object' && details !== null && 'message' in details
          ? details.message
          : exception.message;
      if (Array.isArray(raw)) {
        subErrors = raw
          .filter((item): item is string => typeof item === 'string')
          .map((item) => ({
            field: /^\w+/.exec(item)?.[0] ?? '',
            message: item,
          }));
        message = ErrorCode.VALIDATION_ERROR.defaultMessage;
      } else {
        message = typeof raw === 'string' ? raw : exception.message;
      }
    } else if (exception instanceof HttpException) {
      errorCode = `HTTP-${status}`;
      message =
        status >= 500
          ? ErrorCode.INTERNAL_SERVER_ERROR.defaultMessage
          : exception.message;
      if (status >= 500) {
        this.logger.error(
          `[${traceId}] ${request.method} ${request.url} returned ${status}`,
          exception.stack,
        );
      }
    } else {
      this.logger.error(
        `[${traceId}] Unhandled ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      success: false,
      timestamp: new Date().toISOString(),
      statusCode: status,
      error,
      errorCode,
      message,
      traceId,
      ...(subErrors?.length ? { subErrors } : {}),
    });
  }
}
