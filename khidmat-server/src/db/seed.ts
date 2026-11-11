import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { getDatabasePool } from './client';
import { logger } from '../lib/logger';

dotenv.config();

export async function runSeed() {
  const pool = getDatabasePool();
  if (!pool) {
    throw new Error('DATABASE_URL is not set in environment or .env');
  }

  const client = await pool.connect();
  try {
    const seedPath = path.join(__dirname, 'seed.sql');
    if (!fs.existsSync(seedPath)) {
      throw new Error(`Seed file not found at ${seedPath}`);
    }

    logger.info('Seeding database with demo data (seed.sql)...');
    const seedSql = fs.readFileSync(seedPath, 'utf8');
    await client.query(seedSql);
    logger.info('Database seeded successfully!');
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error('Database seeding failed:', err);
      process.exit(1);
    });
}
