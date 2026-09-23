import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { isUUID } from 'class-validator';

export type AuthenticatedCartRequest = Request & { user: { id: string } };

@Injectable()
export class CartUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    // Only consume identity established by trusted authentication middleware/guard.
    // Never derive it from an unverified token, request body, query or header.
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: { id?: unknown } }>();
    if (typeof request.user?.id !== 'string' || !isUUID(request.user.id)) {
      throw new UnauthorizedException('Authentication is required');
    }
    return true;
  }
}
