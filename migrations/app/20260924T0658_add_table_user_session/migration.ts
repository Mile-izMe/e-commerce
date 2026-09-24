#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/66f07d437933db9787d55501c8e01448aa2168b2c5bfcd2a8c57b5cdfd4d7d9a/contract';
import endContract from '../../snapshots/66f07d437933db9787d55501c8e01448aa2168b2c5bfcd2a8c57b5cdfd4d7d9a/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/9085c6b94c6dfe4c6968ca08656d2d3c9f1896022a38e14f77f76ba44ce7e507/contract';
import startContract from '../../snapshots/9085c6b94c6dfe4c6968ca08656d2d3c9f1896022a38e14f77f76ba44ce7e507/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'userSession',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('lastUsedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('refreshTokenHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('revokedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('userId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
