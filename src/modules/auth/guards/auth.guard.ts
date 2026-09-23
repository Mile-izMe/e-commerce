import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { isUUID } from 'class-validator';
import { UsersService } from '../../users/user.service.js';
import type { UserProfile } from '../../users/entities/user.js';
import { JWT_AUDIENCE, JWT_ISSUER } from '../constants/jwt-constants.js';

export type AuthenticatedRequest = Request & { user: UserProfile };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: UserProfile }>();
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException();
    }
    let payload: unknown;
    try {
      payload = await this.jwtService.verifyAsync(token, {
        algorithms: ['HS256'],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      });
    } catch {
      throw new UnauthorizedException();
    }
    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('sub' in payload) ||
      typeof payload.sub !== 'string' ||
      !isUUID(payload.sub)
    )
      throw new UnauthorizedException();
    // Preserve a real database failure as 500; invalid credentials remain 401.
    request.user = await this.users.getForSession(payload.sub);
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const match = /^Bearer ([^\s]+)$/i.exec(
      request.headers.authorization ?? '',
    );
    return match?.[1];
  }
}
