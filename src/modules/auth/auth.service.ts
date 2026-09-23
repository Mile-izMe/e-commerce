import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/user.service.js';
import type { UserProfile } from '../users/entities/user.js';
import type { RegisterRequestDto } from './dto/register-request.dto.js';
import type { LoginRequestDto } from './dto/login-request.dto.js';
import type { AuthResponseDto } from './dto/auth-response.dto.js';
import { ACCESS_TOKEN_TTL_SECONDS } from './constants/jwt-constants.js';
import { HashService } from './service/hash-service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly hashes: HashService,
    private readonly jwt: JwtService,
  ) {}

  async register(request: RegisterRequestDto): Promise<string> {
    const passwordHash = await this.hashes.hash(request.password);
    const user = await this.users.register(request, passwordHash);
    if (user) {
      return 'Create account success';
    }
    return 'Create account failed';
  }

  async login(request: LoginRequestDto): Promise<AuthResponseDto> {
    const user = await this.users.findForLogin(request.identifier);
    if (
      !user ||
      !(await this.hashes.verify(user.passwordHash, request.password))
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }
    // Do not issue new tokens for accounts disabled after registration.
    const profile = await this.users.getForSession(user.id);
    await this.users.recordLogin(user.id);
    return this.issueToken(profile);
  }

  private async issueToken(user: UserProfile): Promise<AuthResponseDto> {
    return {
      accessToken: await this.jwt.signAsync({ sub: user.id }),
      tokenType: 'Bearer',
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      user,
    };
  }
}
