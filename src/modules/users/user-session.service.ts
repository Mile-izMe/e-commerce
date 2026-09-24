import { Injectable } from '@nestjs/common';
import type { UserSession } from './entities/user-session.js';
import { UserSessionRepository } from './repositories/user-session.repository.js';

@Injectable()
export class UsersSessionService {
  constructor(private readonly sessions: UserSessionRepository) {}

  findByTokenHash(hash: string): Promise<UserSession | null> {
    return this.sessions.findByTokenHash(hash);
  }

  createSession(input: {
    userId: string;
    refreshTokenHash: string;
    expiresAt: string;
  }): Promise<void> {
    return this.sessions.createSession(input);
  }

  rotate(id: string, currentHash: string, nextHash: string): Promise<boolean> {
    return this.sessions.rotate(id, currentHash, nextHash);
  }

  revokeByTokenHash(hash: string): Promise<void> {
    return this.sessions.revokeByTokenHash(hash);
  }
}
