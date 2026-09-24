#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/66f07d437933db9787d55501c8e01448aa2168b2c5bfcd2a8c57b5cdfd4d7d9a/contract';
import startContract from '../../snapshots/66f07d437933db9787d55501c8e01448aa2168b2c5bfcd2a8c57b5cdfd4d7d9a/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/b99ef845ddf384a899a7cd547374a54d227fe041681a6dd43ec41b428ba7c8b2/contract';
import endContract from '../../snapshots/b99ef845ddf384a899a7cd547374a54d227fe041681a6dd43ec41b428ba7c8b2/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropNotNull({ schema: 'public', table: 'userSession', column: 'lastUsedAt' }),
      this.dropNotNull({ schema: 'public', table: 'userSession', column: 'revokedAt' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
