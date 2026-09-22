import 'dotenv/config';
import { createDatabase } from '../../../prisma/db.js';
import { seedCatalog } from './catalog.seed.js';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Demo seed is intended for development/test databases');
}

const database = createDatabase(process.env.DATABASE_URL ?? '');
try {
  const created = await seedCatalog(database);
  console.log('Demo catalog seed completed. New records:', created);
} finally {
  await database.close();
}
