#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/b99ef845ddf384a899a7cd547374a54d227fe041681a6dd43ec41b428ba7c8b2/contract';
import startContract from '../../snapshots/b99ef845ddf384a899a7cd547374a54d227fe041681a6dd43ec41b428ba7c8b2/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/ee2d02153331780abb78b0268b8aa589d9d5098cb5686c81c842a9856f527282/contract';
import endContract from '../../snapshots/ee2d02153331780abb78b0268b8aa589d9d5098cb5686c81c842a9856f527282/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createIndex({
        schema: 'public',
        table: 'userSession',
        index: 'userSession_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'userSession',
        foreignKey: {
          name: 'userSession_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
