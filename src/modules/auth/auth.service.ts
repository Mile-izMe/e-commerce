import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { UserProfile } from '../users/entities/user.js';
import { UsersSessionService } from '../users/user-session.service.js';
import { UsersService } from '../users/user.service.js';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from './constants/jwt-constants.js';
import type { AuthResponseDto } from './dto/auth-response.dto.js';
import type { LoginRequestDto } from './dto/login-request.dto.js';
import type { RefreshRequestDto } from './dto/refresh-request.dto.js';
import type { RegisterRequestDto } from './dto/register-request.dto.js';
import { HashService } from './service/hash-service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly sessions: UsersSessionService,
    private readonly hashes: HashService,
    private readonly jwt: JwtService,
  ) {}

  async register(request: RegisterRequestDto): Promise<AuthResponseDto> {
    const passwordHash = await this.hashes.hash(request.password);
    const user = await this.users.register(request, passwordHash);
    return this.issueSession(user);
  }

  async login(request: LoginRequestDto): Promise<AuthResponseDto> {
    const user = await this.users.findForLogin(request.identifier);
    if (
      !user ||
      !(await this.hashes.verify(user.passwordHash, request.password))
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const profile = await this.users.getForSession(user.id);
    await this.users.recordLogin(user.id);
    return this.issueSession(profile);
  }

  async refresh(request: RefreshRequestDto): Promise<AuthResponseDto> {
    const currentHash = this.hashes.hashToken(request.refreshToken);
    const session = await this.sessions.findByTokenHash(currentHash);
    if (
      !session ||
      session.revokedAt !== null ||
      Date.parse(session.expiresAt) <= Date.now()
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const user = await this.users.getForSession(session.userId);
    const nextToken = this.hashes.newRefreshToken();
    const rotated = await this.sessions.rotate(
      session.id,
      currentHash,
      this.hashes.hashToken(nextToken),
    );
    if (!rotated) throw new UnauthorizedException('Invalid refresh token');
    return this.authResponse(user, nextToken);
  }

  async logout(request: RefreshRequestDto): Promise<void> {
    await this.sessions.revokeByTokenHash(
      this.hashes.hashToken(request.refreshToken),
    );
  }

  private async issueSession(user: UserProfile): Promise<AuthResponseDto> {
    const refreshToken = this.hashes.newRefreshToken();
    await this.sessions.createSession({
      userId: user.id,
      refreshTokenHash: this.hashes.hashToken(refreshToken),
      expiresAt: new Date(
        Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000,
      ).toISOString(),
    });
    return this.authResponse(user, refreshToken);
  }

  private async authResponse(
    user: UserProfile,
    refreshToken: string,
  ): Promise<AuthResponseDto> {
    return {
      accessToken: await this.jwt.signAsync({ sub: user.id }),
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      user,
    };
  }
}
