import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { map, Observable } from 'rxjs';
import { ApiSuccessResponse } from './api-base.response.js';
import { CursorPage } from './cursor-pagination.js';
import { SUCCESS_MESSAGE } from './success-message.decorator.js';

@Injectable()
export class SuccessResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const response = context.switchToHttp().getResponse<Response>();
    const message =
      this.reflector.getAllAndOverride<string>(SUCCESS_MESSAGE, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'Success';
    return next.handle().pipe(
      map((data: unknown) => {
        if (response.statusCode === 204) return undefined;
        if (data instanceof CursorPage)
          return ApiSuccessResponse.ofCursorPage(data, message);
        return new ApiSuccessResponse({ message, data });
      }),
    );
  }
}
