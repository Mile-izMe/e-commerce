import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

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
}
