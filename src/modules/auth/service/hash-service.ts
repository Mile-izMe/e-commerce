import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';

@Injectable()
export class HashService {
  hash(password: string): Promise<string> {
    // node-argon2 defaults to Argon2id and embeds salt/parameters in the hash.
    return argon2.hash(password, { type: argon2.argon2id });
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      // A legacy or malformed hash is invalid; never fall back to plaintext.
      return false;
    }
  }

  newRefreshToken(): string {
    return randomBytes(32).toString('base64url');
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
