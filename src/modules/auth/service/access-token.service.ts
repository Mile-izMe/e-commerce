import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { isUUID } from 'class-validator';
import { UsersService } from '../../users/user.service.js';
import { JWT_AUDIENCE, JWT_ISSUER } from '../constants/jwt-constants.js';

@Injectable()
export class AccessTokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly users: UsersService,
  ) {}

  async authenticate(token: string) {
    let payload: unknown;
    try {
      payload = await this.jwt.verifyAsync(token, {
        algorithms: ['HS256'],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
    if (
      typeof payload !== 'object' ||
      !payload ||
      !('sub' in payload) ||
      typeof payload.sub !== 'string' ||
      !isUUID(payload.sub) ||
      !('exp' in payload) ||
      typeof payload.exp !== 'number' ||
      !Number.isFinite(payload.exp)
    ) {
      throw new UnauthorizedException('Invalid access token claims');
    }
    // Database errors remain server errors instead of being treated as bad credentials.
    return {
      user: await this.users.getForSession(payload.sub),
      expiresAt: payload.exp * 1000,
    };
  }
}
