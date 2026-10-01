import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { UserProfile } from '../../users/entities/user.js';
import { AccessTokenService } from '../service/access-token.service.js';

export type AuthenticatedRequest = Request & { user: UserProfile };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly tokens: AccessTokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: UserProfile }>();
    const token = /^Bearer ([^\s]+)$/i.exec(
      request.headers.authorization ?? '',
    )?.[1];
    if (!token) throw new UnauthorizedException();
    request.user = (await this.tokens.authenticate(token)).user;
    return true;
  }
}
