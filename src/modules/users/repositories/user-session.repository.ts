import { Inject, Injectable } from '@nestjs/common';
import { DATABASE } from '../../../infrastructure/database/database.constants.js';
import type { DatabaseClient } from '../../../prisma/db.js';
import type { UserSession } from '../entities/user-session.js';

@Injectable()
export class UserSessionRepository {
  constructor(@Inject(DATABASE) private readonly database: DatabaseClient) {}

  findByTokenHash(hash: string): Promise<UserSession | null> {
    return this.database.orm.public.UserSession.where({
      refreshTokenHash: hash,
    })
      .select('id', 'userId', 'refreshTokenHash', 'expiresAt', 'revokedAt')
      .first();
  }

  async createSession(input: {
    userId: string;
    refreshTokenHash: string;
    expiresAt: string;
  }): Promise<void> {
    await this.database.orm.public.UserSession.create(input);
  }

  async rotate(
    id: string,
    currentHash: string,
    nextHash: string,
  ): Promise<boolean> {
    const updated = await this.database.orm.public.UserSession.where({
      id,
      refreshTokenHash: currentHash,
    })
      .where((session) => session.revokedAt.isNull())
      .where((session) => session.expiresAt.gt(new Date().toISOString()))
      .select('id')
      .update({
        refreshTokenHash: nextHash,
        lastUsedAt: new Date().toISOString(),
      });
    return updated !== null;
  }

  async revokeByTokenHash(hash: string): Promise<void> {
    await this.database.orm.public.UserSession.where({
      refreshTokenHash: hash,
    })
      .where((session) => session.revokedAt.isNull())
      .update({ revokedAt: new Date().toISOString() });
  }
}
