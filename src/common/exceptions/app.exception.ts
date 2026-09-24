import { HttpException } from '@nestjs/common';
import { ErrorCodeProps } from './error-code.js';

export class AppException extends HttpException {
  public readonly errorCode: string;

  constructor(error: ErrorCodeProps, customMessage?: string) {
    super(customMessage || error.defaultMessage, error.status);
    this.errorCode = error.code;
  }
}
