import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from './contract.js';
import contractJson from './contract.json' with { type: 'json' };

// The Nest provider owns one client per application. Scripts/tests can create
// separate clients without sharing a pool that another application has closed.
export function createDatabase(url: string) {
  if (!url?.trim()) {
    throw new Error('DATABASE_URL is required');
  }

  return postgres<Contract>({
    contractJson,
    url,
    poolOptions: {
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
    },
  });
}

export type DatabaseClient = ReturnType<typeof createDatabase>;
